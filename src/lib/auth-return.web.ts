// The web half of auth-return.ts — see there for why this is split at all.
//
// Nothing here has to finish anything: the browser really does leave for Apple and really does come
// back, and supabase-js picks the code up off the URL on the way in. `onAuthStateChange` fires, the
// session watcher publishes it, and the account screen redraws having been signed in while it was
// not running.

// Let supabase-js perform the redirect. There is no sheet to manage.
export const skipBrowserRedirect = false;

export function authReturnUrl(): string {
  return `${window.location.origin}/account`;
}

export async function finishProviderFlow(_url: string | null): Promise<void> {
  // The page is already on its way to Apple.
}

// What Apple said on the way back, if it refused.
//
// A provider failure arrives as a redirect, not as a rejected promise: the browser left Knitwit,
// came back, and the only trace is `?error=…` on the URL. Nothing was awaiting it — the call that
// started the flow ended when the page navigated away — so unless this is read on arrival the
// knitter lands on the same screen they left, still signed out, with no account and no reason
// given. That is the worst version of this failing.
//
// Both halves are searched because the two flows put it in different places: the code exchange
// reports through the query string, the implicit flow through the fragment.
// The answer, remembered, because the question can only be asked once: reading it takes it off the
// URL, so a second caller would be told everything was fine.
let answer: string | null | undefined;

export function providerReturnError(): string | null {
  if (answer !== undefined) return answer;
  if (typeof window === 'undefined') return null;

  const query = new URLSearchParams(window.location.search);
  const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const description = query.get('error_description') ?? fragment.get('error_description');
  const code = query.get('error') ?? fragment.get('error');
  if (!description && !code) {
    answer = null;
    return answer;
  }

  // Taken off the URL. Left there it would reappear on every reload long after it stopped being
  // true, and would be carried into any link the knitter copied from the address bar.
  window.history.replaceState({}, '', window.location.pathname);

  answer = description ?? code;
  return answer;
}
