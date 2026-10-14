// Reading a knitter's Ravelry on their behalf.
//
// The server half of docs/plans/ravelry-import.md. Everything Ravelry has to happen here: the app
// ships to the web, where the client secret would be public, and Ravelry does not allow
// authenticated browser requests. So the app asks this function, and this function holds the token.
//
// This is the first slice — `task: "probe"`. It does the whole chain that every later import needs
// (decrypt the stored refresh token, exchange it for an access token, read Ravelry) and returns
// only the counts, so the read path can be confirmed end-to-end before a single entity is mapped.
// The per-entity tasks (stash, needles, patterns, projects) return normalized payloads the client
// maps with src/lib/ravelry/*; they slot in where `probe` is now.
//
// Scope note: the provider must be configured with the `offline` scope and no `profile-only`, which
// Ravelry's consent screen renders as "view and update my Ravelry notebook" — full read access.
// profile-only yields only the profile and every read here comes back 403.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// Who is asking, verified against the auth server — never decoded on trust. Same as the other
// functions; the id decides whose stored token is used.
async function callerId(request: Request, url: string, anonKey: string): Promise<string | null> {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const response = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    const user = (await response.json()) as { id?: string };
    return user.id ?? null;
  } catch {
    return null;
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

// crypto.subtle wants a BufferSource backed by a plain ArrayBuffer; a Uint8Array's buffer is only
// ArrayBufferLike to the type checker, so hand it an exact, freshly-sliced copy.
function bufferOf(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function aesKey(keyB64: string, usage: KeyUsage): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', bufferOf(fromBase64(keyB64)), { name: 'AES-GCM' }, false, [
    usage,
  ]);
}

// The reverse of ravelry-connect's envelope: "v1.<iv>.<ciphertext>", AES-GCM.
async function decrypt(enveloped: string, keyB64: string): Promise<string> {
  const [version, ivB64, ctB64] = enveloped.split('.');
  if (version !== 'v1' || !ivB64 || !ctB64) throw new Error('unrecognised token envelope');
  const key = await aesKey(keyB64, 'decrypt');
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bufferOf(fromBase64(ivB64)) },
    key,
    bufferOf(fromBase64(ctB64)),
  );
  return new TextDecoder().decode(plain);
}

async function envelope(plaintext: string, keyB64: string): Promise<string> {
  const key = await aesKey(keyB64, 'encrypt');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: bufferOf(iv) },
      key,
      bufferOf(new TextEncoder().encode(plaintext)),
    ),
  );
  return `v1.${toBase64(iv)}.${toBase64(ciphertext)}`;
}

type Connection = { refresh_token: string; ravelry_username: string };

