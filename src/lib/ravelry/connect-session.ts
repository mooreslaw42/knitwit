import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

import { invokeEdgeFunction } from '@/lib/edge-function';

// Catching the Ravelry refresh token on its way past.
//
// Supabase hands over `provider_refresh_token` on the SIGNED_IN that follows a Ravelry sign-in or
// connect. The session watcher sees it, so this is the hook: send it to ravelry-connect to be stored
// server-side, where an import can use it later. See docs/plans/ravelry-import.md, Phase 0.
//
// ## Only on SIGNED_IN, and that is not a nicety
//
// supabase-js *persists* the session, provider_refresh_token and all, and replays it on every
// INITIAL_SESSION — which is what fires on an ordinary page reload. But Ravelry's refresh tokens are
// single-use: the server rotates the stored one on each import and keeps the new one. Re-sending the
// persisted original on a reload would overwrite that rotated token with a spent one and kill the
// connection — exactly the failure seen in the first live test. So this captures *only* on the
// genuine sign-in event, never on a restore.
//
// Fire-and-forget on purpose. The session has to publish whether or not this succeeds — a knitter
// signing in must reach the app regardless — and a failed send only means they reconnect once more
// another day. So it never blocks, never throws, and is not awaited.
export function captureRavelryToken(event: AuthChangeEvent, session: Session | null): void {
  if (event !== 'SIGNED_IN') return;

  const refreshToken = session?.provider_refresh_token;
  if (!refreshToken) return;

  const hasRavelry = (session?.user.identities ?? []).some(
    (identity) => identity.provider === 'custom:ravelry',
  );
  if (!hasRavelry) return;

  void invokeEdgeFunction(
    'ravelry-connect',
    { refresh_token: refreshToken, access_token: session?.provider_token ?? undefined },
    // Nobody reads these two — the catch below logs and moves on — but the default would have said
    // "couldn't reach the pattern reader", which is a confusing thing to find in a log about Ravelry.
    {
      timeoutMs: 10_000,
      timeoutMessage: 'Ravelry connect timed out.',
      failureMessage: "Couldn't reach Ravelry connect.",
    },
  ).catch((error) => {
    // Logged, not surfaced: there is no screen waiting on this and nothing a knitter could do about
    // it. The connection simply is not saved yet, and the next Ravelry sign-in tries again.
    console.warn('could not store the Ravelry connection', error);
  });
}
