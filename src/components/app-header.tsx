// Native counterpart to app-header.web.tsx. On iOS a pushed screen keeps the native stack header
// (with its back button) and the tab bar is deliberately out of the way, so there is no extra
// navigation to render here — neither the bar across the top nor the one along the bottom.
export default function AppHeader() {
  return null;
}

export function AppFooter() {
  return null;
}
