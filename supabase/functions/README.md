# Edge Functions

Server-side code. The one rule that governs everything here: **the language model is only ever
called from this directory.** The app ships to the web, so anything in the client bundle is public
— an API key there would be readable by anyone who opens devtools.

## `parse-pattern`

Two tasks, one function — they share a provider, a cached prompt discipline, and the rule that the
client re-validates everything that comes back.

### `task: "rows"`

Converts written knitting rows into charted stitch groups. It is the model half of a hybrid
parser: `src/lib/parse-pattern-text.ts` reads the regular shorthand locally and for free, refuses
what it can't chart faithfully, and only the refusals come here.

**Request** (`POST`, via `supabase.functions.invoke('parse-pattern', { body })`):

```jsonc
{
  "task": "rows",
  "sectionText": "…the whole section, for context…",
  "rows": [{ "index": 4, "label": "Row 5", "side": "RS", "instruction": "*k1, yo, k2tog; rep from *" }],
  "sizes": ["S", "M", "L"],
  "stitchesBefore": 48,
  "model": "claude-sonnet-5"   // optional per-call override
}
```

**Response**: `{ model, rows: [{ index, stitches, confident, note }], usage }`. Counts come back as
one integer per size; the client collapses a run that's the same for every size back to a scalar.

The client re-validates everything that comes back (`src/lib/parse-pattern-remote.ts`) and re-runs
the stitch-count check over the merged section, so a bad response degrades to "flagged for review"
rather than a wrong chart.

### `task: "document"`

Reads a whole pattern — pasted, or extracted from a PDF's text layer by
`src/lib/read-pattern-file.ts` — into every field the wizard holds.

```jsonc
{ "task": "document", "text": "…the whole pattern…", "model": "glm-5.3-flash" }
```

Returns `{ model, draft, usage }`. `draft` carries metadata, yarn slots, tools, techniques, and
sections whose `description` is the pattern's **verbatim** wording — the prompt is emphatic about
that, because each section's text is charted row by row afterwards, so anything reworded here is
reworded for the knitter.

`src/lib/import-pattern-document.ts` normalises the draft (an unrecognised category becomes the
default rather than a broken screen), runs each section through the deterministic parser, and
hands the wizard a review card. Nothing is filled in until the knitter accepts it, and the source
text is kept, so a bad read is always re-runnable.

Server-side validation is deliberately thin for this task — the client normalises every field
anyway, and duplicating that pass in a second runtime would only give it two places to drift.

### Configuration

| Secret | Required | Notes |
|---|---|---|
| `AI_PROVIDER` | no | `greenpt` or `anthropic`. Defaults to `anthropic`. |
| `GREENPT_API_KEY` | if `greenpt` | **Supabase secret only.** Never `EXPO_PUBLIC_`-prefixed — that ships it in the client bundle. |
| `ANTHROPIC_API_KEY` | if `anthropic` | Same. |

Put them in `supabase/.env.local` (gitignored — the inline `secrets set KEY=value` form would
leave the key in your shell history) and push:

```bash
supabase secrets set --env-file supabase/.env.local --project-ref <ref>
supabase functions deploy parse-pattern --project-ref <ref>
```

The same file is read automatically by `supabase functions serve` for local runs.

### Providers

**GreenPT (`provider-greenpt.ts`)** is the EU-hosted provider AGENTS.md names, reached through its
OpenAI-compatible `/v1/chat/completions` endpoint — no SDK, just fetch. Default model
`glm-5.3-flash` (€0.11/€0.44 per M tokens): the work is small and schema-constrained, so it does
not want a flagship coding model — `glm-5.2` does the same job at ten times the price. Escalate
per call if the reconcile rate justifies it.

Whether that endpoint honours `response_format: {type:'json_schema'}` is **not documented**, so the
provider discovers it at runtime: it asks for the schema, and on a 4xx retries once in plain JSON
mode with the schema stated in the prompt, remembering the answer for the life of the isolate.
Watch for `GreenPT rejected json_schema` in the logs to find out which mode you're in — it changes
nothing about correctness (the client re-validates regardless) but it does change how often the
model needs a second look.

**Anthropic (`provider-anthropic.ts`)** uses `claude-sonnet-5` with structured outputs and prompt
caching on the stable prefix. Prompt caching is a prefix match, so the system prompt must stay
byte-identical across requests — a single per-request byte above the breakpoint (a size list, a
timestamp) costs the cache for every import. Everything variable belongs in the user turn.

