# Edge Functions

Server-side code. The one rule that governs everything here: **the language model is only ever
called from this directory.** The app ships to the web, so anything in the client bundle is public
— an API key there would be readable by anyone who opens devtools.

## `parse-pattern`

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

### Configuration

| Secret | Required | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | **Supabase secret only.** Never `EXPO_PUBLIC_`-prefixed — that ships it in the client bundle. |
| `AI_PROVIDER` | no | Defaults to `anthropic`. The seam for swapping in GreenPT later; see `provider.ts`. |

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-…
supabase functions deploy parse-pattern
```

Locally, put the key in `supabase/.env.local` (gitignored) and run `supabase functions serve`.

### Model choice

`claude-sonnet-5` on every call, with a per-call override. The work is heavily constrained — a
strict JSON schema, a closed stitch vocabulary, and an arithmetic check the app runs afterwards —
which is what makes the cheaper tier viable. The response carries the model name back and the
function logs the confident-row count, so **promote a path to Opus when the measured reconcile
rate says to**, not on a hunch.

The system prompt is the cached prefix and must stay byte-identical across requests: prompt
caching is a prefix match, so a single per-request byte above the breakpoint (a size list, a
timestamp) costs the cache for every import. Everything variable belongs in the user turn.

### Known gaps

- **No rate limiting.** The app has no auth yet, so the anon key is the only gate. The per-request
  ceilings in `index.ts` bound what one call can cost, but not how many calls someone can make.
  Worth a per-IP or per-day cap before this is public.
- **Typechecking.** These files are excluded from the app's `tsconfig.json` (Deno globals, `npm:`
  specifiers). Check them with `deno check supabase/functions/parse-pattern/index.ts`.
