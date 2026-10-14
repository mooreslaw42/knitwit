// The userinfo endpoint for the `custom:ravelry` auth provider.
//
// Supabase Auth calls this — not the app, not a browser — straight after it has exchanged a Ravelry
// authorisation code for an access token, with that token as the bearer. It asks Ravelry who the
// token belongs to and answers in the shape Supabase expects. See claims.ts for why the reshaping
// is needed.
//
// Deployed with JWT verification off (config.toml): the bearer is Ravelry's token, not a Supabase
// one, so the gateway would refuse every call. That is safe because the function has nothing of its
// own to protect — it holds no secret and reads no database, and the only profile it can return is
// the one belonging to the token it was handed.
//
// Nothing about the knitter is logged: not the token, not the id, not the username.

import { ravelryClaims } from './claims.ts';

const CURRENT_USER = 'https://api.ravelry.com/current_user.json';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);

  const header = request.headers.get('Authorization') ?? '';
  if (!/^Bearer\s+\S+$/i.test(header)) return json({ error: 'missing_token' }, 401);

  let upstream: Response;
  try {
    upstream = await fetch(CURRENT_USER, {
      headers: { Authorization: header, Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    });
  } catch (error) {
    console.error('ravelry-userinfo: Ravelry unreachable', error instanceof Error ? error.name : 'unknown');
    return json({ error: 'upstream_unreachable' }, 502);
  }

  // A refused token stays refused. Passing 401/403 through means Supabase reports a failed
  // sign-in rather than creating anything.
  if (!upstream.ok) {
    console.error('ravelry-userinfo: Ravelry answered', upstream.status);
    const status = upstream.status === 401 || upstream.status === 403 ? upstream.status : 502;
    return json({ error: 'upstream_refused' }, status);
  }

  const claims = ravelryClaims(await upstream.json().catch(() => null));
  if (!claims) {
    console.error('ravelry-userinfo: no user id in Ravelry response');
    return json({ error: 'no_user_id' }, 502);
  }
  return json(claims);
});
