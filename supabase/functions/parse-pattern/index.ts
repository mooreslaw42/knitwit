import { glossaryFor } from './glossary.ts';
import {
  buildDocumentUserMessage,
  buildUserMessage,
  DOCUMENT_SYSTEM_PROMPT,
  SYSTEM_PROMPT,
} from './prompt.ts';
import { anthropicProvider } from './provider-anthropic.ts';
import { greenptProvider, VISION_MODEL } from './provider-greenpt.ts';
import type { ModelProvider } from './provider.ts';
import {
  DOCUMENT_SCHEMA,
  ROWS_SCHEMA,
  SECTION_SCHEMA,
  SPANS,
  STITCH_TYPES,
  type DocumentRequest,
  buildEnrichQuery,
  ENRICH_SCHEMA,
  ENRICH_SYSTEM_PROMPT,
  ENRICHABLE_FIELDS,
  type EnrichRequest,
  nameLooksLikeMatch,
  MATERIAL_SCHEMA,
  MATERIAL_SYSTEM_PROMPT,
  type MaterialRequest,
  type ModelGroup,
  type ModelRow,
  type ParsePatternRequest,
} from './schema.ts';

// Turns written knitting rows the deterministic parser refused into charted stitch groups.
//
// This is the only place the app talks to a language model. The key is a Supabase secret and
// never leaves the server — it must never be EXPO_PUBLIC_-prefixed, which would ship it inside
// the client bundle for anyone to read.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Ceilings, not expectations. The app has no auth yet, so the anon key is the only gate on this
// endpoint — these bound what a single call can cost before a real rate limit lands.
const MAX_SECTION_CHARS = 20_000;
const MAX_ROWS = 40;
const MAX_SIZES = 12;
const MAX_INSTRUCTION_CHARS = 1_000;
const MAX_OUTPUT_TOKENS = 8_000;
// A data URL of a photo the client already downscales to roughly this. The client's own ceiling is
// 1.5MB; this leaves room for the data: prefix rather than rejecting a picture it just accepted.
const MAX_IMAGE_CHARS = 1_800_000;
// The answer is a dozen short strings. Room to think, not room to ramble.
const MAX_MATERIAL_OUTPUT_TOKENS = 2_000;

// Translation. A pattern is a lot of short strings rather than a few long ones, so the ceiling that
// matters is the count as much as the size.
const MAX_TRANSLATE_ENTRIES = 800;
const MAX_TRANSLATE_CHARS = 80_000;
const MAX_TRANSLATE_ID_CHARS = 40;
const MAX_TRANSLATE_OUTPUT_TOKENS = 16_000;
const MAX_LANGUAGE_CHARS = 40;
// Five results is GreenPT's default and measured enough: the snippets alone carried composition,
// ball weight and weight class for a real yarn, and the endpoint itself advises against fetching
// whole pages. A scraped page is five to ten times the tokens for the same answer.
const SEARCH_RESULTS = 5;
const MAX_SEARCH_CHARS = 12_000;
const MAX_NAME_CHARS = 120;

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', ...extra },
  });
}

class BadRequest extends Error {}

function selectProvider(): ModelProvider {
  const name = Deno.env.get('AI_PROVIDER') ?? 'anthropic';

  if (name === 'greenpt') {
    const apiKey = Deno.env.get('GREENPT_API_KEY');
    if (!apiKey) {
      throw new Error('GREENPT_API_KEY is not set. Set it as a Supabase secret.');
    }
    return greenptProvider(apiKey);
  }

  if (name === 'anthropic') {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set. Set it as a Supabase secret.');
    }
    return anthropicProvider(apiKey);
  }

  throw new Error(`Unknown AI_PROVIDER "${name}". Known providers: anthropic, greenpt.`);
}

// A whole pattern is long, but a 1M-context model can take it; the cap is here so one paste can't
// run up an unbounded bill on an endpoint with no rate limit in front of it.
const MAX_TECHNIQUES = 300;
const MAX_DOCUMENT_CHARS = 120_000;