async function loadConnection(
  url: string,
  serviceKey: string,
  userId: string,
): Promise<Connection | null> {
  const response = await fetch(
    `${url}/rest/v1/ravelry_connections?user_id=eq.${userId}&select=refresh_token,ravelry_username`,
    {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) return null;
  const rows = (await response.json()) as Connection[];
  return rows[0] ?? null;
}

async function storeRefreshToken(
  url: string,
  serviceKey: string,
  userId: string,
  enveloped: string,
): Promise<void> {
  await fetch(`${url}/rest/v1/ravelry_connections?user_id=eq.${userId}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ refresh_token: enveloped }),
    signal: AbortSignal.timeout(10_000),
  });
}

type Tokens = { accessToken: string; refreshToken: string | null };

// Exchange the stored refresh token for a fresh access token. Ravelry takes the app credentials as
// HTTP Basic, the only style it accepts. It may hand back a *new* refresh token, which must replace
// the stored one or the next run fails — so the caller re-stores it when it does.
async function refreshAccess(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<Tokens | null> {
  const basic = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch('https://www.ravelry.com/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { access_token?: string; refresh_token?: string };
  if (!body.access_token) return null;
  return { accessToken: body.access_token, refreshToken: body.refresh_token ?? null };
}

async function ravelryGet(path: string, accessToken: string): Promise<Response> {
  return fetch(`https://api.ravelry.com${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  });
}

// How many of a thing a list endpoint reports, without pulling the whole list: ask for one and read
// the paginator's total. Needles have no paginator, so there the record array is counted directly.
async function countFrom(
  path: string,
  key: string,
  accessToken: string,
): Promise<{ status: number; count: number | null }> {
  const response = await ravelryGet(path, accessToken);
  if (!response.ok) return { status: response.status, count: null };
  const body = (await response.json()) as {
    paginator?: { results?: number };
    [k: string]: unknown;
  };
  const listed = Array.isArray(body[key]) ? (body[key] as unknown[]).length : null;
  return { status: response.status, count: body.paginator?.results ?? listed };
}

async function ravelryJson<T>(path: string, accessToken: string): Promise<T | null> {
  const response = await ravelryGet(path, accessToken);
  if (!response.ok) return null;
  return (await response.json()) as T;
}

function notNull<T>(value: T | null | undefined): value is T {
  return value != null;
}

// Ravelry rate-limits, and a whole notebook is far more requests than one burst should make — so at
// most `limit` details are in flight. The cap is a safety ceiling on one function call, not the page
// size: lists are paginated in full up to it. A notebook past the cap needs an incremental import,
// which is future work.
const PULL_CAP = 1000;

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

// Walk every page of a list endpoint, collecting the `id` of each item, up to the cap. The list
// responses carry a paginator with `last_page`; stop there, or when a page comes back empty.
async function listAllIds(
  pathFor: (page: number) => string,
  key: string,
  token: string,
): Promise<number[]> {
  const ids: number[] = [];
  for (let page = 1; ; page += 1) {
    const body = await ravelryJson<
      { paginator?: { last_page?: number; page_count?: number } } & Record<string, unknown>
    >(pathFor(page), token);
    const items = (body?.[key] as { id?: number }[] | undefined) ?? [];
    for (const item of items) if (item.id != null) ids.push(item.id);
    const lastPage = body?.paginator?.last_page ?? body?.paginator?.page_count ?? page;
    if (items.length === 0 || page >= lastPage || ids.length >= PULL_CAP) break;
  }
  return ids.slice(0, PULL_CAP);
}

// The list endpoints are thin; the mapping needs the detail (a stash entry's yarn and packs, a
// project's gauge and needles). So list, then fetch each detail, capped and pooled.
async function pullStash(username: string, token: string): Promise<unknown[]> {
  const ids = await listAllIds(
    (page) => `/people/${username}/stash/list.json?page_size=100&page=${page}`,
    'stash',
    token,
  );
  const details = await mapPool(ids, 4, (id) =>
    ravelryJson<{ stash?: unknown }>(`/people/${username}/stash/${id}.json`, token).then(
      (d) => d?.stash ?? null,
    ),
  );
  return details.filter(notNull);
}

async function pullProjects(
  username: string,
  token: string,
): Promise<{ projects: unknown[]; patternIds: number[] }> {
  const ids = await listAllIds(
    (page) => `/projects/${username}/list.json?page_size=100&page=${page}`,
    'projects',
    token,
  );
  const details = await mapPool(ids, 4, (id) =>
    ravelryJson<{ project?: unknown }>(`/projects/${username}/${id}.json`, token).then(
      (d) => d?.project ?? null,
    ),
  );
  const projects = details.filter(notNull);
  const patternIds = projects
    .map((p) => (p as { pattern_id?: number | null }).pattern_id)
    .filter(notNull);
  return { projects, patternIds };
}

// The patterns to import: the ones projects were made from, plus the ones the knitter owns. Library
// volumes carry the pattern id directly, so this paginates them itself rather than through listAllIds.
async function pullLibraryPatternIds(username: string, token: string): Promise<number[]> {
  const ids: number[] = [];
  for (let page = 1; ; page += 1) {
    const body = await ravelryJson<{
      volumes?: { pattern_id?: number | null }[];
      paginator?: { last_page?: number };
    }>(`/people/${username}/library/search.json?page_size=100&page=${page}`, token);
    const volumes = body?.volumes ?? [];
    for (const volume of volumes) if (volume.pattern_id != null) ids.push(volume.pattern_id);
    const lastPage = body?.paginator?.last_page ?? page;
    if (volumes.length === 0 || page >= lastPage || ids.length >= PULL_CAP) break;
  }
  return ids.slice(0, PULL_CAP);
}

async function pullPatterns(ids: number[], token: string): Promise<unknown[]> {
  const unique = [...new Set(ids)].slice(0, PULL_CAP);
  const details = await mapPool(unique, 4, (id) =>
    ravelryJson<{ pattern?: unknown }>(`/patterns/${id}.json`, token).then((d) => d?.pattern ?? null),
  );
  return details.filter(notNull);
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const tokenKey = Deno.env.get('RAVELRY_TOKEN_KEY');
  const clientId = Deno.env.get('RAVELRY_CLIENT_ID');
  const clientSecret = Deno.env.get('RAVELRY_CLIENT_SECRET');
  if (!url || !serviceKey || !tokenKey || !clientId || !clientSecret) {
    console.error('ravelry-import is not configured');
    return json({ error: 'Importing from Ravelry is not set up on this server.' }, 503);
  }

  const userId = await callerId(request, url, anonKey);
  if (!userId) return json({ error: 'Sign in again and then try.' }, 401);

  // `probe` (default) returns only counts, to confirm the path; `pull` returns the raw payloads the
  // client maps with src/lib/ravelry/*; `pattern-pdf` returns one owned pattern's PDF to chart.
  let task = 'probe';
  let patternId = 0;
  try {
    const body = (await request.json()) as { task?: unknown; patternId?: unknown };
    if (typeof body.task === 'string') task = body.task;
    if (typeof body.patternId === 'number') patternId = body.patternId;
  } catch {
    // No body, or not JSON — probe it is.
  }

  const connection = await loadConnection(url, serviceKey, userId);
  // No stored token means Ravelry was never connected (or the connect never reached the server).
  if (!connection) return json({ error: 'Connect Ravelry first.', connected: false }, 409);

  let refreshToken: string;
  try {
    refreshToken = await decrypt(connection.refresh_token, tokenKey);
  } catch (error) {
    console.error('ravelry-import could not read the stored token', error);
    return json({ error: 'Your Ravelry connection is unreadable. Connect it again.' }, 500);
  }

  const tokens = await refreshAccess(refreshToken, clientId, clientSecret);
  // Ravelry refused the refresh: the grant was revoked, or the token expired unused. The knitter
  // reconnects — there is nothing to retry here.
  if (!tokens) return json({ error: 'Ravelry would not renew access. Connect it again.', connected: false }, 401);

  // A rotated refresh token has to replace the old one or the next run fails with a token already spent.
  if (tokens.refreshToken && tokens.refreshToken !== refreshToken) {
    await storeRefreshToken(url, serviceKey, userId, await envelope(tokens.refreshToken, tokenKey));
  }

  // One owned pattern's PDF, so the client can chart it (Phase 4). Returned as bytes for the client
  // to extract and run through parse-pattern, reusing the same path a pasted PDF takes.
  //
  // NOTE: how Ravelry exposes an owned pattern's PDF is not yet verified against a real owned
  // pattern — this reads `pattern.pdf_url` and downloads it. If a knitter's owned pattern turns out
  // to use a different field or a separate download endpoint, this is the one place to adjust.
  if (task === 'pattern-pdf') {
    if (!patternId) return json({ error: 'Which pattern?' }, 400);
    const detail = await ravelryJson<{
      pattern?: {
        name?: string | null;
        pdf_url?: string | null;
        download_location?: { url?: string | null } | string | null;
        pdf_in_library?: boolean | null;
        downloadable?: boolean | null;
      };
    }>(`/patterns/${patternId}.json`, tokens.accessToken);
    const pattern = detail?.pattern;

    // Which field carries an owned pattern's PDF is unverified, so try the ones that could: the
    // direct pdf_url, then download_location (string or { url }). Each is tried in turn.
    const downloadLocation =
      typeof pattern?.download_location === 'string'
        ? pattern.download_location
        : (pattern?.download_location?.url ?? '');
    const candidates = [pattern?.pdf_url ?? '', downloadLocation].filter((u) =>
      /^https?:\/\//.test(u),
    );

    if (candidates.length === 0) {
      // Owned-but-no-link reads differently from simply not owned — say which, so the live test can
      // tell a missing field from a pattern the knitter never bought.
      const reason =
        pattern?.pdf_in_library || pattern?.downloadable
          ? 'Ravelry has this pattern’s PDF but exposed no download link to Knitwit.'
          : 'There is no PDF to chart for this pattern.';
      return json({ owned: false, reason });
    }

    for (const candidate of candidates) {
      const pdf = await fetch(candidate, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
        signal: AbortSignal.timeout(30_000),
      });
      if (!pdf.ok) continue;
      const bytes = new Uint8Array(await pdf.arrayBuffer());
      if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') continue;
      return json({ owned: true, name: pattern?.name ?? '', pdfBase64: toBase64(bytes) });
    }
    return json({ owned: false, reason: 'The PDF could not be downloaded from Ravelry.' });
  }

  // Who this is on Ravelry — the list endpoints are keyed by username.
  const whoResponse = await ravelryGet('/current_user.json', tokens.accessToken);
  if (!whoResponse.ok) {
    return json({ error: 'Ravelry would not say who you are.', status: whoResponse.status }, 502);
  }
  const who = (await whoResponse.json()) as { user?: { username?: string } };
  const username = who.user?.username ?? connection.ravelry_username;
  if (!username) return json({ error: 'No Ravelry username to read from.' }, 502);

  if (task === 'pull') {
    const needlesResponse = await ravelryJson<{ needle_records?: unknown[] }>(
      `/people/${username}/needles/list.json`,
      tokens.accessToken,
    );
    const needles = needlesResponse?.needle_records ?? [];
    const stash = await pullStash(username, tokens.accessToken);
    const { projects, patternIds } = await pullProjects(username, tokens.accessToken);
    const libraryIds = await pullLibraryPatternIds(username, tokens.accessToken);
    const patterns = await pullPatterns([...patternIds, ...libraryIds], tokens.accessToken);

    console.log(
      JSON.stringify({
        event: 'ravelry-import',
        task: 'pull',
        ok: true,
        counts: {
          stash: stash.length,
          needles: needles.length,
          patterns: patterns.length,
          projects: projects.length,
        },
      }),
    );
    return json({ ok: true, connected: true, ravelryUser: username, data: { stash, needles, patterns, projects } });
  }

  const [projects, stash, needles] = await Promise.all([
    countFrom(`/projects/${username}/list.json?page_size=1`, 'projects', tokens.accessToken),
    countFrom(`/people/${username}/stash/list.json?page_size=1`, 'stash', tokens.accessToken),
    countFrom(`/people/${username}/needles/list.json`, 'needle_records', tokens.accessToken),
  ]);

  // The honest shape of the answer: a 200 with real counts means the read path works end to end; a
  // 403 on the counts (with current_user fine) is the scope still being too narrow.
  console.log(
    JSON.stringify({ event: 'ravelry-import', task: 'probe', ok: true, projects: projects.status }),
  );
  return json({
    ok: true,
    connected: true,
    ravelryUser: username,
    counts: {
      projects: projects.count,
      stash: stash.count,
      needles: needles.count,
    },
    readStatus: {
      projects: projects.status,
      stash: stash.status,
      needles: needles.status,
    },
  });
});
