# Knitwit — accounts, sync, and subscriptions

**Status: proposed, nothing built.** Written 2026-09-16 from measurements against the live project,
not from memory. Decisions taken by survey are recorded where they bite.

Four choices frame everything below:

- **Local-first with row-level sync.** The app keeps working with no network; Postgres is the
  durable truth; reconciliation happens per entity, never per blob.
- **Two devices from day one.** Conflict handling is real work, not a later retrofit.
- **Patterns may become shareable one day.** Projects and stash never do.
- **Nobody is asked to sign up.** Existing knitters get an account silently and keep their data.

## What is true today

Measured, so the plan starts from facts rather than impressions:

| | |
|---|---|
| Supabase region | **eu-west-1 (Ireland)** — already EU, so GDPR residency needs no migration |
| Data per knitter | ~250KB: 133KB patterns, 88KB projects, 54KB for a *single* photo |
| Storage | One JSON blob in `AsyncStorage`, ~5MB browser ceiling, no server copy |
| Entity types | 23 in `src/types/knitwit.ts` |
| Write frequency | Every row tap on the counter writes the whole store |
| Auth | None. One shared publishable key; the AI spend cap is bucketed by IP |

Two of these actively fight multi-user and have to change regardless of anything else.

**Photos are base64 inside the store.** One is 54KB. A knitter with thirty yarns and a dozen
projects is carrying tens of megabytes, which is fine in a browser blob and absurd in a Postgres
row. They move to Supabase Storage.

**The counter writes constantly.** A knitter taps `+` every few seconds and expects it to work on a
train. Any design where a row count needs a network is the wrong design.

## The shape

### One sync unit per thing a knitter thinks about

Normalising all the way down — pattern → section → row → stitch group — would make every chart edit
a five-table transaction. Storing each pattern as one row with `sections` as JSONB would make the
counter fight the notes field. The split that matters is where the **hot writes** are:

| Table | Written | Why its own row |
|---|---|---|
| `projects` | Rarely | Name, status, labels, notes, colours |
| `project_sections` | **Constantly** | `row`, `complete`, `seconds` — the counter lives here |
| `patterns` | Rarely | Plus `visibility`, see below |
| `pattern_sections` | Occasionally | `rows` stays JSONB: the stitch editor saves a chart whole |
| `materials`, `tools`, `techniques` | Occasionally | Small, independent |
| `activity_days` | Daily | Additive, see merge rules |
| `profiles`, `subscriptions` | Server | One row per user |

Putting the counter in its own small row is the single most important structural decision here.
It means counting rows on a phone touches one narrow record, and editing that project's notes on a
laptop touches a different one, so the commonest two-device situation is not a conflict at all.

Every table carries `user_id`, `updated_at` (set by a trigger, never by the client — a device with
a wrong clock must not be able to win an argument), and `deleted_at`.

### Tombstones, not deletes

A row deleted on the phone and absent from the laptop's next push is indistinguishable from a row
the laptop has not seen yet — so a hard delete comes back from the dead on the next sync. Deletes
set `deleted_at`, queries filter it, and a scheduled job purges after 30 days.

### The outbox is what makes offline real

Local writes go to the Zustand store *and* an append-only outbox. Sync drains the outbox when there
is a network and leaves it alone when there is not. The knitter never waits for a request, and a
closed laptop lid is not a lost row.

Pull is `where user_id = auth.uid() and updated_at > :since`, per table, with `since` kept locally.

### Three merge rules, not one

Last-write-wins everywhere is the usual shortcut and it is wrong for this app in two specific ways.

1. **Descriptive fields — last write wins.** Names, notes, colours, settings. Someone renamed it;
   the rename stands.
2. **Accumulators — add, never replace.** `seconds` on a section, and everything in
   `activity_days`. Knitting twenty minutes on the phone and ten on the laptop is thirty minutes.
   Last-write-wins would silently throw half of it away.
3. **The row count — last write wins, deliberately and with eyes open.** Max() is tempting and
   wrong: a knitter who frogs back to row 10 on the phone would have row 20 restored from the
   laptop, which is the opposite of what they asked for. So the latest write stands.

That third rule has a real failure case, and it is worth stating rather than hiding: counting the
*same section* on *two devices at once* resolves to whichever synced last, and the other device's
taps are lost. A full operation log — every tap an event, events merging commutatively — would fix
it properly. It is not worth the machinery for a knitter who owns one pair of hands, and the escape
hatch is documented instead.

### Photos move to Storage

