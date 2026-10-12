import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

// Root HTML for the static web build (web only — never runs on iOS/Android).
// Adds favicons, the PWA manifest, theme colour and link-preview tags.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        <link rel="icon" href="/favicon.ico" sizes="48x48" />
        <link rel="icon" href="/brand/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/brand/apple-touch-icon.png" />
        <link rel="manifest" href="/brand/site.webmanifest" />
        <meta name="theme-color" content="#FDF6EF" />
        <meta name="apple-mobile-web-app-title" content="Knitwit" />

        <meta property="og:site_name" content="Knitwit" />
        <meta property="og:title" content="Knitwit" />
        <meta property="og:description" content="Your cozy knitting & crochet companion." />
        <meta property="og:image" content="https://knitwit.eu/brand/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />

        <ScrollViewStyleReset />
        {/* Paint the cream background before JS loads, so there's no white flash. */}
        <style dangerouslySetInnerHTML={{ __html: 'body{background-color:#FDF6EF;}' }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
