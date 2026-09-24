import type { Session, User } from '@supabase/supabase-js';

import {
  authReturnUrl,
  finishProviderFlow,
  providerReturnError,
  skipBrowserRedirect,
} from '@/lib/auth-return';
import { invokeEdgeFunction } from '@/lib/edge-function';
import { currentSession, ensureSession } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';

// Turning the account a knitter already has into one they can come back to.
//
// M6 of docs/plans/multi-user.md. Everyone already has an account — anonymous, made silently at
// first launch, holding everything. What it does not have is a way back in. Lose the device and the
// work is on a server nobody can reach, which is the opposite of the point.
//
// ## Upgrading, not signing up
//
// The common path attaches an email and password to the *existing* account, so the user id never
// changes and nothing moves. Verified against production: an anonymous account given an email keeps
// its id, flips `is_anonymous` to false, and signs back in later as the same person.
//
// Anything that creates a *new* user instead loses a knitter's whole stash at the exact moment they
// were trying to make it safer, so every path here is explicit about which of the two it is.

export type AccountState = {
  signedIn: boolean;
  // An account with no way back into it. True until an identity is attached.
  anonymous: boolean;
  email: string | null;
  // Which providers are attached, for showing what a knitter signed in with.
  providers: string[];
  userId: string | null;
};

export function accountStateOf(session: Session | null): AccountState {
  const user = session?.user;
  return {
    signedIn: Boolean(user),
    anonymous: user?.is_anonymous === true,
    email: user?.email ?? null,
    providers: identitiesOf(user),
    userId: user?.id ?? null,
  };
}

function identitiesOf(user: User | undefined): string[] {
  return (user?.identities ?? [])
    .map((identity) => identity.provider)
    .filter((provider) => provider !== 'anonymous');
}

export function currentAccount(): AccountState {
  return accountStateOf(currentSession().session);
}

export type AuthResult = { ok: true } | { ok: false; message: string };

// Making an account, by whichever of the two routes applies.
//
// ## Why this is not simply signUp
//
// Knitwit used to give everybody an anonymous account on first launch, and some devices still hold
// one with a knitter's whole stash inside it. For those, `signUp` would be the wrong call twice
// over: it makes a *second* user, and the first — holding every project — becomes unreachable,
// because an anonymous account has nothing to sign back in with.
//
// `updateUser` on the session already in hand keeps the same user id, so the work does not move.
// Verified against production: an anonymous account given an email keeps its id, flips
// `is_anonymous` to false, and signs back in later as the same person.
//
// So the branch is on what is actually here, not on what the screen asked for.
export async function createAccount(email: string, password: string): Promise<AuthResult> {
  const supabase = getSupabase();
  const existing = await ensureSession();

  // An anonymous session with somebody's knitting behind it. Upgrade it.
  if (existing && existing.user.is_anonymous) {
    const { error } = await supabase.auth.updateUser({ email: email.trim(), password });
    if (error) return { ok: false, message: readable(error.message) };
    return { ok: true };
  }

  const { error } = await supabase.auth.signUp({ email: email.trim(), password });
  if (error) return { ok: false, message: readable(error.message) };
  return { ok: true };
}

// The old name, kept because the Account screen still offers this to anyone who arrived on an
// anonymous session from before the wall.
export const saveAccount = createAccount;

// Signs into an account that already exists — a different one from the anonymous account on this
// device.
//
// The caller is responsible for warning first and for clearing what is local: the user id changes,
// so everything on this device belongs to the account being left behind. Doing that quietly would
// show one account's knitting under another's name.
export async function signInExisting(email: string, password: string): Promise<AuthResult> {
  const { error } = await getSupabase().auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) return { ok: false, message: readable(error.message) };
  return { ok: true };
}

// Apple and Google.
//
// `linkIdentity` on an account worth keeping, so the id survives; `signInWithOAuth` only when there
// is nothing to keep. Both need the provider configured in the Supabase dashboard with real
// credentials — there is nothing in the code that can stand in for that, and until it is done these
// return the provider's own complaint rather than pretending.
//
// `linkIdentity` also needs manual linking switched on for the project. It is off by default, and
// with it off this is not a partial success: the knitter signs in at Apple, comes back, and has a
// *second* account holding none of their knitting. `readable()` names that case specifically
// because the provider's own wording for it says nothing a knitter could act on.
export type ProviderIntent =
  // Attach this provider to the account already on the device, keeping its knitting. Only possible
  // on an anonymous account, and only if the provider is not already somebody else's way in.
  | 'keep-this-account'
  // Sign in to whichever account the provider belongs to. Anything on the device belongs to a
  // different account and is the caller's problem to deal with first.
  | 'sign-in';

export async function attachProvider(
  provider: 'apple' | 'google',
  intent: ProviderIntent = 'sign-in',
): Promise<AuthResult> {
  const account = currentAccount();
  const supabase = getSupabase();
  const options = { redirectTo: authReturnUrl(), skipBrowserRedirect };

  // Linking only when asked for it *and* possible. It used to be chosen purely on the session being
  // anonymous, which quietly turned a sign-in screen into an attach-to-this-device screen: pressing
  // Apple to get into an account you already have was answered with "that is already linked to a
  // different account", which is true, unhelpful, and not what the button said it would do.
  const link = intent === 'keep-this-account' && account.anonymous;

  const { data, error } = link
    ? await supabase.auth.linkIdentity({ provider, options })
    : await supabase.auth.signInWithOAuth({ provider, options });

  if (error) return { ok: false, message: readable(error.message) };

  // On the web this returns having already left the page. On a phone it opens the sheet and waits.
  try {
    await finishProviderFlow(data?.url ?? null);
  } catch (problem) {
    const reason = problem instanceof Error ? problem.message : '';
    if (reason === 'cancelled') return { ok: false, message: '' };
    return { ok: false, message: readable(reason) };
  }
  return { ok: true };
}

