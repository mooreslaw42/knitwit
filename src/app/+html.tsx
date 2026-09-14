import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

import { Colors } from '@/constants/theme';

// The HTML shell every web page is rendered into. Static — it is used at build time, so nothing
// here can depend on the app's state.
//
// Only the head matters. The body is React Native Web's business.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/* What a link to Knitwit looks like when it is pasted somewhere. There was nothing here
            at all, so a shared link previewed as a bare URL. */}
        <meta
          name="description"
          content="A knitting and crochet companion: row counter, pattern library, project tracker and gauge calculator."
        />
        <meta name="theme-color" content={Colors.cream} />

        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Knitwit" />
        <meta property="og:title" content="Knitwit" />
        <meta
          property="og:description"
          content="A knitting and crochet companion: row counter, pattern library, project tracker and gauge calculator."
        />
        <meta name="twitter:card" content="summary" />

        {/* Disables body scrolling on web so ScrollView components behave as they do on native.
            Remove it and the page scrolls underneath every scroll view in the app. */}
        <ScrollViewStyleReset />

        {/* The page background, set before React mounts. Without it a slow load flashes white,
            and so does overscroll at the top and bottom of a page. */}
        <style dangerouslySetInnerHTML={{ __html: backgroundStyle }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const backgroundStyle = `
body, html { background-color: ${Colors.cream}; }
`;