Both take a per-call model override. The response carries the model name back and the function
logs the confident-row count, so **promote a path to a larger model when the measured reconcile
rate says to**, not on a hunch.

The system prompt is the cached prefix and must stay byte-identical across requests: prompt
caching is a prefix match, so a single per-request byte above the breakpoint (a size list, a
timestamp) costs the cache for every import. Everything variable belongs in the user turn.

### Known gaps

- **No rate limiting.** The app has no auth yet, so the anon key is the only gate. The per-request
  ceilings in `index.ts` bound what one call can cost, but not how many calls someone can make.
  Worth a per-IP or per-day cap before this is public.
- **Typechecking.** These files are excluded from the app's `tsconfig.json` (Deno globals, `npm:`
  specifiers), so `npm run typecheck` does not cover them. Run `npm run typecheck:functions` —
  it shells out to `npx deno check` and needs no permanent Deno install.
- **Dependency pinning.** Deno refuses npm versions published in the last 24 hours as a
  supply-chain guard, so the `@anthropic-ai/sdk` pin deliberately trails the newest release.

## `ravelry-userinfo`

The userinfo endpoint for the `custom:ravelry` auth provider. Supabase Auth calls it — never the
app — with a Ravelry access token as the bearer; it asks Ravelry's `/current_user.json` who that is
and returns flat claims with the numeric id as `sub`. Needed because Supabase cannot read Ravelry's
nested `{ user: { … } }` response. JWT verification is off for it in `config.toml` (the bearer is
Ravelry's, not ours); it holds no secret and reads no table. No secrets to set — the Ravelry client
secret lives in the provider's dashboard config, not here. Setup and open decisions:
`docs/ravelry-sign-in.md`.

## `ravelry-connect`

Keeps the Ravelry **refresh token** Supabase hands over only once. On a Ravelry sign-in or connect,
supabase-js puts `provider_refresh_token` on the session that comes back and stores it nowhere; the
app (`src/lib/ravelry/connect-session.ts`, fired from the session watcher) sends it here the moment
it sees it. This is Phase 0 of `docs/plans/ravelry-import.md` — nothing can read a knitter's library
later without it.

**Request** (`POST`, via `invokeEdgeFunction('ravelry-connect', …)`): `{ refresh_token }`. The caller's
JWT identifies whose row is written (verified against `/auth/v1/user`, never decoded on trust — same
as `delete-account`). Returns `{ ok, stored, kept? }`.

### Why it refreshes before it stores

Ravelry's refresh tokens are **single-use**: each refresh consumes the token and returns a new one.
supabase-js persists the *original* `provider_refresh_token` and replays it on every page reload — so
a naive store would keep overwriting the rotated token with the spent original, and the connection
would die after one import. So this does **not** store the incoming token directly: it exchanges it
once (`/oauth2/token`, HTTP Basic with the app credentials), stores the **rotated** result, and reads
the Ravelry username from the fresh access token. A stale token re-sent on a reload then fails to
exchange and is **turned away** (`kept: true`) rather than clobbering the good connection — the
client's `SIGNED_IN`-only gate is the first line, this is the belt-and-braces. (`ravelry-import`
rotates and re-stores the same way on every pull.)

The stored token is **enveloped** (AES-GCM) before it touches Postgres, so a row in
`ravelry_connections` is ciphertext — see the table's migration, which also closes it to every client
by RLS. Only the service role (this function) reads or writes it.

| Secret | Required | Notes |
|---|---|---|
| `RAVELRY_TOKEN_KEY` | yes | 32 raw bytes, base64, for the envelope. **Supabase secret only.** Generate with `openssl rand -base64 32`. Rotating it orphans stored tokens — knitters reconnect once. |
| `RAVELRY_CLIENT_ID` | yes | The Ravelry app's OAuth2 client id, to exchange the token. Must match the `custom:ravelry` provider's. |
| `RAVELRY_CLIENT_SECRET` | yes | Its secret. Same. |

```bash
supabase functions deploy ravelry-connect --project-ref <ref>
```

JWT verification is left on (the default): the caller is a signed-in knitter, and the row written is
always their own.

## `ravelry-import`

Reads a knitter's Ravelry on their behalf — everything Ravelry has to run server-side (the client
secret, and Ravelry's no-CORS rule). It loads the stored refresh token, decrypts it, exchanges it
for an access token at Ravelry's token endpoint (HTTP Basic with the app credentials, re-storing a
rotated refresh token), and reads.

### The paged tasks

