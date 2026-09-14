import { useEffect } from 'react';

export const SITE_NAME = 'Knitwit';

// Naming the page, on the web build.
//
// Every route had `document.title === ''`, so the browser tab read "localhost:8081/projects", a
// bookmark saved with no name and a shared link previewed as nothing. The Stack screens set
// `title: ''` on purpose — to keep the native header bar bare — and that empty string is what
// reached the document.
//
// Set here rather than through the navigator so it works the same in the tab group, which is
// expo-router/ui rather than a Stack and never sees those options at all.
export function usePageTitle(title?: string): void {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE_NAME}` : SITE_NAME;
  }, [title]);
}
