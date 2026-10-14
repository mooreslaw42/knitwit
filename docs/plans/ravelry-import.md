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

1. **The scope question — resolved 2026-10-13.** Ravelry's OAuth2 has **no granular read scopes**;
   it is full access *unless restricted*. Set the `custom:ravelry` provider to request **`offline`
   and not `profile-only`**, and the consent screen reads **"view and update my Ravelry notebook"** —
   full read (and write) access. `profile-only` yields only the profile, and every read comes back
   `403`; a made-up scope like `library-read` is rejected outright with "Unexpected scope error".
   Confirmed by running the OAuth flow against the live provider. Write access ("update") also means
   the export phase is feasible later.
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

## Phase 6 — export, one project at a time (built 2026-10-14)

The other direction, and deliberately much smaller. The write scope turned out to be the same one
the import already has (`offline` grants read **and update**), so what was gating this is gone.

- **Create only.** Never updates, never deletes. The worst it can do to a knitter's notebook is put
  something in it.
- **Per-project, per-press.** A "Send to Ravelry" button on the project screen
  (`src/components/ravelry-project-card.tsx`), shown only to a knitter with Ravelry connected and
  only for a project with no `ravelrySource`.
- **Idempotent by the stamp.** On success the project is stamped with the Ravelry id and URL, which
  both removes the button and makes the next import reconcile onto that row rather than bring the
  project back as a second copy.
- **The facts only.** `src/lib/ravelry/export-project.ts` sends name, craft, status, progress,
  start date, notes, the knitter's measured gauge, size and personal source. **Not** labels —
  Knitwit's labels are private groupings the knitter invented and Ravelry's tags are public, which
  is not a conversion to make on someone's behalf. **Not** photos — a separate endpoint, and the
  photo may be a Ravelry URL we imported in the first place.
- Craft and status ids are resolved server-side against Ravelry's own `crafts.json` and
  `project_statuses.json`, not hardcoded from a fixture.

## Phase 7 — the fields Ravelry showed were missing (2026-10-14)

Reading the real responses field by field turned up data the mappers were dropping because Knitwit
had nowhere to put it. All additive, and all free of SQL: every entity is an opaque `data jsonb`
column (`20260916000000_accounts_and_sync_schema.sql`) and `sync/registry.ts` writes the object
verbatim, so a new optional field syncs with no migration and no version bump.

- **`Material.skeins`** — how many the knitter *owns*. Everything else named `skeins` in Knitwit is a
  requirement (`Pattern.materials[].skeins`, `Project.materialSkeins`), so the app could say a
  sweater wants six balls while having no idea you had two. From the stash entry's **head pack**, not
  the sum: in the captured response a two-skein entry has two packs that both say `skeins: 2.0`, the
  second a child of the first, and adding them tells a knitter they own twice the yarn they do.
- **`Material.status`** (`instash` / `usedup` / `notusing`) — folded from Ravelry's longer list by
  keyword, since only one status id has ever been observed. For-sale and for-trade both land on
  `notusing`; Knitwit is not a marketplace.
- **`Material.location`** and **`Material.notes`** — Ravelry has both per entry, and yarn was the one
  entity in the app with nowhere to write a sentence.
- **`Project.finishedOn`** — there was no finish date anywhere in the codebase. Imports Ravelry's
  `completed` and exports it back. Optional rather than `string | null`, because every project saved
  before it genuinely has no answer; nothing sets it automatically, since a make is often declared
  finished weeks after the last row.
- **`Material.craftType` is now read off the yarn**, not hardcoded to `'knit'` — which filed a
  crocheter's whole stash as knitting. Ravelry gives no craft on a yarn but does record the tools it
  is for, so hooks-and-no-needles means crochet; needles, both, or nothing stays knitting. The merge
  treats it as the knitter's, because it is an inference and a correction must stick.

Skipped deliberately: `Project.sizeName` (the `sizeIndex`-into-`Pattern.sizes` mismatch is real but
not worth a second field yet), a gauge's stitch pattern (`gauge_pattern`), social counts, ratings,
`made_for`, `finish_by`, multiple project photos, and a `hibernating` project status.

## Deferred

- **Updating an exported project.** The stamp makes it possible (`POST /projects/{user}/{id}.json`),
  but it means deciding which side wins per field on a thing other people can see. Not yet.
- **Exporting stash, needles or patterns.** Projects are what a knitter wants in their notebook;
  the rest is inventory nobody else reads.
- **Live two-way sync.** Builds on the provenance stamp plus a sync cursor and a per-field
  source-of-truth decision. Out of scope here.

## Risks, ranked

1. ~~**Ravelry OAuth2 may not grant project/stash read scopes.**~~ **Resolved (2026-10-13):**
   `offline` with no `profile-only` grants full notebook read+write. See Phase 0.
2. **Photo URLs must be hotlinkable without auth.** The "URL + thumbnail, don't copy bytes" choice
   depends on Ravelry project and library photos being public CDN links. If any are auth-gated, the
   URL approach breaks for those and needs a fallback.
3. **Getting the owned PDF out of Ravelry** (Phase 4) is the one part still unverified — the import
   now reuses the app's existing client-side PDF extraction, so the only guess left is how Ravelry
   exposes an owned pattern's PDF. The `pattern-pdf` task reads `pattern.pdf_url`; it needs a real
   owned pattern to confirm, and is the single place to adjust if that is wrong.
4. **The shape `create.json` wants its parameters in** (Phase 6) is not publicly documented — the
   API reference is behind a Ravelry login. The function tries flat JSON, JSON nested under
   `project`, then form-encoded, advancing only on a status that means the parameters were not
   understood, and logs which one worked. The first real export settles it; collapse the ladder then.
5. **Stash ↔ project yarn matching** is lossy — Ravelry's yarn model is richer and messier than
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
