import {
  buildDocumentUserMessage,
  buildUserMessage,
  DOCUMENT_SYSTEM_PROMPT,
  SYSTEM_PROMPT,
} from './prompt.ts';
import { anthropicProvider } from './provider-anthropic.ts';
import { greenptProvider } from './provider-greenpt.ts';
import type { ModelProvider } from './provider.ts';
import {
  DOCUMENT_SCHEMA,
  ROWS_SCHEMA,
  SECTION_SCHEMA,
  SPANS,
  STITCH_TYPES,
  type DocumentRequest,
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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
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
