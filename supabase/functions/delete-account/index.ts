// Deleting an account, and everything behind it.
//
// This cannot be done from the app. A knitter can delete their own *rows* — the policies allow
// that — but not their own auth user, and an account with no rows is still an account: the email
// stays registered, the sign-in still works, and "delete my account" would have been a lie. Only
// the service role can remove the user, and the service role must never be in a client bundle.
// Hence a function.
//
// ## The order matters
//
// Storage first, then the user. Every table cascades from `auth.users`, so deleting the user takes
// the projects, patterns, stash, sections and settings with it — but `storage.objects` has no
// foreign key to auth.users and cascades from nothing. Delete the user first and the photographs
// are orphaned in the bucket for ever, belonging to an account id that no longer resolves to
// anybody, with nothing left that knows they should go.
//
// If the photographs fail to delete, the account is kept. A knitter told "your account is gone"
// while their photographs remain is the one outcome worth refusing outright; they can try again.

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

// Who is asking, according to the token they sent.
//
// Verified against the auth server rather than decoded here: a JWT's payload is only as trustworthy
// as its signature, and nothing else in this function checks one. The id that comes back is the
// only thing that decides whose account is destroyed, so it is the one value that cannot be taken
// on trust from the request.
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

// Everything under `{userId}/` in the photos bucket.
//
// Listed rather than assumed: the app knows which photographs it put there, but the app is not what
// is asking — and a deletion that only removes the photographs the client happened to remember is
// not a deletion.
async function deletePhotos(url: string, key: string, userId: string): Promise<void> {
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

  const listed = await fetch(`${url}/storage/v1/object/list/photos`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ prefix: `${userId}/`, limit: 1000 }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!listed.ok) throw new Error(`could not list photos: ${listed.status}`);

  const objects = (await listed.json()) as { name?: string }[];
  const names = objects.map((o) => o.name).filter((n): n is string => Boolean(n));
  if (names.length === 0) return;

  const removed = await fetch(`${url}/storage/v1/object/photos`, {
    method: 'DELETE',
    headers,
    body: JSON.stringify({ prefixes: names.map((n) => `${userId}/${n}`) }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!removed.ok) throw new Error(`could not delete photos: ${removed.status}`);
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!url || !serviceKey) {
    console.error('delete-account is not configured');
    return json({ error: 'Deleting an account is not set up on this server.' }, 503);
  }

  const userId = await callerId(request, url, anonKey);
  // No token, or one the auth server would not vouch for. Never guess.
  if (!userId) return json({ error: 'Sign in again and then try.' }, 401);

  try {
    await deletePhotos(url, serviceKey, userId);
  } catch (error) {
    console.error('delete-account could not clear photos', error);
    // Deliberately fails the whole thing. See the note at the top.
    return json({ error: 'Some of your pictures could not be removed, so nothing was deleted.' }, 502);
  }

  const removed = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!removed.ok) {
    console.error('delete-account could not remove the user', removed.status, await removed.text().catch(() => ''));
    return json({ error: 'Your account could not be deleted. Nothing has changed — try again.' }, 502);
  }

  // The id and nothing else. Whose account it was is not something to write into a log that
  // outlives it.
  console.log(JSON.stringify({ event: 'delete-account', ok: true, photos: 'cleared' }));
  return json({ ok: true });
});