function validateDocumentRequest(b: Record<string, unknown>): DocumentRequest {
  const text = typeof b.text === 'string' ? b.text.trim() : '';
  if (!text) throw new BadRequest('No pattern text to read.');
  if (text.length > MAX_DOCUMENT_CHARS) {
    throw new BadRequest(
      `That pattern is too long to read in one go (over ${Math.round(MAX_DOCUMENT_CHARS / 1000)}k characters).`,
    );
  }
  // The catalogue the client already has cached. Capped and shape-checked like everything else
  // crossing this boundary — the anon key is public, so this endpoint trusts nothing.
  const techniques = Array.isArray(b.techniques)
    ? b.techniques
        .filter(
          (t): t is { id: string; name: string } =>
            typeof t === 'object' &&
            t !== null &&
            typeof (t as { id?: unknown }).id === 'string' &&
            typeof (t as { name?: unknown }).name === 'string',
        )
        .slice(0, MAX_TECHNIQUES)
        .map((t) => ({ id: t.id.slice(0, 80), name: t.name.slice(0, 120) }))
    : undefined;

  return {
    task: 'document',
    text,
    techniques,
    model: typeof b.model === 'string' && b.model ? b.model : undefined,
  };
}

function validateRequest(body: unknown): ParsePatternRequest {
  if (typeof body !== 'object' || body === null) throw new BadRequest('Body must be an object.');
  const b = body as Record<string, unknown>;

  if (b.task !== 'rows') throw new BadRequest('Unsupported task — expected "rows".');

  const sectionText = typeof b.sectionText === 'string' ? b.sectionText : '';
  if (sectionText.length > MAX_SECTION_CHARS) {
    throw new BadRequest(`Section text is too long (max ${MAX_SECTION_CHARS} characters).`);
  }

  // An empty list is section mode — the parser read nothing, so there are no refusals to name and
  // the model charts the section itself. That needs text to work from.
  if (!Array.isArray(b.rows)) throw new BadRequest('No rows to convert.');
  if (b.rows.length === 0 && !sectionText.trim()) {
    throw new BadRequest('Nothing to convert — the section has no text.');
  }
  if (b.rows.length > MAX_ROWS) {
    throw new BadRequest(`Too many rows in one call (max ${MAX_ROWS}).`);
  }

  const rows = b.rows.map((raw, i) => {
    if (typeof raw !== 'object' || raw === null) throw new BadRequest(`Row ${i} is not an object.`);
    const r = raw as Record<string, unknown>;
    if (typeof r.index !== 'number' || !Number.isInteger(r.index) || r.index < 0) {
      throw new BadRequest(`Row ${i} has no valid index.`);
    }
    const instruction = typeof r.instruction === 'string' ? r.instruction.trim() : '';
    if (!instruction) throw new BadRequest(`Row ${i} has no instruction text.`);
    return {
      index: r.index,
      label: typeof r.label === 'string' ? r.label.slice(0, 80) : `Row ${r.index + 1}`,
      side: r.side === 'WS' ? ('WS' as const) : ('RS' as const),
      instruction: instruction.slice(0, MAX_INSTRUCTION_CHARS),
    };
  });

  const craft =
    b.craft === 'crochet' || b.craft === 'both' || b.craft === 'knit' ? b.craft : 'knit';
  const sizes = Array.isArray(b.sizes)
    ? b.sizes.filter((s): s is string => typeof s === 'string').slice(0, MAX_SIZES)
    : [];

  const stitchesBefore =
    typeof b.stitchesBefore === 'number' && Number.isFinite(b.stitchesBefore)
      ? Math.max(0, Math.round(b.stitchesBefore))
      : 0;

  return {
    task: 'rows',
    sectionText,
    rows,
    sizes,
    craft,
    stitchesBefore,
    model: typeof b.model === 'string' && b.model ? b.model : undefined,
  };
}

