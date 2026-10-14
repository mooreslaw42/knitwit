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

// Persisting a rotated refresh token. Ravelry's are single-use, so if this does not land, the next
// import refreshes a spent token and the connection is dead — which is why the result is checked and
// a failure is loud, not swallowed.
async function storeRefreshToken(
  url: string,
  serviceKey: string,
  userId: string,
  enveloped: string,
): Promise<boolean> {
  const response = await fetch(`${url}/rest/v1/ravelry_connections?user_id=eq.${userId}`, {
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
  if (!response.ok) {
    console.error('ravelry-import could not re-store the rotated token', response.status, await response.text().catch(() => ''));
  }
  return response.ok;
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

// How much one invocation is allowed to do.
//
// The list endpoints are thin — the mapping needs each entry's *detail* — so a notebook costs one
// request per stash entry, per project and per pattern on top of the lists. Doing all of that in a
// single call is what breaks on a real account: a knitter with a couple of hundred projects is
// several hundred Ravelry requests and a multi-megabyte response in one function, which runs out of
// wall clock, annoys Ravelry's rate limiter, and loses everything if the last one fails.
//
// So the unit of work is a *page*: at most PAGE_SIZE details, four in flight, one bounded response.
// The client asks for pages until `hasMore` goes false, applying each as it arrives — which also
// makes the import resumable (a failed page is retried, the ones before it are already saved) and
// gives it something honest to show a knitter while it runs.
const PAGE_SIZE = 25;

// The ceiling the whole-notebook `pull` still honours. Paged tasks have no such limit — they just
// keep going — so this only bounds the legacy single-shot path.
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

// One page of a list endpoint's ids, and whether anything follows it. `last_page` comes off the
// paginator every list response carries.
async function listPage(
  pathFor: (page: number) => string,
  key: string,
  token: string,
  page: number,
): Promise<{ ids: number[]; hasMore: boolean }> {
  const body = await ravelryJson<
    { paginator?: { last_page?: number; page_count?: number } } & Record<string, unknown>
  >(pathFor(page), token);
  const items = (body?.[key] as { id?: number }[] | undefined) ?? [];
  const ids = items.map((item) => item.id).filter(notNull);
  const lastPage = body?.paginator?.last_page ?? body?.paginator?.page_count ?? page;
  return { ids, hasMore: items.length > 0 && page < lastPage };
}

async function detailsFor<T>(
  ids: number[],
  token: string,
  pathFor: (id: number) => string,
  key: string,
): Promise<T[]> {
  const details = await mapPool(ids, 4, (id) =>
    ravelryJson<Record<string, unknown>>(pathFor(id), token).then((d) => (d?.[key] ?? null) as T | null),
  );
  return details.filter(notNull);
}

async function stashPage(
  username: string,
  token: string,
  page: number,
): Promise<{ items: unknown[]; hasMore: boolean }> {
  const { ids, hasMore } = await listPage(
    (p) => `/people/${username}/stash/list.json?page_size=${PAGE_SIZE}&page=${p}`,
    'stash',
    token,
    page,
  );
  return { items: await detailsFor(ids, token, (id) => `/people/${username}/stash/${id}.json`, 'stash'), hasMore };
}

async function projectsPage(
  username: string,
  token: string,
  page: number,
): Promise<{ items: unknown[]; hasMore: boolean }> {
  const { ids, hasMore } = await listPage(
    (p) => `/projects/${username}/list.json?page_size=${PAGE_SIZE}&page=${p}`,
    'projects',
    token,
    page,
  );
  return { items: await detailsFor(ids, token, (id) => `/projects/${username}/${id}.json`, 'project'), hasMore };
}

// Library volumes carry the pattern id directly, so this returns ids and lets the client decide which
// details it still needs — it already knows which patterns it has.
async function libraryPage(
  username: string,
  token: string,
  page: number,
): Promise<{ ids: number[]; hasMore: boolean }> {
  const body = await ravelryJson<{
    volumes?: { pattern_id?: number | null }[];
    paginator?: { last_page?: number };
  }>(`/people/${username}/library/search.json?page_size=${PAGE_SIZE}&page=${page}`, token);
  const volumes = body?.volumes ?? [];
  const ids = volumes.map((volume) => volume.pattern_id).filter(notNull);
  const lastPage = body?.paginator?.last_page ?? page;
  return { ids, hasMore: volumes.length > 0 && page < lastPage };
}

async function patternsByIds(ids: number[], token: string): Promise<unknown[]> {
  const unique = [...new Set(ids)].slice(0, PAGE_SIZE * 2);
  return await detailsFor(unique, token, (id) => `/patterns/${id}.json`, 'pattern');
}

// The legacy whole-notebook paths, now just the paged ones walked to the end (bounded by PULL_CAP).
// `task: "pull"` still works for a small account and for any client that has not updated yet.
async function pullAll(
  page: (p: number) => Promise<{ items: unknown[]; hasMore: boolean }>,
): Promise<unknown[]> {
  const out: unknown[] = [];
  for (let p = 1; out.length < PULL_CAP; p += 1) {
    const { items, hasMore } = await page(p);
    out.push(...items);
    if (!hasMore) break;
  }
  return out.slice(0, PULL_CAP);
}

async function pullLibraryPatternIds(username: string, token: string): Promise<number[]> {
  const ids: number[] = [];
  for (let page = 1; ids.length < PULL_CAP; page += 1) {
    const { ids: pageIds, hasMore } = await libraryPage(username, token, page);
    ids.push(...pageIds);
    if (!hasMore) break;
  }
  return ids.slice(0, PULL_CAP);
}

async function pullPatterns(ids: number[], token: string): Promise<unknown[]> {
  const unique = [...new Set(ids)].slice(0, PULL_CAP);
  return await detailsFor(unique, token, (id) => `/patterns/${id}.json`, 'pattern');
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
  let page = 1;
  let ids: number[] = [];
  try {
    const body = (await request.json()) as {
      task?: unknown;
      patternId?: unknown;
      page?: unknown;
      ids?: unknown;
    };
    if (typeof body.task === 'string') task = body.task;
    if (typeof body.patternId === 'number') patternId = body.patternId;
    if (typeof body.page === 'number' && body.page >= 1) page = Math.floor(body.page);
    if (Array.isArray(body.ids)) ids = body.ids.filter((v): v is number => typeof v === 'number');
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

  // A rotated refresh token has to replace the old one or the next run fails with a token already
  // spent. Ravelry rotates on every refresh, so this runs most times; a failure here is logged by
  // storeRefreshToken, because a silent one strands the connection.
  const rotated = Boolean(tokens.refreshToken && tokens.refreshToken !== refreshToken);
  if (rotated) {
    const restored = await storeRefreshToken(
      url,
      serviceKey,
      userId,
      await envelope(tokens.refreshToken as string, tokenKey),
    );
    console.log(JSON.stringify({ event: 'ravelry-import', step: 'rotate', rotated, restored }));
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

  // The paged tasks. Each is one bounded slice of work, so a real notebook arrives in pieces the
  // client applies as they land — resumable, and with something honest to show while it runs. The
  // client keeps asking while `hasMore` is true.
  if (task === 'needles') {
    // Small enough to never need paging: the whole drawer comes back in one list.
    const body = await ravelryJson<{ needle_records?: unknown[] }>(
      `/people/${username}/needles/list.json`,
      tokens.accessToken,
    );
    return json({ ok: true, items: body?.needle_records ?? [], hasMore: false });
  }

  if (task === 'stash') {
    const { items, hasMore } = await stashPage(username, tokens.accessToken, page);
    return json({ ok: true, page, items, hasMore });
  }

  if (task === 'projects') {
    const { items, hasMore } = await projectsPage(username, tokens.accessToken, page);
    return json({ ok: true, page, items, hasMore });
  }

  if (task === 'library') {
    const { ids: volumeIds, hasMore } = await libraryPage(username, tokens.accessToken, page);
    return json({ ok: true, page, ids: volumeIds, hasMore });
  }

  // Details for the patterns the client asks for by id — the ones its projects point at, or its
  // library listed, minus whatever it already has.
  if (task === 'patterns') {
    return json({ ok: true, items: await patternsByIds(ids, tokens.accessToken), hasMore: false });
  }

  if (task === 'pull') {
    const needlesResponse = await ravelryJson<{ needle_records?: unknown[] }>(
      `/people/${username}/needles/list.json`,
      tokens.accessToken,
    );
    const needles = needlesResponse?.needle_records ?? [];
    const stash = await pullAll((p) => stashPage(username, tokens.accessToken, p));
    const projects = await pullAll((p) => projectsPage(username, tokens.accessToken, p));
    const patternIds = projects
      .map((p) => (p as { pattern_id?: number | null }).pattern_id)
      .filter(notNull);
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
