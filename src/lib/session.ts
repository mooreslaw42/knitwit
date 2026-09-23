import type { Session } from '@supabase/supabase-js';

import { getSupabase } from '@/lib/supabase';

// Who is signed in.
//
// ## This used to make an account for you, and no longer does
//
// M1 established an identity silently: Supabase's anonymous sign-in, on first launch, so a knitter
// counting a row never met a form. That was a deliberate choice and it has been reversed just as
// deliberately — Knitwit now asks people to sign in before they reach the app. See
// sign-in-gate.tsx for the wall and what it costs.
//
// What survives is the upgrade path. An anonymous account made before the wall went up still holds
// somebody's knitting, and `updateUser` turns it into a real one without changing the user id, so
// nothing moves and nothing is lost. That path is reached from the gate, not from here.
//
// ## Restoring, not creating
//
// This only ever brings back a session that already exists — from storage, refreshed if stale. It
// never mints one. Everything that calls it (sync, photos, the engine) is asking "is anybody signed
// in", and behind a wall the honest answer for a signed-out device is no.

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

// The session, if there is one. Never creates one.
//
// Safe to call repeatedly and from anywhere: a stored session is reused, a request in flight is
// joined rather than duplicated.
export async function ensureSession(): Promise<Session | null> {
  if (state.session) return state.session;
  if (attempt) return attempt;

  attempt = (async () => {
    try {
      const supabase = getSupabase();

      // supabase-js refreshes an expired token itself, so this is the common path on every launch
      // after signing in, and it costs no round trip while the token is still good. Offline it
      // returns the stored session unrefreshed, which is what keeps the app usable on a train.
      const { data: existing } = await supabase.auth.getSession();
      publish({ session: existing.session ?? null, settled: true });
      return existing.session ?? null;
    } catch (error) {
      // Unconfigured, unreachable, or storage unreadable. All the same answer: nobody is signed in.
      console.warn('no session available', error);
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
//
// Guarded, because the promise at the top of this file — that none of it can stop the app — was
// only half kept. `ensureSession` caught everything; this did not, and `getSupabase()` throws
// outright when the project is not configured. An iOS build that shipped without its Supabase
// credentials therefore did not fall back to working locally, it crashed on launch, before a
// knitter had seen a single row.
//
// A knitter with no account and no signal must still be able to count. That is the whole point,
// and it has to hold on the path where the backend is missing entirely, not only on the path where
// it is reachable and says no.
export function watchSession(): () => void {
  try {
    const { data } = getSupabase().auth.onAuthStateChange((_event, session) => {
      publish({ session, settled: true });
    });
    return () => data.subscription.unsubscribe();
  } catch (error) {
    // Settled with no session: the difference between "not asked yet" and "asked, no account" is
    // what sync reads to decide whether to wait, and it must not wait for one that cannot come.
    console.warn('sessions unavailable', error);
    publish({ session: null, settled: true });
    return () => {};
  }
}