// The schema constrains the model, but a provider swap or an API change could still hand us
// something else. Re-check the shape rather than trusting it — a bad `type` or `span` would draw
// a nonsense chart, and a bad `takes` would throw off every row after it.
function validateModelRows(parsed: unknown, sizeCount: number): ModelRow[] {
  if (typeof parsed !== 'object' || parsed === null) throw new Error('Model output is not an object.');
  const rows = (parsed as Record<string, unknown>).rows;
  if (!Array.isArray(rows)) throw new Error('Model output has no rows array.');

  return rows.map((raw, i) => {
    const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
    if (typeof r.index !== 'number') throw new Error(`Model row ${i} has no index.`);

    const rawStitches = Array.isArray(r.stitches) ? r.stitches : [];
    const stitches: ModelGroup[] = [];
    for (const g of rawStitches) {
      const gg = (typeof g === 'object' && g !== null ? g : {}) as Record<string, unknown>;
      const type = String(gg.type ?? '');
      const span = String(gg.span ?? '');
      if (!(STITCH_TYPES as readonly string[]).includes(type)) {
        throw new Error(`Model row ${r.index} used unknown stitch "${type}".`);
      }
      if (!(SPANS as readonly string[]).includes(span)) {
        throw new Error(`Model row ${r.index} used unknown span "${span}".`);
      }
      const count = Array.isArray(gg.count)
        ? gg.count.filter((n): n is number => typeof n === 'number').map((n) => Math.max(0, Math.round(n)))
        : [];
      // A short run means the same number for every size; a long one is the model over-producing.
      // Trimming is safe, padding with the last value matches how patterns abbreviate.
      const sized =
        count.length === 0 || sizeCount === 0
          ? count
          : count.length >= sizeCount
            ? count.slice(0, sizeCount)
            : [...count, ...Array(sizeCount - count.length).fill(count[count.length - 1])];

      stitches.push({
        type,
        span: span as ModelGroup['span'],
        count: span === 'all' ? [] : sized,
        note: typeof gg.note === 'string' ? gg.note.slice(0, 200) : '',
      });
    }

    return {
      index: r.index,
      stitches,
      // Absent means unconfident: the app reviews the row rather than applying it quietly.
      confident: r.confident === true && stitches.length > 0,
      note: typeof r.note === 'string' ? r.note.slice(0, 300) : '',
    };
  });
}

// Every provider error carries a status when it has one, so a rate limit reaches the client as a
// rate limit rather than a generic failure.
function statusOf(error: unknown): number {
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' && status >= 400 ? status : 502;
}

// The whole-document pass has a lot more to write than a few rows, and a truncated response is a
// silently half-imported pattern.
const MAX_DOCUMENT_OUTPUT_TOKENS = 32_000;

// A section with its repeats expanded can run to a few hundred rows.
const MAX_SECTION_OUTPUT_TOKENS = 24_000;

async function handleRows(req: ParsePatternRequest, provider: ModelProvider): Promise<Response> {
  // Section mode returns a whole section rather than a handful of rows, so it needs the richer
  // schema and more room to write.
  const wholeSection = req.rows.length === 0;
  const result = await provider.complete({
    system: SYSTEM_PROMPT,
    user: buildUserMessage(req),
    schema: wholeSection ? SECTION_SCHEMA : ROWS_SCHEMA,
    model: req.model ?? provider.defaultModel,
    maxTokens: wholeSection ? MAX_SECTION_OUTPUT_TOKENS : MAX_OUTPUT_TOKENS,
  });

  const rows = validateModelRows(JSON.parse(result.text), req.sizes.length);

  // Logged, not returned: enough to track cost per import and cache hit rate without putting
  // anything the knitter wrote into the logs.
  console.log(
    JSON.stringify({
      event: 'parse-pattern',
      task: wholeSection ? 'section' : 'rows',
      provider: provider.name,
      model: result.model,
      rows_requested: req.rows.length,
      rows_returned: rows.length,
      rows_confident: rows.filter((r) => r.confident).length,
      usage: result.usage,
    }),
  );

  return json({ model: result.model, rows, usage: result.usage });
}


