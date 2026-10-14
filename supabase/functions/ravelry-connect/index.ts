// Keeping the Ravelry refresh token Supabase only hands over once.
//
// Phase 0 of docs/plans/ravelry-import.md. When a knitter signs in with or connects Ravelry,
// supabase-js puts `provider_refresh_token` on the session that comes back — once, and stores it
// nowhere. The app sends it here the moment it sees it, and this is what makes it survive, so an
// import run next week can read the knitter's library without sending them back through Ravelry.
//
// ## Why it is enveloped
//
// The refresh token is a long-lived key to someone's Ravelry account. It is encrypted here with a
// key only this function holds (RAVELRY_TOKEN_KEY), so the row in `ravelry_connections` is
// ciphertext: a leak of the table is not a leak of anybody's account. The table is already closed
// to every client by RLS — only the service role, which this runs as, can touch it.

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

// Who is asking, according to the token they sent — verified against the auth server, never decoded
// on trust. The id that comes back is the only thing that decides whose row is written. Same shape
// as delete-account, for the same reason.
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

// AES-GCM with a fresh IV each time, written as "v1.<iv>.<ciphertext>" so the format can move on
// later without guessing what an old row was. The key is 32 raw bytes, base64 in the secret.
async function envelope(plaintext: string, keyB64: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    bufferOf(fromBase64(keyB64)),
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  );
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

// Best-effort: who this is on Ravelry, so the Account screen can say "connected as …" and the import
// has the username its endpoints are keyed by. current_user works even under the profile-only scope.
// A failure here never fails the connection — the token is what matters.
async function ravelryWhoAmI(accessToken: string): Promise<{ id: string; username: string } | null> {
  try {
    const response = await fetch('https://api.ravelry.com/current_user.json', {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { user?: { id?: number; username?: string } };
    return { id: String(body.user?.id ?? ''), username: body.user?.username ?? '' };
  } catch {
    return null;
  }
}

// Exchange a refresh token for a fresh one. Ravelry takes the app credentials as HTTP Basic and
// rotates the refresh token on every call, returning a new one — which is exactly what makes storing
// the rotated result safe: a spent token cannot be exchanged.
async function refreshAccess(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<{ accessToken: string; refreshToken: string | null } | null> {
  try {
    const response = await fetch('https://www.ravelry.com/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { access_token?: string; refresh_token?: string };
    if (!body.access_token) return null;
    return { accessToken: body.access_token, refreshToken: body.refresh_token ?? null };
  } catch {
    return null;
  }
}

async function connectionExists(url: string, serviceKey: string, userId: string): Promise<boolean> {
  const response = await fetch(
    `${url}/rest/v1/ravelry_connections?user_id=eq.${userId}&select=user_id`,
    {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) return false;
  return ((await response.json()) as unknown[]).length > 0;
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
    console.error('ravelry-connect is not configured');
    return json({ error: 'Connecting Ravelry is not set up on this server.' }, 503);
  }

  const userId = await callerId(request, url, anonKey);
  if (!userId) return json({ error: 'Sign in again and then try.' }, 401);

  let refreshToken = '';
  try {
    const body = (await request.json()) as { refresh_token?: unknown };
    if (typeof body.refresh_token === 'string') refreshToken = body.refresh_token;
  } catch {
    return json({ error: 'Send the connection details as JSON.' }, 400);
  }
  // No token to keep is nothing to do. Not an error the knitter can act on — Ravelry simply did not
  // return one this time — so it answers plainly rather than failing.
  if (!refreshToken) return json({ ok: true, stored: false });

  // Exchange the one-time token Supabase handed over for a fresh, rotated one, and store THAT. The
  // stored token is then always a step ahead of the spent original the client still holds — so a
  // reload replaying that original cannot refresh, and is turned away below rather than clobbering a
  // good connection. (This is the fix for the token dying after one import.)
  const refreshed = await refreshAccess(refreshToken, clientId, clientSecret);
  if (!refreshed) {
    // The incoming token would not refresh. If a connection already exists, this is almost certainly
    // a reload replaying the spent original — keep what is there, do not overwrite it.
    if (await connectionExists(url, serviceKey, userId)) {
      console.log(JSON.stringify({ event: 'ravelry-connect', ok: true, kept: true }));
      return json({ ok: true, stored: false, kept: true });
    }
    return json({ error: 'That Ravelry sign-in could not be confirmed. Connect it again.' }, 502);
  }

  // Ravelry rotates, so there is a new token to store; the original is the fallback only if it did
  // not. Who this is comes from the fresh access token the exchange just returned.
  const enveloped = await envelope(refreshed.refreshToken ?? refreshToken, tokenKey);
  const who = await ravelryWhoAmI(refreshed.accessToken);

  const stored = await fetch(`${url}/rest/v1/ravelry_connections`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      // Upsert on the primary key (user_id): reconnecting replaces the row rather than failing.
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      user_id: userId,
      refresh_token: enveloped,
      ravelry_user_id: who?.id ?? '',
      ravelry_username: who?.username ?? '',
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!stored.ok) {
    console.error('ravelry-connect could not store the token', stored.status, await stored.text().catch(() => ''));
    return json({ error: 'Your Ravelry connection could not be saved. Try again in a moment.' }, 502);
  }

  // The id and whether it worked; never the token, nor who on Ravelry it was.
  console.log(JSON.stringify({ event: 'ravelry-connect', ok: true }));
  return json({ ok: true, stored: true });
});
