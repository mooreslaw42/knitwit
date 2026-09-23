# Knitwit — accounts, sync, and signing in

**Status: M1–M6 built and running against production, on the web and on iOS.** Rewritten
2026-09-16 after the first five milestones; amended 2026-09-23, when the fourth founding choice was
reversed.

Three of the four choices still frame the whole thing:

- **Local-first with row-level sync.** The app keeps working with no network; Postgres is the
  durable truth; reconciliation happens per entity, never per blob.
- **Two devices from day one.** Conflict handling is real work, not a later retrofit.
- **Patterns may become shareable one day.** Projects and stash never do.

### The fourth choice, reversed

> ~~**Nobody is asked to sign up.** Knitters get an account silently and keep their data.~~

**Knitters now sign in before they reach the app** (`e7b3bc3`). Anonymous sign-in is no longer
called; `src/components/sign-in-gate.tsx` is the door.

This was a deliberate reversal of a deliberate choice, so both halves are worth keeping. The
original reasoning was that somebody opening a knitting app to count a row should not meet a form,
and that signing in later could then be an *upgrade* rather than a migration. That reasoning was
sound and the machinery it produced is still here and still load-bearing.

What it cost: a new knitter cannot use Knitwit without a network at all — there is no local-only
mode behind the door, and the counter really does wait for a token now. Somebody already signed in
is unaffected, because the session is restored from storage and only refreshed when there is
something to refresh against.

What survives, and must: **an anonymous account made before the door went up still holds somebody's
knitting.** Creating an account from the gate calls `updateUser` when such a session is present, not
`signUp` — same user id, nothing moves. `signUp` there would mint a second user and strand the
first for ever, since an anonymous account has nothing to sign back in with. That branch is in
`createAccount` and it is the one with tests on it.

## What is built

### M1 — Accounts and a schema (`641623e`)

Twelve tables. Identity, ownership, timestamps and deletion are columns because the database has to
reason about them; the payload is JSONB because only the app does — a column per field would mean a
migration every time a yarn gains an attribute.

The primary key is `(user_id, id)`. Ids come from the client, because a knitter makes a section on a
train, and they are unique *per knitter* rather than globally: the seed ships the same `m1` and
`proj1` to everybody, so a global key would have the second person to sync collide with the first.

Verified against production, not assumed: a client sending `updated_at` of 2099 is stored as *now*;
a second account sees `[]` where the first sees its rows; writing a row owned by somebody else is
refused 403; signing up creates a profile and a free subscription by trigger.

### M2 — The sync engine (`0800df7`)

An outbox makes offline real: a write lands in the store *and* in a persisted set of what has not
been sent. It records **which** things changed, never **how** — five edits on a train are one entry,
and the push sends whatever the store says when it runs.

Who wins is decided by the outbox, not by a clock. A row waiting to be sent is newer than anything
the server has, because the server has not heard of it. Comparing timestamps across devices means
trusting their clocks; **push order is a fact, wall time is a claim.**

Deletes travel as tombstones. A row simply absent is indistinguishable from one this device has not
seen yet, so a delete made offline would come straight back on the next pull.

### M3 — Everything else, counter included (`ebc9b05`)

Nine entities, in an order that is load-bearing: parents before children, because a section arriving
for a project this device has never seen has nowhere to go. A section whose parent is still missing
is **held aside rather than dropped** — the watermark moves on regardless, so dropping it would lose
it for good.

Sections are nested locally and flat on the server, with the parent and ordering as **real columns**:
a foreign key cannot point inside JSONB and neither can a useful index.

### M4 — Photos in Storage (`e57353a`)

A private bucket keyed `{user_id}/{photo_id}.jpg`, owner-only on every verb. Not public: a public
bucket means anyone holding a URL can read the object, and photo ids, while random, are not secrets.

The device keeps its copy — Storage is where photos live, local is a cache that happens to be
written first, which is what lets a stash scroll on a train. Gaps fill lazily, when something
actually draws the photo.

### M5 — The spend cap follows the account (`f440d07`)