// ---------------------------------------------------------------------------
// The daily spend cap.
//
// See supabase/migrations/…_ai_usage_cap.sql for why this exists: the key that reaches here is
// public, so without a cap one stranger with a loop is an unbounded bill.
//
// Units, not requests. A document parse is allowed up to 32k output tokens and costs about €0.16;
// a yarn photo costs about €0.001. Counting them the same would either throttle the cheap thing
// pointlessly or leave the expensive one wide open.
const UNITS: Record<string, number> = {
  document: 10,
  rows: 5,
  // Per batch, and a pattern is tens of batches — this is the price of forty strings, not of a
  // whole pattern. It was 4 when a translation was a single call.
  translate: 1,
  enrich: 2,
  material: 1,
};

// Everyone, per day. The per-knitter number is not here: it depends on their plan, so it lives in
// SQL beside `plan_for` rather than as a second definition that drifts from the first.
//
// This one stays, as the backstop the per-user limit cannot be. Accounts are free to make, so a
// determined stranger can have as many allowances as they like; only a ceiling across all of them
// actually bounds the bill.
const DAILY_UNITS_TOTAL = 2_000;

// Who is calling, if anybody.
//
// supabase-js sends the signed-in session's token, so this is a real user id for anyone using the
// app. It falls back to null for a bare publishable key — a curl, or a client too old to have an
// account — and the caller is then bucketed by address as before.
//
// `getUser` rather than reading the token's claims: the payload of a JWT is only as trustworthy as
// its signature, and checking the signature is exactly what this does.
async function callerIdentity(
  request: Request,
  url: string,
  anonKey: string,
): Promise<{ userId: string | null; anonymous: boolean }> {
  const authorization = request.headers.get('Authorization') ?? '';
  const token = authorization.replace(/^Bearer\s+/i, '');
  // The publishable key is not a JWT and never identifies anyone; save the round trip.
  if (!token || token.split('.').length !== 3) return { userId: null, anonymous: false };

  try {
    const response = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return { userId: null, anonymous: false };
    const user = (await response.json()) as { id?: string; is_anonymous?: boolean };
    return { userId: user.id ?? null, anonymous: user.is_anonymous === true };
  } catch {
    return { userId: null, anonymous: false };
  }
}

// Who to bill, for a caller with no account to bill.
//
// Restored: the call site survived the move to per-account billing and the function did not, so
// every such call threw inside claimBudget's try — which fails open. The cap was not merely wrong
// for these callers, it was absent. They are exactly the callers it exists for: the app always
// carries a session, so anyone arriving without one is not the app.
function callerBucket(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for') ?? '';
  const first = forwarded.split(',')[0]?.trim();
  return first && first.length <= 64 ? first : 'unknown';
}

// Claims budget for a call. Returns null to proceed, or a response to send instead.
//
// Fails open. If the counter is unreachable the call goes through: a knitter halfway up a sleeve
// should not be stopped by a database hiccup, and the ceilings inside the function still bound what
// any single call can cost. The cap is there for a script, and a script would have to knock the
// database over first.
async function claimBudget(request: Request, task: string): Promise<Response | null> {
  const units = UNITS[task] ?? 1;
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!url || !key) {
    console.warn('spend cap not configured; letting the call through');
    return null;
  }

  const { userId, anonymous } = await callerIdentity(request, url, anonKey);

  let verdict: { ok?: boolean; reason?: string; plan?: string; used?: number; limit?: number };
  try {
    // A caller with an account is judged on their plan; one without is bucketed by address, which
    // is what the whole endpoint used to do and is still the right answer for a caller who is not
    // the app.
    const [path, body] = userId
      ? [
          'claim_ai_units_for_user',
          {
            p_user: userId,
            p_units: units,
            p_anonymous: anonymous,
            p_global_limit: DAILY_UNITS_TOTAL,
          },
        ]
      : [
          'claim_ai_units',
          {
            p_bucket: callerBucket(request),
            p_units: units,
            p_bucket_limit: 60,
            p_global_limit: DAILY_UNITS_TOTAL,
          },
        ];

    const response = await fetch(`${url}/rest/v1/rpc/${path}`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      console.error('spend cap unavailable', response.status, await response.text().catch(() => ''));
      return null;
    }
    const answer = await response.json();
    // The IP path answers with a word, the user path with an object. Normalised here so there is
    // one thing to check below.
    verdict = typeof answer === 'string' ? { ok: answer === 'ok', reason: answer } : answer;
  } catch (error) {
    // Fails open. A knitter halfway up a sleeve should not be stopped by a database hiccup, and the
    // ceilings inside this function still bound what any single call can cost.
    console.error('spend cap unreachable', error);
    return null;
  }

  if (verdict.ok) return null;

  console.warn(`spend cap hit: ${verdict.reason}, task ${task}, plan ${verdict.plan ?? 'unknown'}`);

  const midnight = new Date();
  midnight.setUTCHours(24, 0, 0, 0);
  return json(
    {
      error:
        verdict.reason === 'global'
          ? "Knitwit's daily allowance for reading patterns is used up. It resets tomorrow."
          : "You've read a lot of patterns today — the daily limit resets tomorrow.",
    },
    429,
    { 'Retry-After': String(Math.ceil((midnight.getTime() - Date.now()) / 1000)) },
  );
}

