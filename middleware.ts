import { next } from '@vercel/edge';

// Site-wide gate for the pre-launch web build.
//
// This is a *shared* password for everyone ("general login"), not per-user auth — it exists only
// to keep the beta off the open internet. Real per-user accounts come with Supabase Auth (Phase 4),
// at which point this file gets deleted.
//
// It runs at the edge on every request, so nothing (not even the JS bundle) is served without the
// password. Vercel's own Password Protection would do this too, but it's a Pro-plan feature, and
// Vercel Authentication only admits people who have a Vercel account with access to the project —
// neither works for sharing a Hobby-plan site with testers.
//
// The password comes from the SITE_PASSWORD env var in Vercel project settings. If it is unset the
// site stays open, so that local `expo export` previews and CI are not accidentally locked out.

export const config = {
  // Match everything except Vercel's internal paths.
  matcher: '/((?!_vercel/).*)',
};

export default function middleware(request: Request) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return next();

  const header = request.headers.get('authorization') ?? '';
  const expected = `Basic ${btoa(`knitwit:${password}`)}`;

  // Constant-time-ish compare: bail on length first, then diff every byte so the
  // comparison does not short-circuit on the first mismatching character.
  if (header.length === expected.length) {
    let diff = 0;
    for (let i = 0; i < expected.length; i++) {
      diff |= header.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    if (diff === 0) return next();
  }

  return new Response('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Knitwit — private beta", charset="UTF-8"',
      'Cache-Control': 'no-store',
    },
  });
}