// What to say about a provider sign-in that came back refused.
//
// Called on arrival rather than awaited, because the failure outlived the call that caused it: the
// page navigated to Apple and back, so there is no promise left to reject. Returns null on the
// ordinary case of simply being on this screen.
export function describeProviderReturn(): string | null {
  const problem = providerReturnError();
  return problem === null ? null : readable(problem);
}

// Getting back into an account whose password is gone.
//
// This is not a convenience. With the sign-in wall up there is no anonymous fallback and no other
// door: a forgotten password is an account nobody can enter, with a knitter's whole stash still
// inside it. The only thing standing between them and that is this email.
//
// Deliberately says the same thing whether or not the address is registered. The alternative —
// "no account with that email" — is a free membership check for anybody who wants to know which of
// their guesses is somebody's real address, and it helps the knitter not at all, since the useful
// answer is the same either way: go and look in your inbox.
export async function requestPasswordReset(email: string): Promise<AuthResult> {
  const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), {
    redirectTo: authReturnUrl(),
  });
  // Logged rather than shown, for the reason above.
  if (error) console.warn('password reset request failed', error.message);
  return { ok: true };
}

// Setting the new one, once the link in the email has signed them in.
//
// Supabase turns a recovery link into a real session before this is reachable, which is what makes
// the plain `updateUser` enough — and also why the recovery screen must never be reachable any
// other way, since a session is a session and this would change the password of whoever holds one.
export async function setNewPassword(password: string): Promise<AuthResult> {
  const { error } = await getSupabase().auth.updateUser({ password });
  if (error) return { ok: false, message: readable(error.message) };
  return { ok: true };
}

// Deleting the account, for good.
//
// Through an Edge Function because it cannot be done from here: a knitter may delete their own rows
// but not their own auth user, and an account with no rows is still an account — the email stays
// registered and the sign-in still works. Only the service role can remove the user, and the
// service role must never reach a client bundle.
//
// The caller is responsible for clearing what is on the device afterwards. The server no longer
// knows this person, so a local copy left behind would sync nowhere and simply sit there looking
// like an account.
export async function deleteAccount(): Promise<AuthResult> {
  try {
    await invokeEdgeFunction(
      'delete-account',
      {},
      {
        timeoutMs: 60_000,
        timeoutMessage: 'That took too long. Nothing was deleted — try again in a moment.',
      },
    );
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Your account could not be deleted.',
    };
  }
  return { ok: true };
}

export async function signOut(): Promise<AuthResult> {
  const { error } = await getSupabase().auth.signOut();
  if (error) return { ok: false, message: readable(error.message) };
  return { ok: true };
}

// Supabase's messages are written for developers. These are the ones a knitter can actually meet.
//
// Exported so a screen catching a thrown error can say the same things as one reading a returned
// one — two vocabularies for the same failures would be two sets of wording to keep true.
export function readable(message: string): string {
  const text = message.toLowerCase();
  if (text.includes('already registered') || text.includes('already been registered')) {
    return 'That email already has a Knitwit account. Sign in to it instead.';
  }
  if (text.includes('invalid login')) return "That email and password don't match an account.";
  if (text.includes('new password should be different')) {
    return 'That is the password you already had. Choose a different one.';
  }
  if (text.includes('password')) return 'That password is too short — six characters or more.';
  if (text.includes('email')) return "That doesn't look like an email address.";
  if (text.includes('identity is already linked') || text.includes('already linked')) {
    return 'That Apple or Google account is already the way into a different Knitwit account. Sign in to that one instead.';
  }
  if (text.includes('manual linking')) {
    // The dangerous one, and the reason it is called out rather than folded into the fallback:
    // without manual linking a provider sign-in quietly makes a *second* account, and the knitting
    // stays behind on the first. Better to stop here than to succeed into the wrong account.
    return 'Signing in with Apple or Google is not switched on for Knitwit yet.';
  }
  if (text.includes('provider is not enabled') || text.includes('unsupported provider')) {
    return 'That way of signing in is not set up for Knitwit yet.';
  }
  // Apple said yes to the knitter and no to Knitwit: the code came back, and the key Supabase signs
  // its request with was refused. Nothing the knitter did, and nothing they can fix, so it says so
  // rather than inviting them to try again into the same wall.
  // knitwit.eu shipped without its Supabase credentials, so every button threw instead of
  // answering. Named here because "that did not work, try again" invites somebody to keep pressing
  // something that cannot work until it is fixed at our end.
  if (text.includes('missing expo_public_supabase')) {
    return 'Knitwit is not set up to sign anybody in here. That is a fault on our side, not yours.';
  }
  if (text.includes('unable to exchange external code')) {
    return 'Apple let you in, but would not finish. This is a setting on Knitwit’s side, not anything you did.';
  }
  // Carries the address the app expected to be sent back to, because that is the one value that
  // has to appear — spelled identically — in the project's redirect allow-list, and naming it turns
  // an unexplained dead end into something somebody can actually go and check.
  if (text.startsWith('no-return:')) {
    return `Apple did not send you back to Knitwit. The app was waiting at ${message.slice('no-return:'.length)}, and that address has to be listed in Knitwit's sign-in settings.`;
  }
  if (text.startsWith('no-code:')) {
    return `Apple came back, but without the code Knitwit needs. It carried: ${message.slice('no-code:'.length)}.`;
  }
  if (text === 'no-url' || text === 'no-code') {
    return 'Apple sent Knitwit back without an answer. Try again in a moment.';
  }
  return 'That did not work. Try again in a moment.';
}