The Edge Function identifies the caller from their token — verified, not decoded, because a JWT's
payload is only as trustworthy as its signature — and asks the database what they are entitled to.
The limit lives in SQL beside `plan_for`, not as a number in the function: two definitions of what
somebody may spend drift apart, and the one that drifts is the one nobody is looking at.

| | daily units |
|---|---|
| anonymous | 60 |
| signed in (free) | 150 |
| pro | 1500 |
| everyone, combined | 2000 |

Anonymous gets less deliberately: those accounts cost nothing to make, so an allowance attached to
one can be minted again by clearing storage.

## The three merge rules

1. **Descriptions — last write wins.** Names, notes, colours, settings. Someone renamed it; the
   rename stands.

2. **Counters — the larger, never the older.** `seconds` on a section, and everything in
   `Achievements`, which says of itself that nothing there ever decreases.

   **Built as max(), not as a sum — a correction to what this plan first promised.** Adding is what
   a knitter would expect and it cannot be done with two numbers: both devices started from the same
   total, and nothing in "500 here, 520 there" distinguishes shared history from new work. Twenty
   minutes on a phone and ten on a laptop with no sync between reads as twenty, not thirty.

   Doing it properly needs a per-device counter, which changes the stored shape of every counter in
   the app. Worth doing when somebody actually knits on two devices in a day. What max() buys
   meanwhile is real: a count never goes backwards and the larger contribution is never lost.
   Last-write-wins fails both.

3. **The row count — last write wins, deliberately.** Max() is tempting and wrong: a knitter who
   frogs back to row 10 on their phone would have row 40 restored from a stale laptop.

   The failure that remains, stated rather than hidden: counting the **same section on two devices
   at once** resolves to whichever synced last, and the other device's taps are lost. An operation
   log would fix it. Not worth the machinery for a knitter with one pair of hands.

### M6 — Signing in (`d64b1f7`, `c7b45ee`, `e7b3bc3`)

Built. Anonymous accounts already existed and already held everything; this attached a real identity
to one so it survives a lost phone, and then — see above — became the only way in.

**Apple works end to end on the web**, through the Services ID `com.pientr.knitwit.web` and the web
OAuth flow. Deliberately not `expo-apple-authentication`: that path signs in with an identity token,
and there is no id-token form of `linkIdentity()`, so it cannot attach Apple to an account somebody
already has. On a phone the same web flow runs inside a browser sheet and returns by app scheme.

Three things cost an afternoon each and are worth not rediscovering: `detectSessionInUrl` was off,
so the browser came back from Apple with a code nothing read; **manual linking is off by default**,
and with it off a provider sign-in does not fail, it succeeds into a second account; and Apple's
capability sync in EAS will try to *disable* Sign in with Apple on the App ID, because the Expo
config declares no such entitlement — hence `EXPO_NO_CAPABILITY_SYNC=1` on every credential command.

## M6 — what it was going to be

**`linkIdentity()`, not a new account.** Apple and Google attach to the *same* `user_id`, so nothing
moves and nothing is lost. Signing in is an upgrade, not a migration — which is the entire reason
for going anonymous first.

### A thing to be straight about: there is no username

Supabase Auth's password provider keys on **email or phone. There is no username sign-in**, and
nothing in the platform to enable. Three ways to get one, none free:

| Approach | What it costs |
|---|---|
| **Email + password** *(recommended)* | Nothing. It is the supported path, it gives password reset for free, and it is what most people mean by "username and password" anyway. |
| **Username stored in `profiles`** | Also nothing, and worth doing regardless — it is a display name. But it is not what you sign in with. |
| **True username login** | A lookup from username to email before calling `signIn`. That lookup has to be callable by someone who is *not* signed in, which tells any stranger whether a username exists — a slow leak of who has an account. Plus a uniqueness constraint and a reservation flow. |

**Recommendation: email + password for signing in, username in `profiles` as a display name.** If a
true username login matters, it is buildable, and the leak above is the thing to decide about rather
than the code.

### What M6 covers

