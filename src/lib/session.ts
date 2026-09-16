import type { Session } from '@supabase/supabase-js';

import { getSupabase } from '@/lib/supabase';

// Having an account, without being asked for one.
//
// M1 of docs/plans/multi-user.md. Nothing syncs yet — this establishes the identity that syncing
// will hang off, and does it quietly. A knitter opening Knitwit to count a row should not meet a
// sign-up form, and today they do not have to: Supabase's anonymous sign-in makes a real account
// with a real user id and no personal information in it at all.
//
// The important consequence is that signing in later is an *upgrade*, not a migration.
// `linkIdentity()` attaches Apple or Google to the same account, so the id does not change and
// nothing has to be moved. Putting a wall up first and asking people to carry their data across it
// would be the alternative, and it is much worse.
//
// ## This must never block the app
//
// Knitwit works with no network and that does not change. A failed sign-in means no session, and no
// session means the app behaves exactly as it did before any of this existed: entirely local. The
// counter does not wait for a token.

type SessionState = {
  session: Session | null;
  // False until the first attempt has finished, successfully or not. Sync uses this to know the
  // difference between "no account" and "not yet asked".
  settled: boolean;
};

let state: SessionState = { session: null, settled: false };
const listeners = new Set<(s: SessionState) => void>();
// One in-flight attempt at a time. Two screens mounting at once must not create two accounts.
let attempt: Promise<Session | null> | null = null;

function publish(next: SessionState): void {
  state = next;
  for (const listener of listeners) listener(state);
}

export function currentSession(): SessionState {
  return state;
}

export function currentUserId(): string | null {
  return state.session?.user.id ?? null;
}

export function onSessionChange(listener: (s: SessionState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Returns the session, creating an anonymous account if there is not one yet.
//
// Safe to call repeatedly and from anywhere: a stored session is reused, a request in flight is
// joined rather than duplicated.
export async function ensureSession(): Promise<Session | null> {
  if (state.session) return state.session;
  if (attempt) return attempt;

  attempt = (async () => {
    try {
      const supabase = getSupabase();

      // Restored from storage first. supabase-js refreshes an expired token itself, so this is the
      // common path on every launch after the first and it costs no round trip when valid.
      const { data: existing } = await supabase.auth.getSession();
      if (existing.session) {
        publish({ session: existing.session, settled: true });
        return existing.session;
      }

      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) {
        // Offline, rate-limited (30 an hour per address), or anonymous sign-in turned off. All of
        // them mean the same thing here: carry on locally and try again next launch.
        console.warn('anonymous sign-in unavailable', error.message);
        publish({ session: null, settled: true });
        return null;
      }

      publish({ session: data.session, settled: true });
      return data.session;
    } catch (error) {
      console.warn('anonymous sign-in failed', error);
      publish({ session: null, settled: true });
      return null;
    } finally {
      attempt = null;
    }
  })();

  return attempt;
}

// Keeps the local view in step with supabase-js, which refreshes tokens on its own schedule and can
// end a session without anybody asking it to.
export function watchSession(): () => void {
  const { data } = getSupabase().auth.onAuthStateChange((_event, session) => {
    publish({ session, settled: true });
  });
  return () => data.subscription.unsubscribe();
}
