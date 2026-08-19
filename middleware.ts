import { next } from '@vercel/edge';

// Site-wide gate for the pre-launch web build.
//
// This is a *shared* password for everyone ("general login"), not per-user auth — it exists only
// to keep the beta off the open internet. Real per-user accounts come with Supabase Auth (Phase 4),
// at which point this whole file gets deleted.
//
// It runs at the edge on every request, so nothing (not even the JS bundle) is served without the
// password. Vercel's own Password Protection would do this too, but it's a Pro-plan feature, and
// Vercel Authentication only admits people who already have a Vercel account on the project —
// neither works for sharing a Hobby-plan site with testers.
//
// Note: this serves its own HTML login form rather than using HTTP Basic Auth, because Vercel
// strips the WWW-Authenticate header from middleware responses, so a browser would never show the
// native credentials prompt.
//
// The password comes from the SITE_PASSWORD env var in Vercel project settings. If it is unset the
// site stays open, so local `expo export` previews and CI are not accidentally locked out.

const COOKIE_NAME = 'knitwit_gate';
const GATE_PATH = '/__gate';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export const config = {
  // Everything except Vercel's internal paths.
  matcher: '/((?!_vercel/).*)',
};

// The cookie holds a hash of the password, never the password itself, so a leaked cookie
// does not hand over the password (which is shared, and likely reused elsewhere).
async function passwordToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`knitwit-gate:v1:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Compare without short-circuiting on the first differing byte.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

function loginPage(status: number, message?: string): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Knitwit — private beta</title>
<style>
  :root { --cream:#FDF6EF; --cream-deep:#F7EBDD; --blush-deep:#E58AA0; --ink:#4A3B38; --ink-soft:#8A7873; --white:#fff; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         background:var(--cream); color:var(--ink); padding:24px;
         font-family: ui-rounded, "Nunito", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  .card { background:var(--white); border-radius:24px; padding:32px 28px; width:100%; max-width:360px;
          box-shadow:0 20px 40px -18px rgba(74,59,56,.35); text-align:center; }
  h1 { font-size:22px; margin:0 0 6px; }
  p { font-size:14px; color:var(--ink-soft); margin:0 0 20px; line-height:1.45; }
  input { width:100%; padding:14px 16px; font-size:16px; font-family:inherit; color:var(--ink);
          background:var(--cream); border:none; border-radius:14px; margin-bottom:12px; }
  input:focus { outline:2px solid var(--blush-deep); }
  button { width:100%; padding:14px 16px; font-size:15px; font-weight:700; font-family:inherit;
           color:var(--white); background:var(--blush-deep); border:none; border-radius:999px; cursor:pointer; }
  button:hover { opacity:.9; }
  .err { color:#DE7C46; font-size:13px; font-weight:700; margin:0 0 12px; }
</style>
</head>
<body>
  <div class="card">
    <h1>🧶 Knitwit</h1>
    <p>This is a private beta. Enter the access password to continue.</p>
    ${message ? `<p class="err">${message}</p>` : ''}
    <form method="POST" action="${GATE_PATH}">
      <input type="password" name="password" placeholder="Access password" autofocus required
             autocomplete="current-password">
      <button type="submit">Enter</button>
    </form>
  </div>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex',
    },
  });
}

export default async function middleware(request: Request) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return next();

  const expected = await passwordToken(password);
  const url = new URL(request.url);

  // Handle a login submission. The body is parsed as URL-encoded text rather than via
  // request.formData(), because this repo's tsconfig types FormData as React Native's
  // version, which has no .get().
  if (request.method === 'POST' && url.pathname === GATE_PATH) {
    const body = await request.text();
    const submitted = new URLSearchParams(body).get('password') ?? '';
    if (submitted !== password) {
      return loginPage(401, 'That password is not right.');
    }
    return new Response(null, {
      status: 303,
      headers: {
        location: '/',
        'cache-control': 'no-store',
        'set-cookie': `${COOKIE_NAME}=${expected}; Path=/; Max-Age=${MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Lax`,
      },
    });
  }

  const cookie = readCookie(request, COOKIE_NAME);
  if (cookie && safeEqual(cookie, expected)) return next();

  return loginPage(401);
}
