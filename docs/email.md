# Email

Knitwit sends two messages. Both are load-bearing and neither is marketing.

| | when | what breaks without it |
|---|---|---|
| **Confirm your address** | signing up | anybody can register an address that is not theirs, and the real owner finds their email taken by an account they cannot enter |
| **Set a new password** | "I have forgotten my password" | a forgotten password is an account nobody can open, with the knitting still inside it |

The second one used to be a convenience. Since the sign-in wall went up (`e7b3bc3`) there is no
anonymous account to fall back on and no other way in, so that email is the only route back.

## Why the built-in sender is not enough

Supabase ships a default SMTP sender for local development. It is rate-limited to a few messages an
hour and Supabase state plainly that it is not for production use. The failure is quiet and badly
timed: a knitter signs up, no email arrives, and they are left holding an unconfirmed account. At
the volumes friends-and-family testing produces it will work most of the time, which is worse than
failing outright.

## What to set up

**Knitwit uses TransIP**, the Dutch provider that also hosts the mail for pientr.com. Configured
and tested on 2026-09-24. Being in the Netherlands it keeps Knitwit's processors inside the EU,
which is the same reasoning behind Supabase's Irish region and GreenPT.

What follows is what was done, kept so it can be redone or moved.

**1. Verify the sending domain with the provider.** Knitwit sends as `knitwit@pientr.com`, so it is
**pientr.com** that needs verifying, not knitwit.eu — the provider gives you DNS records (SPF,
DKIM, usually a return-path CNAME) and they go wherever pientr.com's DNS lives. Without them the
mail is sent but lands in spam, which looks exactly like not being sent.

If you would rather send from knitwit.eu later, change `OPERATOR.email` in `src/lib/legal.ts` and
`admin_email` in `supabase/config.toml` together, and verify that domain instead. Sending from a
domain the provider has not verified is the usual reason reset emails silently never arrive.

**2. Put the credentials into Supabase**, at
**Project Settings → Authentication → SMTP Settings**:

| field | value |
|---|---|
| Sender email | `knitwit@pientr.com` |
| Sender name | `Knitwit` |
| Host / Port / Username / Password | from the provider |

Enable it, and save.

**3. Turn on confirmations**, at **Authentication → Providers → Email**: switch on *Confirm email*.
Do this **after** SMTP works, not before — confirmations without a working sender means nobody can
complete a sign-up.

**4. Check the redirect allow-list.** Both emails send the knitter back to the app, so
**Authentication → URL Configuration → Redirect URLs** needs `https://knitwit.eu/account`,
`http://localhost:8081/account`, `knitwit://account` and `knitwit:///account`.

## Locally

`supabase/config.toml` carries the same settings with `enabled = false`. The password is read from
the environment and is deliberately not written into the file — filling it in would put a working
credential into the repository, where it would sit in every clone and every fork for ever.

To run the local stack against a real sender, set `SMTP_HOST`, `SMTP_USER` and `SMTP_PASS` in
`.env` and flip `enabled` to `true`. Left off, local Supabase catches the mail in Inbucket, which
is the right answer for development: the message is visible and nobody is charged for it.

## How to know it works

Sign up with an address you can read, and confirm it arrives. Then use "I have forgotten my
password" on the sign-in screen, follow the link, and check that you land on **Choose a new
password** rather than in the app. Landing in the app means the recovery flag is not being read and
the reset has not actually happened — see `src/lib/session.ts`.
