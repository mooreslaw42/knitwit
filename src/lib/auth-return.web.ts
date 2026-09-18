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
