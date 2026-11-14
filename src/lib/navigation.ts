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

// From a pushed screen, to the counter.
//
// The counter is a tab, and a pushed screen sits on top of the tabs. `router.push('/counter')`
// from there does not switch tab: it pushes a second copy of the whole tab navigator on top of
// the screen you were on. It looks right for a moment — the counter appears — but the tab bar
// slides in as part of a new screen, its other four tabs are fresh instances with their scroll and
// filters gone, swiping back lands on the project again, and every lap of project → Continue
// stacks another set of tabs.
//
// `dismissTo` goes back down to the tabs that are already there and shows the counter in them. If
// there are none underneath — the screen was opened cold from a link — it replaces the screen
// with them instead.
export function goToCounter(router: Router) {
  router.dismissTo('/counter');
}
