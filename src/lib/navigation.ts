import type { useRouter } from 'expo-router';

type Router = ReturnType<typeof useRouter>;

// Go back, or fall through to a sensible screen when there is nothing to go back to.
//
// Plain router.back() throws "The action 'GO_BACK' was not handled by any navigator" whenever a
// screen is opened without history — a deep link, a shared URL, or a hard refresh on web, all of
// which are ordinary on the web build. That left the user stranded on the form after saving.
export function goBackOr(router: Router, fallback: Parameters<Router['replace']>[0]) {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback);
  }
}