The list endpoints are thin — the mapping needs each entry's *detail* — so a notebook costs one
request per stash entry, per project and per pattern on top of the lists. Doing all of that in one
call is what breaks on a real account: a couple of hundred projects is several hundred Ravelry
requests and a multi-megabyte response in a single function, which runs out of wall clock, annoys the
rate limiter, and loses everything if the last one fails.

So the unit of work is a **page** — at most `PAGE_SIZE` details, four in flight, one bounded
response — and the client (`src/lib/ravelry/run-import.ts`) asks until `hasMore` goes false,
applying each page as it arrives. That makes the import resumable (a failed page is retried, the
ones before it are already saved) and gives the screen a real number to show.

| Task | Body | Returns |
|---|---|---|
| `needles` | — | `{ items, hasMore: false }` — the whole drawer; small enough never to page |
| `stash` | `{ page }` | `{ items, hasMore }` — stash entries with their yarn and packs |
| `projects` | `{ page }` | `{ items, hasMore }` — project details, each carrying its `pattern_id` |
| `library` | `{ page }` | `{ ids, hasMore }` — owned pattern **ids**, so the client fetches only what it lacks |
| `patterns` | `{ ids }` | `{ items }` — details for the ids asked for |

A failed page is retried once by the client before it gives up: the first call after a deploy can
cold-start slowly enough to look like an error.

Order matters on the client: stash and patterns before projects, because a project's links are
resolved by finding them already in the store.

### `create-project` — the one write

Files a Knitwit project as a **new** Ravelry project. `{ task: 'create-project', draft }` →
`{ id, permalink, url, ravelryUser }`. `draft` is what `src/lib/ravelry/export-project.ts` built;
its `craft_name` and `status_name` are resolved here against `/projects/crafts.json` and
`/projects/project_statuses.json`, because hardcoding ids seen once in a fixture is how an export
files everything as the wrong craft. Everything else passes straight through, so adding a field to
the mapper needs no change here.

Create only — it never updates and never deletes, so the worst it can do to a knitter's notebook is
put something in it. The client offers it only for a project with no `ravelrySource`, and stamps one
on success, so the same project cannot be sent twice.

**How `create.json` wants its parameters is not documented publicly** — the API reference is behind
a Ravelry login and the open-source clients just forward whatever the caller passes. So `ravelryPost`
tries the three shapes it could be and stops at the first accepted: flat JSON, JSON nested under
`project`, then form-encoded. Only 400/415/422 ("I did not understand the parameters", nothing
created) moves on to the next; 401/403/404/429 are returned as they came. For the same reason the
two catalogue lookups try `GET` and then `POST` — they read like plain lists, but the published JS
client calls both with `POST`, and nothing public settles it. The shape that worked is
logged — `{"event":"ravelry-import","task":"create-project","ok":true,"shape":"…"}` — so the first
real export settles it for good. **Collapse the ladder to the one that works once it is known.**

### The rest

- `probe` (default) — does the whole chain and returns only counts
  (`{ ravelryUser, counts, readStatus }`), to confirm the read path. A `200` with real counts means
  it works; a `403` in `readStatus` with `current_user` fine means the scope is too narrow (below).
- `pull` — the whole notebook in one response, which is the paged walk run to the end and bounded by
  `PULL_CAP`. Kept for a small account and for any client that has not updated yet; the paged tasks
  are what a real notebook should use.
- `pattern-pdf` — one owned pattern's PDF (`{ patternId }` → `{ owned, pdfBase64 }`), for the client
  to extract and run through parse-pattern (Phase 4). **How Ravelry exposes an owned PDF is not yet
  verified against a real owned pattern** — it reads `pattern.pdf_url`; adjust there if a real one
  differs.

| Secret | Required | Notes |
|---|---|---|
| `RAVELRY_TOKEN_KEY` | yes | The same key `ravelry-connect` enveloped the token with. |
| `RAVELRY_CLIENT_ID` | yes | The Ravelry app's OAuth2 client id, for the token exchange. **Supabase secret only.** |
| `RAVELRY_CLIENT_SECRET` | yes | The Ravelry app's OAuth2 client secret. Same. |

```bash
supabase functions deploy ravelry-import --project-ref <ref>
```

**Scope:** the `custom:ravelry` provider must request `offline` and **not** `profile-only`. Ravelry
has no granular read scopes — it is full access unless restricted — so `offline` alone yields a token
whose consent screen reads "view and update my Ravelry notebook". `profile-only` returns only the
profile, and every read here comes back `403`.