A bucket keyed `{user_id}/{entity}/{id}.jpg`, owner-only policies, and a path in the row rather
than bytes. Existing base64 photos upload on first sync and are dropped from the blob. This is also
what quietly fixes the 5MB browser ceiling we found earlier.

## Auth

**Anonymous first.** `signInAnonymously()` on first launch. The knitter is not asked anything, their
local data uploads under a real `user_id`, and everything below works immediately.

**Signing in is an upgrade, not a migration.** `linkIdentity()` attaches Apple or Google to the
*same* user id, so nothing moves and nothing is lost. This is the whole reason for going anonymous
first rather than putting a signup wall in front of an app that currently has none.

Three caveats that need designing for, not discovering:

- Anonymous sign-in is rate-limited to **30 requests per hour per IP**.
- Abandoned anonymous users are **never cleaned up automatically** — a scheduled purge of accounts
  with no linked identity and no activity for 90 days.
- Anonymous users hold the same `authenticated` role as everyone else. RLS must check the
  `is_anonymous` JWT claim wherever a throwaway account should not have full run of the place.

**Ravelry is not a provider and cannot be made into one.** It is plain OAuth 2.0 with a client
secret and registered redirect URLs — no `id_token`, so it is not OIDC and `signInWithIdToken` will
not take it. It needs an Edge Function doing the code exchange and minting a session through the
Admin API. Entirely doable, meaningfully more work than Apple or Google, and the reason it is last
in the order below rather than first.

## Subscriptions and entitlements

Stripe is not needed yet, but the *shape* is cheap now and expensive to retrofit into a live table.

- `profiles` — display name and the like. One row, readable and writable by its owner. (This also
  retires the hardcoded `'Pim'` on the Account screen.)
- `subscriptions` — `status`, `plan`, `current_period_end`, `stripe_customer_id`. **Writable only by
  the service role.** A client that can write its own plan does not have a paywall.
- `public.plan_for(uid)` — one SQL function both RLS policies and Edge Functions call, so there is
  exactly one definition of what somebody is entitled to.

**Entitlements are enforced on the server or not at all.** The client may hide a button; only the
Edge Function decides whether the model runs. Concretely, today's IP-bucketed spend cap becomes
per-user and plan-aware, which is strictly better than what is there now — the current cap punishes
a household sharing an address and cannot tell a paying knitter from a stranger.

## Privacy

- **EU already.** `eu-west-1`, so nothing to move.
- **`visibility` on patterns from day one**, defaulting to `private`. Adding a column to a live
  table later is painful; adding it now is free. Projects and stash have no such column, because
  the answer for them is never.
- **Deletion means deletion.** Account delete cascades every table and purges the Storage prefix.
  GDPR erasure, and the right default regardless.
- **Export already exists.** The backup file becomes the portability answer; it learns to pull from
  the server rather than only the device.
- **Say what leaves the device.** Ball-band photos and pattern text go to GreenPT. Friends will not
  care; it still needs writing down once, and a processor agreement before strangers do.

## Order

Each step ships on its own and leaves the app working.

| | | Why here |
|---|---|---|
| **M1** | Schema, RLS, anonymous auth, `profiles` | Dark. Nothing user-visible; everything else needs it |
| **M2** | Sync engine — outbox, pull/push, tombstones. **Materials first** | One small, low-risk entity proves the engine before projects trust it |
| **M3** | The rest of the entities, counter last | The counter is the hot path; it goes last, when the engine is boring |
| **M4** | Photos to Storage | Independent of sync; fixes the quota ceiling too |
| **M5** | Per-user, plan-aware spend cap | Replaces the IP bucket. Better even with one plan |
| **M6** | Apple and Google via `linkIdentity()` | The upgrade path, once there is something worth keeping |
| **M7** | Ravelry via Edge Function | Hardest auth, least leverage, done when the rest is solid |
| **M8** | Stripe | When there is something to sell |

## What would make this go wrong

Worth writing down while it is still cheap to change course.

**Building sync before the schema settles.** Every entity that changes shape after M2 costs a
migration on live data. M1 deserves more argument than it will seem to need.

**Trusting the client's clock.** `updated_at` is set by a database trigger. A device with a skewed
clock that can set its own timestamps can win every conflict it should lose, and the symptom is
data quietly reverting.

**Testing sync with one device.** Every interesting bug here needs two. Two browsers, one offline,
is the minimum harness, and it should exist before M3.

**Letting the client decide entitlements.** The moment a paywall is a boolean in the store, it is
not a paywall.

**Forgetting the counter is the product.** If sync ever makes tapping `+` feel slow or lossy, the
sync is wrong, not the counter. It stays local and instant; the network catches up afterwards.