function validateMaterialRequest(body: Record<string, unknown>): MaterialRequest {
  const image = body.image;
  if (typeof image !== 'string' || !image.startsWith('data:image/')) {
    throw new BadRequest('Send the photo as an image data URL.');
  }
  if (image.length > MAX_IMAGE_CHARS) throw new BadRequest('That photo is too large.');
  return {
    task: 'material',
    image,
    model: typeof body.model === 'string' ? body.model : undefined,
  };
}

// A web search, straight to the tool endpoint. Not behind the provider seam: that seam is about
// "a model that returns JSON matching a schema", and this returns neither a model's words nor a
// schema. Keeping it separate leaves the seam meaning one thing.
async function searchTheWeb(query: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.greenpt.ai/v1/tools/websearch', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, count: SEARCH_RESULTS, language: 'en' }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const error = new Error(`Search returned ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`);
    (error as { status?: number }).status = response.status;
    throw error;
  }
  return (await response.text()).slice(0, MAX_SEARCH_CHARS);
}

function validateEnrichRequest(body: Record<string, unknown>): EnrichRequest {
  const brand = typeof body.brand === 'string' ? body.brand.trim().slice(0, MAX_NAME_CHARS) : '';
  const colorName =
    typeof body.colorName === 'string' ? body.colorName.trim().slice(0, MAX_NAME_CHARS) : '';
  // Without a yarn name there is nothing to search for, and a search on a colour alone returns
  // paint charts.
  if (!brand && !colorName) throw new BadRequest('Name the yarn before looking it up.');

  const asked = Array.isArray(body.missing) ? body.missing : [];
  // Only fields this endpoint is allowed to fill. Price and dye lot are not among them by design
  // (see ENRICHABLE_FIELDS), so asking for them here quietly gets nothing rather than an error.
  const missing = ENRICHABLE_FIELDS.filter((field) => asked.includes(field));
  if (missing.length === 0) throw new BadRequest('Nothing left to look up.');

  return {
    task: 'enrich',
    brand,
    colorName,
    missing: [...missing],
    model: typeof body.model === 'string' ? body.model : undefined,
  };
}

