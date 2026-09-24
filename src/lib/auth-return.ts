import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { getSupabase } from '@/lib/supabase';

// Where Apple and Google send a knitter back to, and how the return is finished.
//
// The two platforms disagree about what "coming back" means, which is the only reason this is
// split. On the web the browser leaves Knitwit, visits Apple, and comes back to the same origin
// with a code in the URL — supabase-js reads it off `window.location` by itself. On a phone there
// is no `window.location` to come back to: the flow runs in a browser sheet on top of the app, and
// when the sheet closes the app has to take the code out of the returned URL and redeem it.
//
// This is the *web* OAuth flow in both cases, the one Apple's Services ID configures. It is
// deliberately not `expo-apple-authentication`: that path signs in with an identity token, and
// there is no id-token form of `linkIdentity()`, so it cannot attach Apple to the anonymous
// account a knitter already has — it would make a second account and strand the first.

// Native needs the URL back rather than a redirect it cannot perform.
export const skipBrowserRedirect = true;

// `createURL('/account')` can produce an empty authority — knitwit:///account, three slashes — and
// Supabase matches its redirect allow-list literally, character for character. A form that is not
// on the list is not refused; the redirect silently falls back to the project's Site URL instead.
// So this settles on one spelling rather than whichever the platform felt like emitting.
export function authReturnUrl(): string {
  return Linking.createURL('/account').replace(':///', '://');
}

export async function finishProviderFlow(url: string | null): Promise<void> {
  if (!url) throw new Error('no-url');

  const returnUrl = authReturnUrl();
  const result = await WebBrowser.openAuthSessionAsync(url, returnUrl);

  // Backing out is a decision, and nothing is said about it. Every *other* way of not succeeding
  // used to land here too, which is why a misconfigured redirect looked exactly like a knitter
  // changing their mind: the sheet closed, the app said nothing, and there was no thread to pull.
  if (result.type === 'cancel') throw new Error('cancelled');

  if (result.type !== 'success') {
    // The sheet closed without the app's own scheme ever coming back through it. Overwhelmingly
    // this means Supabase never redirected there — a redirect URL absent from the allow-list sends
    // the browser to the Site URL instead, where the sheet has nothing to catch and simply sits.
    throw new Error(`no-return:${returnUrl}`);
  }

  // Split on the first ? or # and read what follows, rather than handing the string to `new URL`.
  // The code arrives in the query under PKCE and in the fragment under the implicit flow, so both
  // have to be read — and a custom scheme like knitwit:// is not a URL every parser agrees about,
  // which is a poor thing to depend on when the failure mode is a knitter who cannot sign in.
  const marker = result.url.search(/[?#]/);
  const params = new URLSearchParams(marker >= 0 ? result.url.slice(marker + 1) : '');

  const refused = params.get('error_description') ?? params.get('error');
  if (refused) throw new Error(refused);

  const code = params.get('code');
  if (!code) {
    // The names of what came back, never the values: an implicit-flow fragment carries an access
    // token, and this string is put on screen. The names alone say which flow ran, which is the
    // whole question when a redirect returns successfully and carries nothing usable.
    const names = [...params.keys()].join(', ') || 'nothing at all';
    throw new Error(`no-code:${names}`);
  }

  const { error } = await getSupabase().auth.exchangeCodeForSession(code);
  if (error) throw new Error(error.message);
}

// Nothing to read: a phone never navigates away, so a refusal comes back through the sheet and is
// thrown by finishProviderFlow above rather than left on a URL.
export function providerReturnError(): string | null {
  return null;
}
