# Importing a knitter's Ravelry life into Knitwit

Status: **planned, not started.** Sign-in with Ravelry exists (`docs/ravelry-sign-in.md`); this is
the next thing that connection is *for*. Decided 2026-10-13.

Ravelry is where most knitters already keep their project notebook, their stash, their needle
collection and the patterns they have bought. A knitter arriving at Knitwit with ten years of that
behind them should not have to retype it. This plan brings it across.

## What we are building, and what we are not (yet)

Four decisions, made up front:

- **All four entities move:** projects, patterns (the library they own), stash → Knitwit materials,
  and needle inventory → Knitwit tools.
- **Import first, export later.** Ravelry → Knitwit is the whole of this plan. Knitwit → Ravelry
  (writing to someone's real notebook) is a later phase, and it is gated on a scope question that
  may not have a good answer — see [Deferred](#deferred).
- **One-shot import now, live sync later.** A knitter presses a button and their things come across.
  Keeping the two sides continuously in step — change tracking, per-field source of truth, conflict
  resolution — is a categorically larger project and is not in scope here. The groundwork laid below
  (the provenance stamp) is what a later sync would build on.
- **Patterns come across in two tiers.** Ravelry's API hands out a pattern's *metadata* — never its
  row-by-row instructions, which are copyrighted. So a pattern lands first as a **library card**
  (name, craft, gauge, needle size, a photo, a link back), and separately, for a pattern whose PDF
  the knitter owns, a per-pattern **"build the chart"** action runs the PDF through the existing
  `parse-pattern` AI to make it a real, countable Knitwit pattern.

## The shape of it

Every call to Ravelry runs **server-side, in a Supabase Edge Function**. Two reasons, both
non-negotiable: Ravelry's API needs the app's client secret, and the app ships to the web where a
secret would be public; and Ravelry does not allow authenticated browser (CORS) requests. This is
the same server-only seam as `parse-pattern`.

Given that, every entity follows one pipeline:

```
Edge Function  ── authenticated pull from Ravelry, with refresh ──▶  normalized JSON
      │
client  ── map normalized JSON to the existing TS types in src/types/knitwit.ts
      │
local Zustand store (src/store/useKnitwitStore.ts)
      │
existing background sync (src/lib/sync/) ──▶ Supabase, stored verbatim as JSONB
```

### Why this is smaller than it looks

The server **never looks inside** an entity. Every table in
`supabase/migrations/20260916000000_accounts_and_sync_schema.sql` is the same four columns —
`user_id`, `id`, `data jsonb`, `updated_at` — and `data` is the whole TS object, written and read
by pass-through `toRow`/`fromRow` (`src/lib/sync/registry.ts:32-33`). So importing a project or a
pattern needs **no new entity tables and no migration**: it is only the work of producing a
well-formed TS object and dropping it into the local store. Sync carries it up unchanged.

The only genuinely new server state is the Ravelry **refresh token** (Phase 0).

### Re-import without duplicates: a provenance stamp, not a mapping table

Add one optional field to `Material`, `Tool`, `Pattern` and `Project`:

```ts
ravelrySource?: {
  id: string;                                   // Ravelry's id for the thing
  kind: 'project' | 'pattern' | 'stash' | 'needle';
  url: string;                                  // deep link back to Ravelry
  importedAt: string;
};
```

It rides inside the JSONB like everything else, so it needs no schema change. Re-running an import
reconciles by scanning the local store for a matching `ravelrySource.id` and updating in place
rather than creating a second copy. This same stamp is the join a future live-sync would key on.

## Phase 0 — the token seam, and the scope spike that gates everything

Nothing below can read a single row of Ravelry data until this exists. **Confirmed by inspection:
`provider_refresh_token` is captured and stored nowhere in the codebase today** (`src/lib/auth.ts`
tracks only `signedIn/anonymous/email/providers/userId`; no `provider_token` handling anywhere).

1. **Settle the scope question *first* — it is the single biggest unknown in this plan.** The
   consent screen a knitter sees today grants only *profile-only* ("view my profile page"). Reading
   projects, stash and library needs broader scopes, and we could **not confirm from Ravelry's
   public documentation that its OAuth2 even offers granular project/stash read scopes** — the API
   reference is login-gated, and Ravelry's older full-access path was OAuth1. Resolve this before
   building anything else, because the answer reshapes the feature:
   - **Documentation/support route:** read the OAuth2 scope list in the authenticated API docs, or
     ask on the Ravelry API forum / email the maintainers.
   - **Experiment route (cheapest definitive answer):** widen the `custom:ravelry` provider's scope
     config in the Supabase dashboard, run the OAuth2 flow, and see what Ravelry's consent screen
     offers and what an access token can then read.
   - **Data-shape route (does not answer the scope question, but de-risks all the mapping below):**
     a one-off authenticated `curl` with a Ravelry Pro app's personal API key — see
     [the probe](#appendix-a-self-serve-data-shape-probe).
2. **`ravelry_connections` table.** `user_id` (PK), encrypted `refresh_token`, Ravelry
   username + numeric id, granted scopes, `connected_at`, `token_updated_at`. RLS: **no client read
   at all** — only the Edge Function (service role) ever decrypts it. Encrypt at rest (Supabase
   Vault / pgsodium, or envelope-encrypt in the function with a secret).
3. **Capture the token at the one moment it exists.** Supabase puts `provider_refresh_token` on the
   session **once**, right after `signInWithOAuth` / `linkIdentity` returns a Ravelry identity, and
   stores it nowhere. A new step in `src/lib/auth.ts` (and the web `auth-return` path) must read it
   there and POST it to a `ravelry-connect` function that writes the row. Miss that window and the
   knitter has to reconnect — though Ravelry will not ask them to re-approve.
4. **A server Ravelry client.** Refresh-token → access-token exchange (Basic auth to
   `www.ravelry.com/oauth2/token`), pagination, rate-limit backoff, and clean handling of a knitter
   who revokes access or disconnects.

## Phase 1 — stash → materials, needles → tools (the clean wins)

The highest value for the least ambiguity, and the place to shake out the whole pipeline on entities
that have no cross-links.

- **Stash → `Material`** (`knitwit.ts:88-110`): `brand`, `colorName`, `colorLot`, `weight` (yarn
  weight code), `grams`, `meters`, `composition`, `craftType`, `photo` = Ravelry photo URL, `link` =
  the stash page. Set `gauge` where Ravelry has it. Stamp `ravelrySource`.
- **Needle inventory → `Tool`** (`knitwit.ts:180-185`): map Ravelry needle types → the `ToolType`
  enum (`knitwit.ts:170-178`: straight/circular/dpn/interchangeable/crochet-hook/…), carry
  `thickness`, `length`, `quantity`.

Both are pure field maps. Write them as pure functions over fixtures so they are unit-testable (the
repo prioritises pure-logic tests), then: Edge Function pull → map → local store → sync.

## Phase 2 — patterns, the metadata tier (so projects have something to link to)

For any pattern a knitter has touched (owned, favourited, or referenced by a project), pull
`/patterns/{id}.json` and prefill `Pattern` (`knitwit.ts:324-360`) **with no AI**: `name`, `craft`,
`category` (via a Ravelry-category → `PatternCategory` map), `needleSize`, `gauge`, yardage →
material slots, `photo` URL, `link`, `favorited`, designer → `notes`. Keep `visibility` private
(the column already defaults to private).

The result is a usable library card that deep-links to Ravelry, with an **empty counter** — there
are no rows yet. That is Phase 4.

## Phase 3 — projects (links up to Phases 1 and 2)

Pull `/projects/{username}/list.json` (paginated) then each project's detail, and map to `Project`
(`knitwit.ts:404-456`):

- Scalars: `name`, Ravelry status → `ProjectStatus`, `startedOn`, `notes`, `craft`, `labels`/tags,
  `photo` = first Ravelry photo URL (+ a thumbnail URL variant — **URLs only, no bytes copied**).
- **Gauge** → the snapshot pair `gauge: { pattern, mine }` (`knitwit.ts:444`): the project's own
  gauge into `mine`, the pattern's into `pattern`.
- **Yarn** → resolve each of the project's Ravelry stash references to the `Material`s imported in
  Phase 1 (match on `ravelrySource.id`), filling `slotMaterials` and `materialSkeins`
  (`knitwit.ts:446-454`). Anything unmatched becomes a light stub or an unresolved slot.
- **Pattern** → set `patternId` to the Phase-2 `Pattern` (match on the Ravelry pattern id), or leave
  it `null` for an improvised project — the model allows pattern-less projects, which is exactly why
  `Project` duplicates the self-describing fields rather than reading a pattern live
  (`knitwit.ts:415-418`).

Import order therefore matters: **stash and pattern metadata before projects**, so the links land.

## Phase 4 — patterns, the structured tier (option b, opt-in per pattern)

For a pattern whose **PDF the knitter owns** (their Ravelry library), turn the document into a real
Knitwit pattern that drives the counter, reusing machinery that already exists end to end:

```
Edge Function downloads the authenticated PDF
   → extract text
   → parse-pattern task:'document'  (schema.ts:216 DocumentRequest / :227 DOCUMENT_SCHEMA)
   → src/lib/import-pattern-document.ts  (assigns slot ids, builds PatternSection[])
   → a full Pattern with sections/rows
```

Two deliberate choices:

- **Opt-in, one pattern at a time.** The metadata stub (Phase 2) lands automatically; turning a PDF
  into a chart is an AI call — it costs, it takes time, and it is imperfect — so it belongs behind a
  **"Build the chart from the PDF"** button on the pattern, not a bulk job.
- **Where PDF→text extraction happens is a real fork.** `parse-pattern` consumes *text*, and today
  that extraction is **client-side** (`DocumentRequest.text` is "extracted from a PDF's text
  layer"). But an owned PDF sits behind Ravelry auth, i.e. server-side. Preference: add text
  extraction in (or beside) the Edge Function so the PDF bytes never reach the client — at the cost
  of a PDF-text capability in the Deno runtime, which is new ground. The alternative is to stream the
  PDF to the client and reuse the existing extraction path.

Copyright note: this stores the knitter's **own** owned pattern for their **own** use, kept private.
No redistribution; nothing is made public.

## Phase 5 — the import experience

"Connect Ravelry" already exists on the Account screen. On top of it, a re-runnable **Import from
Ravelry** flow: once connected, show counts (*N projects, M stash, K patterns*), let the knitter
choose what to pull, show progress, and tolerate partial failure (per-item, resumable). Because every
imported object carries `ravelrySource`, running it again reconciles instead of duplicating.

## Deferred

- **Export (Knitwit → Ravelry).** Gated on a **write-scope** check that may not exist at all, and it
  writes to a knitter's real notebook — so it needs explicit per-action consent and strict
  idempotency (store the created Ravelry project id, match on re-run). Create-new first;
  update-existing is a further step. A Knitwit pattern with no Ravelry pattern id would land as a
  pattern-less craft project on Ravelry.
- **Live two-way sync.** Builds on the provenance stamp plus a sync cursor and a per-field
  source-of-truth decision. Out of scope here.

## Risks, ranked

1. **Ravelry OAuth2 may not grant project/stash read scopes to end users.** If it doesn't, the whole
   import needs a different auth path, and export is likely dead on arrival. This is why Phase 0
   leads with the scope spike. *Unresolved — needs a live check.*
2. **Photo URLs must be hotlinkable without auth.** The "URL + thumbnail, don't copy bytes" choice
   depends on Ravelry project and library photos being public CDN links. If any are auth-gated, the
   URL approach breaks for those and needs a fallback.
3. **Server-side PDF text extraction in Deno** (Phase 4) is a new capability for the edge runtime.
4. **Stash ↔ project yarn matching** is lossy — Ravelry's yarn model is richer and messier than
   Knitwit's, so expect some unresolved material slots on imported projects.

## Appendix A — self-serve data-shape probe

This confirms the **endpoint response shapes** (which drive every mapping above). It does **not**
answer the OAuth2 *scope* question in Risk 1 — a Ravelry Pro app's personal API key is full-access
HTTP Basic auth against your own account, a different mechanism from the end-user OAuth2 flow. Run it
yourself (it needs your API credentials, which an agent must not handle). Key and secret come from
Ravelry → Pro → Apps → an app with "read-only" personal access.

```sh
KEY=...; SECRET=...; USER=your-ravelry-username
BASE=https://api.ravelry.com
curl -s -u "$KEY:$SECRET" "$BASE/current_user.json"
curl -s -u "$KEY:$SECRET" "$BASE/projects/$USER/list.json"            # project list shape
curl -s -u "$KEY:$SECRET" "$BASE/people/$USER/stash/list.json"        # stash shape
curl -s -u "$KEY:$SECRET" "$BASE/people/$USER/needles/list.json"      # needle inventory shape
curl -s -u "$KEY:$SECRET" "$BASE/patterns/<id>.json"                  # pattern metadata shape
```

Save the JSON as fixtures — the mapping functions in Phases 1–3 should be written and tested against
them.

## Reference — the files this touches

- Types: `src/types/knitwit.ts` (`Material` 88, `Tool` 180, `Pattern` 324, `Project` 404, `Gauge` 19).
- Local store + persist: `src/store/useKnitwitStore.ts`.
- Sync boundary / table map: `src/lib/sync/registry.ts`, `src/lib/sync/index.ts`.
- Server schema (no change needed for imported data): `supabase/migrations/20260916000000_accounts_and_sync_schema.sql`.
- AI parser to reuse: `supabase/functions/parse-pattern/` (`index.ts:778` dispatch, `schema.ts:216`
  DocumentRequest, `:227` DOCUMENT_SCHEMA) and the client mapper `src/lib/import-pattern-document.ts`.
- Auth seam to extend: `src/lib/auth.ts`; sign-in background: `docs/ravelry-sign-in.md`.