- **Apple** and **Google** through `linkIdentity()` on an existing anonymous account, and through
  `signInWithOAuth()` on a device that has never had one.
- **Email + password**, via `updateUser({ email, password })` to upgrade an anonymous account —
  email verified before the password is accepted. **Not done: see Still open.**
- **Signing in on a second device**, which is the case that has never been exercised: a device that
  already has an anonymous account with local data, signing into an account that also has data. Two
  sets of rows, one winner to choose. Worth deciding before it happens rather than after.
- Retiring the hardcoded `'Pim'` on the Account screen, finally, since `profiles` will have a real
  name in it.

### What M6 has to get right

- **The anonymous account is not disposable.** It holds everything. Any path that creates a *new*
  user instead of linking loses a knitter's whole stash, silently, at the moment they were trying to
  make it safer.
- **Apple sign-in is mandatory on iOS** if Google is offered, per App Store review.
- **Email verification before the password sticks**, or an account is claimable by typing somebody
  else's address.

## Deferred

Not planned, not scheduled, written down so the reasoning survives.

**Ravelry sign-in.** Plain OAuth 2.0 with a client secret and registered redirect URLs — no
`id_token`, so it is not OIDC and `signInWithIdToken` will not take it. It needs an Edge Function
doing the code exchange and minting a session through the Admin API. Entirely doable; its own
project, and it should sit on foundations that are already boring.

**Stripe.** The shape is already in place — `subscriptions` with a read policy and no write policy,
so a plan can be granted by a webhook and by nothing else, and `plan_for` already decides
entitlements. Nothing to build until there is something to sell.

## Still open

Small things that are known rather than forgotten. The first two are no longer small: the door made
them load-bearing.

- **No password reset, and no email verification.** `mailer_autoconfirm` is on, so an address is
  never proved — anybody can register one that is not theirs — and a forgotten password is an
  account nobody can enter, with the work still inside it. Both were rough edges while anonymous
  accounts existed as a fallback. With the door up they are the front of the house, and both need
  SMTP on the project before either can be turned on.
- **Anonymous accounts are no longer created, but the tier remains.** `plan_for` still grants them
  60 AI units a day and the gate still upgrades the ones that exist. The server setting stays
  enabled so those upgrades keep working; it can be turned off once none are left.

- **No pull on reconnect or foreground.** Sync runs at launch and 1.5s after a local change, so a
  device left open will not see another's changes until something happens locally. The cheapest real
  improvement available.
- **Abandoned anonymous accounts are never cleaned up.** Supabase does not do it; a scheduled purge
  of accounts with no linked identity and no activity for 90 days is needed before strangers use
  this.
- **Two devices used *before* accounts existed** each invented their own ids for what the knitter
  thinks of as the same project. No backfill can know they are the same; they will sync as
  duplicates, and the answer is to pick one device as the source of truth on first sign-in.
- **`is_anonymous` is not checked in any policy yet.** Nothing today needs it — reading and writing
  your own knitting is the whole surface — but publishing a pattern would.
- **A processor note for GreenPT.** Ball-band photos and pattern text leave the device. Friends will
  not care; strangers need telling, once.

## What would make this go wrong

Still true, and two of them already caught something.

**Trusting the client's clock.** `updated_at` is set by a database trigger. Verified: a client
sending 2099 is stored as now.

**Testing sync with one device.** Every interesting bug here needs two. Both real bugs in M2 — the
echo storm, and marks that were not durable — were found that way.

**Letting the client decide entitlements.** The moment a paywall is a boolean in the store, it is
not a paywall.

**Forgetting the counter is the product.** If sync ever makes tapping `+` feel slow or lossy, the
sync is wrong, not the counter. It stays local and instant; the network catches up afterwards.

**Adding an entity and forgetting the seed generation.** Only *changes* are marked, and a stash that
is not about to change is never marked at all — so a new entity uploads nothing, for ever, for every
account that already ran. Caught twice now. `SEED_GENERATION` in `src/lib/sync/index.ts` goes up
whenever `ENTITIES` grows.