async function handleEnrich(req: EnrichRequest, provider: ModelProvider): Promise<Response> {
  const apiKey = Deno.env.get('GREENPT_API_KEY');
  if (!apiKey) return json({ error: 'Looking yarn up is not configured on this server.' }, 503);

  const query = buildEnrichQuery(req.brand, req.colorName, req.missing);
  const results = await searchTheWeb(query, apiKey);

  const result = await provider.complete({
    system: ENRICH_SYSTEM_PROMPT,
    user: [
      `Yarn: ${[req.brand, req.colorName].filter(Boolean).join(' — ')}`,
      `Fields still missing: ${req.missing.join(', ')}`,
      '',
      'Search results:',
      results,
    ].join('\n'),
    schema: ENRICH_SCHEMA as unknown as Record<string, unknown>,
    model: req.model ?? provider.defaultModel,
    maxTokens: MAX_MATERIAL_OUTPUT_TOKENS,
  });

  const read = JSON.parse(result.text);
  if (typeof read !== 'object' || read === null || Array.isArray(read)) {
    throw new Error('Model returned something that is not a yarn.');
  }

  // Check the claim before passing it on. `found` is the model's own opinion and it was wrong in
  // exactly the way that matters: asked about "DROPS Design" it answered confidently about a
  // different DROPS yarn. Making it name what it matched turns that from an opinion into something
  // that can be tested.
  const matchedName = typeof (read as { matchedName?: unknown }).matchedName === 'string'
    ? ((read as { matchedName: string }).matchedName)
    : '';
  const matched =
    (read as { found?: unknown }).found === true && nameLooksLikeMatch(req.brand, matchedName);

  // Asked for is not the same as allowed. The model answers the whole schema, so anything the
  // caller did not ask about is dropped here rather than travelling back as a value it never
  // requested and would have no reason to check.
  const filled: Record<string, unknown> = {};
  if (matched) {
    for (const field of req.missing) filled[field] = (read as Record<string, unknown>)[field];
  }

  console.log(
    JSON.stringify({
      event: 'parse-pattern',
      task: 'enrich',
      provider: provider.name,
      model: result.model,
      asked: req.missing.length,
      found: (read as { found?: unknown }).found === true,
      matched,
      matched_name: matchedName.slice(0, 80),
      search_chars: results.length,
      usage: result.usage,
    }),
  );

  return json({
    model: result.model,
    material: filled,
    found: matched,
    matchedName,
    usage: result.usage,
  });
}

// Translation runs on a small model on purpose.
//
// Not glm-5.3-flash, which is the obvious "small" choice here and has hung on us before — a
// translation that never returns is worse than one that costs a fraction more. This is the same
// model the ball-band reader uses, so it is a known quantity at this size and price.
const TRANSLATE_MODEL = 'mistral-small-3.2-24b-instruct-2506';

const TRANSLATE_SYSTEM_PROMPT = `You translate knitting and crochet patterns.

You are given a list of {id, text} entries and a target language. Return the same list, with the
same ids, with each text translated into the target language.

Rules, in order of importance:

1. NEVER change a number. Stitch counts, row numbers, sizes, measurements and needle sizes are
   instructions, not language. "k2, p2" has two numbers and the translation has the same two.
   If you are unsure how to translate a phrase, keep it — but keep its numbers exactly.
2. Use the standard knitting vocabulary and abbreviations of the TARGET language, as a pattern
   published in that language would write them. Do not carry English abbreviations across, and do
   not reach for a word from a neighbouring language because it looks close enough. If a glossary
   is given below, it is the published vocabulary and it overrides your own preference.
3. Return every id you were given, spelled exactly as given. Do not invent ids, do not merge
   entries, do not reorder them, do not add commentary.
4. Keep the register of a written pattern: instructions in the imperative, short lines short.
5. Preserve line breaks within a text.

Also report the language the source was written in, as an English name (for example "English",
"Dutch", "German"). If entries are in more than one language, name the dominant one.`;

const TRANSLATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['sourceLanguage', 'entries'],
  properties: {
    sourceLanguage: { type: 'string' },
    entries: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'text'],
        properties: { id: { type: 'string' }, text: { type: 'string' } },
      },
    },
  },
} as const;

type TranslateRequest = {
  task: 'translate';
  language: string;
  entries: { id: string; text: string }[];
  model?: string;
};

function validateTranslateRequest(body: Record<string, unknown>): TranslateRequest {
  const language = body.language;
  if (typeof language !== 'string' || !language.trim()) {
    throw new BadRequest('Say which language to translate into.');
  }
  if (language.length > MAX_LANGUAGE_CHARS) throw new BadRequest('That is not a language.');

  const entries = body.entries;
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new BadRequest('There is nothing to translate.');
  }
  if (entries.length > MAX_TRANSLATE_ENTRIES) throw new BadRequest('That pattern is too long.');

  let total = 0;
  const clean = entries.map((entry) => {
    if (typeof entry !== 'object' || entry === null) throw new BadRequest('Malformed request.');
    const { id, text } = entry as { id?: unknown; text?: unknown };
    if (typeof id !== 'string' || !id || id.length > MAX_TRANSLATE_ID_CHARS) {
      throw new BadRequest('Malformed request.');
    }
    if (typeof text !== 'string') throw new BadRequest('Malformed request.');
    total += text.length;
    if (total > MAX_TRANSLATE_CHARS) throw new BadRequest('That pattern is too long.');
    return { id, text };
  });

  return {
    task: 'translate',
    language: language.trim(),
    entries: clean,
    model: typeof body.model === 'string' ? body.model : undefined,
  };
}

