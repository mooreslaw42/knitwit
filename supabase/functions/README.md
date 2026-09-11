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
OpenAI-compatible `/v1/chat/completions` endpoint — no SDK, just fetch. Default model `glm-5.2`,
chosen for its reasoning and agentic tool-use tuning, which is the closest available proxy for
"will reliably fill in a strict JSON schema".

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
