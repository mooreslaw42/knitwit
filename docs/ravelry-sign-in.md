# Ravelry sign-in

Status: **built, not yet live.** The app has a Ravelry button on the sign-in screen and a
"Connect Ravelry" button on the Account screen. Neither does anything until the provider below is
created and enabled on the project.

## The rule: a Ravelry account always gets an email

Decided 2026-10-13. Ravelry exposes no email address, so an account it creates has one way in, and
it is a way Knitwit does not control. Lose the Ravelry login and the knitting is unreachable — the
same problem the sign-in wall was built to end.

So:

- **Signing in with a Ravelry login that is already connected** to a Knitwit account goes straight
  in. That account has its email already.
- **Signing in with a new Ravelry login** creates the account and then stops at
  `src/components/add-email-gate.tsx`, before the app, until the knitter has given an address *and
  followed the link* in the confirmation email. `accountStateOf().needsEmail` is what holds them.
- **If the address already has a Knitwit account**, the knitter is offered to go to that one. The
  new, empty Ravelry account is deleted (through `delete-account`), which frees the Ravelry login to
  be connected to the existing account from its Account screen.
- **"Not now — sign out"** leaves the account where it is. Signing in with Ravelry again comes back
  to the same question; it does not make a second account.

Enforced in the app, not on the server, on purpose. The thing being prevented is a knitter
*accidentally* ending up with an account they cannot recover, and that can only happen through the
app. Somebody calling the API by hand to skip the gate is not a knitter at risk.

Once the address is confirmed, Supabase adds an email identity to the account, so "I have forgotten
my password" works for it like for anybody else.

## How it works

Supabase's custom OAuth2 provider (`custom:ravelry`) does the work: the redirect to Ravelry, PKCE,
the code exchange, the session, and `linkIdentity`. One thing it cannot do is read Ravelry's
profile response, so its userinfo URL points at a small adapter instead of at Ravelry.

```
app ── signInWithOAuth / linkIdentity({ provider: 'custom:ravelry' }) ──▶ Supabase Auth
Supabase Auth ──▶ www.ravelry.com/oauth2/auth ──▶ …/auth/v1/callback
Supabase Auth ── code exchange (client id + secret, Basic auth) ──▶ www.ravelry.com/oauth2/token
Supabase Auth ── Bearer <ravelry token> ──▶ functions/v1/ravelry-userinfo ──▶ api.ravelry.com/current_user.json
```

### Checked against Supabase Auth's source (supabase/auth, HEAD of 2026-09-22)

- **Basic auth at the token endpoint — fine.** The custom provider leaves `golang.org/x/oauth2` on
  `AuthStyleAutoDetect`, which sends credentials in the `Authorization` header first. Ravelry
  accepts only that.
- **Nested userinfo — not fine, hence the adapter.** `/current_user.json` returns
  `{ "user": { "id": … } }`. Supabase parses the response into its fixed claims struct, which has no
  `user` field, and `attribute_mapping` only maps between top-level keys of that struct. So `sub`
  is always empty, and every sign-in fails with "error missing provider id". It fails closed — no
  accounts get merged — but it never works. `ravelry-userinfo` lifts `user.id` to `sub`.
- **No email.** Without `email_optional`, the callback fails *before* it looks at whether the
  Ravelry identity is already linked — so it would break linking and returning sign-ins too, not
  just new accounts. `email_optional` therefore has to be on, whatever rule we choose below.
- **Custom providers are not in `config.toml`.** The CLI has no section for them; they are created
  in the dashboard or through the Admin API, per project.
- **Local development cannot use it.** Supabase refuses a userinfo URL on localhost, and Ravelry
  would need the local callback registered. Test against the hosted project.

## Setting it up on a project

1. Deploy the adapter. `verify_jwt = false` comes from `config.toml`:

   ```bash
   supabase functions deploy ravelry-userinfo --project-ref uuigzaazwsvgprfjrjtf
   ```

2. Dashboard → Authentication → Sign In / Providers → **New provider** → *Manual configuration*
   (OAuth2):

   | Field | Value |
   |---|---|
   | Identifier | `custom:ravelry` |
   | Name | `Ravelry` |
   | Client ID | from the Ravelry app (Pro account → Apps) |
   | Client secret | from the Ravelry app — paste it here and nowhere else |
   | Authorization URL | `https://www.ravelry.com/oauth2/auth` |
   | Token URL | `https://www.ravelry.com/oauth2/token` |
   | UserInfo URL | `https://uuigzaazwsvgprfjrjtf.supabase.co/functions/v1/ravelry-userinfo` |
   | Scopes | `profile-only offline` — two entries |
   | Email optional | **on** (see above) |
   | PKCE | on (default). If Ravelry rejects the authorisation request, turn it off. |
   | Enabled | **off** until this branch is live on knitwit.eu — see below |

3. The form shows a read-only callback URL. It must match the redirect URI registered on the
   Ravelry app exactly: `https://uuigzaazwsvgprfjrjtf.supabase.co/auth/v1/callback`.

4. Test from a browser console on the deployed site, or any page with the client:

   ```js
   await supabase.auth.signInWithOAuth({
     provider: 'custom:ravelry',
     options: { redirectTo: 'https://knitwit.eu/account' },
   });
   ```

   Then check Authentication → Users: one user, an identity with provider `custom:ravelry` and a
   numeric `provider_id`, no email. Delete the test user afterwards.

5. Fix the **Change email address** template (Authentication → Emails). That is the message a
   Ravelry knitter gets — not "Confirm signup" — and Supabase's default reads "confirm the update of
   your email from {{ .Email }} to {{ .NewEmail }}", which with no old address comes out as "from
   to you@example.com". Something like: *"Confirm this is your address so you can always get back
   into Knitwit"*, with the `{{ .ConfirmationURL }}` link.

### Why "Enabled" waits for the app

`/auth/v1/authorize?provider=custom:ravelry` is public. Enabled before the email gate is deployed,
anyone with a Ravelry account could make an email-less Knitwit account by visiting that URL and walk
straight into the app. Deploy the app first, then enable it: until then the Ravelry buttons say
"That way of signing in is not set up for Knitwit yet" and do nothing else.

Phone builds already on TestFlight are safe either way: they have no Ravelry button, and an account
with no email and no password has nothing they could sign in to it with.

## The `offline` scope

Requested from the start (decided 2026-10-13), so reading a knitter's library or stash later does
not send everybody back through Ravelry's consent screen.

Requesting it is not the same as keeping it. Supabase hands Ravelry's tokens to the app **once**,
as `provider_token` and `provider_refresh_token` on the session that comes back from sign-in or
linking, and stores neither. Nothing captures them yet. Whatever first reads Ravelry data on a
knitter's behalf has to save the refresh token server-side at that moment — and knitters who
connected before then will need to connect once more, though Ravelry will not ask them to consent
again.

## Known loose ends

- **Abandoned sign-ups.** Somebody who signs in with Ravelry and closes the app at the email step
  leaves an empty account with no address. Harmless, and they come back to it next time. A
  scheduled clean-up of never-confirmed, email-less accounts older than a month would tidy them.
- **The confirmation link on a phone** opens in the browser, not in Knitwit. The change is applied
  either way; the app notices when it comes back to the foreground, or when the knitter presses
  "I have opened the link".
- **OAuth 2.1.** Ravelry's docs schedule it for Q4 2026. PKCE is already on, which is the main
   thing 2.1 requires; re-test when Ravelry announces the switch.