async function handleTranslate(req: TranslateRequest, provider: ModelProvider): Promise<Response> {
  // Only the target language's terms. Sending all of them would be most of the prompt, and the
  // model does not need to be told what Danish for "purl" is while translating into Dutch.
  const result = await provider.complete({
    system: TRANSLATE_SYSTEM_PROMPT + glossaryFor(req.language),
    user: JSON.stringify({ targetLanguage: req.language, entries: req.entries }),
    schema: TRANSLATE_SCHEMA as unknown as Record<string, unknown>,
    model: req.model ?? TRANSLATE_MODEL,
    maxTokens: MAX_TRANSLATE_OUTPUT_TOKENS,
  });

  const read = JSON.parse(result.text);
  if (typeof read !== 'object' || read === null || !Array.isArray(read.entries)) {
    throw new Error('Model returned something that is not a translation.');
  }

  // Only entries that were actually asked for, and only in the shape promised. The caller falls
  // back to the original words for anything missing, so dropping a malformed entry costs one
  // untranslated line rather than a line of somebody else's output.
  const asked = new Set(req.entries.map((entry) => entry.id));
  const entries = (read.entries as unknown[])
    .filter((entry): entry is { id: string; text: string } => {
      if (typeof entry !== 'object' || entry === null) return false;
      const { id, text } = entry as { id?: unknown; text?: unknown };
      return typeof id === 'string' && typeof text === 'string' && asked.has(id);
    })
    .map((entry) => ({ id: entry.id, text: entry.text }));

  // The pattern's words are never logged — only how much of it came back.
  console.log(
    JSON.stringify({
      event: 'parse-pattern',
      task: 'translate',
      provider: provider.name,
      model: result.model,
      language: req.language,
      asked: req.entries.length,
      returned: entries.length,
      usage: result.usage,
    }),
  );

  return json({
    model: result.model,
    sourceLanguage: typeof read.sourceLanguage === 'string' ? read.sourceLanguage : '',
    entries,
    usage: result.usage,
  });
}

async function handleMaterial(req: MaterialRequest, provider: ModelProvider): Promise<Response> {
  const result = await provider.complete({
    system: MATERIAL_SYSTEM_PROMPT,
    user: 'Read this ball band and report what it says.',
    image: req.image,
    schema: MATERIAL_SCHEMA as unknown as Record<string, unknown>,
    // Pinned, not defaulted: the text models this function usually reaches for cannot see.
    model: req.model ?? VISION_MODEL,
    maxTokens: MAX_MATERIAL_OUTPUT_TOKENS,
  });

  const read = JSON.parse(result.text);
  if (typeof read !== 'object' || read === null || Array.isArray(read)) {
    throw new Error('Model returned something that is not a yarn.');
  }

  // The photo itself is never logged — only that one was read, and what it cost.
  console.log(
    JSON.stringify({
      event: 'parse-pattern',
      task: 'material',
      provider: provider.name,
      model: result.model,
      image_chars: req.image.length,
      confident: (read as { confident?: unknown }).confident === true,
      usage: result.usage,
    }),
  );

  return json({ model: result.model, material: read, usage: result.usage });
}

