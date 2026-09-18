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

export function authReturnUrl(): string {
  return Linking.createURL('/account');
}

export async function finishProviderFlow(url: string | null): Promise<void> {
  if (!url) throw new Error('no-url');

  const result = await WebBrowser.openAuthSessionAsync(url, authReturnUrl());
  // Dismissed, cancelled, or swiped away. Not an error — the knitter changed their mind.
  if (result.type !== 'success') throw new Error('cancelled');

  const code = new URL(result.url).searchParams.get('code');
  if (!code) throw new Error('no-code');

  const { error } = await getSupabase().auth.exchangeCodeForSession(code);
  if (error) throw new Error(error.message);
}
