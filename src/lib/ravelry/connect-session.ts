import type { Session } from '@supabase/supabase-js';

import { invokeEdgeFunction } from '@/lib/edge-function';

// Catching the Ravelry refresh token on its way past.
//
// Supabase puts `provider_refresh_token` on the session exactly once — on the SIGNED_IN event that
// follows a Ravelry sign-in or connect — and keeps it nowhere. The session watcher sees that event
// for every provider, so this is the hook: when the passing session carries a Ravelry refresh token,
// send it to ravelry-connect to be stored server-side, where an import can use it later. See
// docs/plans/ravelry-import.md, Phase 0.
//
// Fire-and-forget on purpose. The session has to publish whether or not this succeeds — a knitter
// signing in must reach the app regardless — and a failed send only means they reconnect once more
// another day. So it never blocks, never throws, and is not awaited.
export function captureRavelryToken(session: Session | null): void {
  const refreshToken = session?.provider_refresh_token;
  // Present only right after the OAuth round trip; absent on ordinary token refreshes, which is what
  // keeps this from firing on every session the watcher sees.
  if (!refreshToken) return;

  const hasRavelry = (session?.user.identities ?? []).some(
    (identity) => identity.provider === 'custom:ravelry',
  );
  if (!hasRavelry) return;

  void invokeEdgeFunction(
    'ravelry-connect',
    { refresh_token: refreshToken, access_token: session?.provider_token ?? undefined },
    { timeoutMs: 10_000, timeoutMessage: '' },
  ).catch((error) => {
    // Logged, not surfaced: there is no screen waiting on this and nothing a knitter could do about
    // it. The connection simply is not saved yet, and the next Ravelry sign-in tries again.
    console.warn('could not store the Ravelry connection', error);
  });
}