async function handleDocument(req: DocumentRequest, provider: ModelProvider): Promise<Response> {
  const result = await provider.complete({
    system: DOCUMENT_SYSTEM_PROMPT,
    user: buildDocumentUserMessage(req),
    schema: DOCUMENT_SCHEMA,
    model: req.model ?? provider.defaultModel,
    maxTokens: MAX_DOCUMENT_OUTPUT_TOKENS,
  });

  const draft = JSON.parse(result.text);
  if (typeof draft !== 'object' || draft === null || Array.isArray(draft)) {
    throw new Error('Model returned something that is not a pattern.');
  }

  // Only a shape check here — the client normalises every field before it reaches the wizard, and
  // duplicating that whole pass in a second runtime would just give it two places to drift.
  const sections = Array.isArray((draft as { sections?: unknown }).sections)
    ? (draft as { sections: unknown[] }).sections
    : [];

  console.log(
    JSON.stringify({
      event: 'parse-pattern',
      task: 'document',
      provider: provider.name,
      model: result.model,
      input_chars: req.text.length,
      sections_found: sections.length,
      usage: result.usage,
    }),
  );

  return json({ model: result.model, draft, usage: result.usage });
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const body = await request.json().catch(() => null);
  const task = (body as { task?: unknown } | null)?.task;

  let provider: ModelProvider;
  try {
    provider = selectProvider();
  } catch (error) {
    console.error('provider unavailable', error);
    return json({ error: 'Pattern reading is not configured on this server.' }, 503);
  }

  // Before any work, and before any money is spent. Placed after selectProvider so a server that
  // is not configured still says so rather than charging budget for a call that cannot happen.
  const refusal = await claimBudget(request, typeof task === 'string' ? task : 'unknown');
  if (refusal) return refusal;

  if (task === 'enrich') {
    let req: EnrichRequest;
    try {
      req = validateEnrichRequest(body as Record<string, unknown>);
    } catch (error) {
      return json(
        { error: error instanceof BadRequest ? error.message : 'Malformed request.' },
        400,
      );
    }
    try {
      return await handleEnrich(req, provider);
    } catch (error) {
      console.error('parse-pattern enrich failed', error);
      const message = error instanceof Error ? error.message : 'Unknown error.';
      return json({ error: `Couldn't look that yarn up: ${message}` }, statusOf(error));
    }
  }

  if (task === 'translate') {
    let req: TranslateRequest;
    try {
      req = validateTranslateRequest(body as Record<string, unknown>);
    } catch (error) {
      return json(
        { error: error instanceof BadRequest ? error.message : 'Malformed request.' },
        400,
      );
    }
    try {
      return await handleTranslate(req, provider);
    } catch (error) {
      console.error('parse-pattern translate failed', error);
      const message = error instanceof Error ? error.message : 'Unknown error.';
      return json({ error: `Couldn't translate that pattern: ${message}` }, statusOf(error));
    }
  }

  if (task === 'material') {
    let req: MaterialRequest;
    try {
      req = validateMaterialRequest(body as Record<string, unknown>);
    } catch (error) {
      return json(
        { error: error instanceof BadRequest ? error.message : 'Malformed request.' },
        400,
      );
    }
    try {
      return await handleMaterial(req, provider);
    } catch (error) {
      console.error('parse-pattern material failed', error);
      const message = error instanceof Error ? error.message : 'Unknown error.';
      return json({ error: `Couldn't read that label: ${message}` }, statusOf(error));
    }
  }

  if (task === 'document') {
    let req: DocumentRequest;
    try {
      req = validateDocumentRequest(body as Record<string, unknown>);
    } catch (error) {
      return json(
        { error: error instanceof BadRequest ? error.message : 'Malformed request.' },
        400,
      );
    }
    try {
      return await handleDocument(req, provider);
    } catch (error) {
      console.error('parse-pattern document failed', error);
      const message = error instanceof Error ? error.message : 'Unknown error.';
      return json({ error: `Couldn't read that pattern: ${message}` }, statusOf(error));
    }
  }

  let req: ParsePatternRequest;
  try {
    req = validateRequest(body);
  } catch (error) {
    return json({ error: error instanceof BadRequest ? error.message : 'Malformed request.' }, 400);
  }

  try {
    return await handleRows(req, provider);
  } catch (error) {
    console.error('parse-pattern rows failed', error);
    const message = error instanceof Error ? error.message : 'Unknown error.';
    return json({ error: `Couldn't convert those rows: ${message}` }, statusOf(error));
  }
});
