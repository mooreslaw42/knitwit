// Naming the page. A no-op on native, where the screen header already says where you are and
// there is no browser tab, no bookmark and no history entry to label.
//
// See use-page-title.web.ts for the half that does the work.
export function usePageTitle(_title?: string): void {}
