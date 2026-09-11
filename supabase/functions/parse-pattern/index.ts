import { buildUserMessage, SYSTEM_PROMPT } from './prompt.ts';
import { anthropicProvider } from './provider-anthropic.ts';
import { greenptProvider } from './provider-greenpt.ts';
import type { ModelProvider } from './provider.ts';
import {
  ROWS_SCHEMA,
  SPANS,
  STITCH_TYPES,
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

function validateRequest(body: unknown): ParsePatternRequest {
  if (typeof body !== 'object' || body === null) throw new BadRequest('Body must be an object.');
  const b = body as Record<string, unknown>;

  if (b.task !== 'rows') throw new BadRequest('Unsupported task — expected "rows".');

  const sectionText = typeof b.sectionText === 'string' ? b.sectionText : '';
  if (sectionText.length > MAX_SECTION_CHARS) {
    throw new BadRequest(`Section text is too long (max ${MAX_SECTION_CHARS} characters).`);
  }

  if (!Array.isArray(b.rows) || b.rows.length === 0) {
    throw new BadRequest('No rows to convert.');
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

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  let req: ParsePatternRequest;
  try {
    req = validateRequest(await request.json().catch(() => null));
  } catch (error) {
    return json({ error: error instanceof BadRequest ? error.message : 'Malformed request.' }, 400);
  }

  let provider: ModelProvider;
  try {
    provider = selectProvider();
  } catch (error) {
    console.error('provider unavailable', error);
    return json({ error: 'Pattern conversion is not configured on this server.' }, 503);
  }

  try {
    const result = await provider.complete({
      system: SYSTEM_PROMPT,
      user: buildUserMessage(req),
      schema: ROWS_SCHEMA,
      model: req.model ?? provider.defaultModel,
      maxTokens: MAX_OUTPUT_TOKENS,
    });

    const rows = validateModelRows(JSON.parse(result.text), req.sizes.length);

    // Logged, not returned: enough to track cost per import and cache hit rate without putting
    // anything the knitter wrote into the logs.
    console.log(
      JSON.stringify({
        event: 'parse-pattern',
        provider: provider.name,
        model: result.model,
        rows_requested: req.rows.length,
        rows_returned: rows.length,
        rows_confident: rows.filter((r) => r.confident).length,
        usage: result.usage,
      }),
    );

    return json({ model: result.model, rows, usage: result.usage });
  } catch (error) {
    console.error('parse-pattern failed', error);
    const message = error instanceof Error ? error.message : 'Unknown error.';
    // Surface the status the provider gave us, so a rate limit reads as one to the client.
    const status =
      typeof (error as { status?: unknown }).status === 'number'
        ? ((error as { status: number }).status as number)
        : 502;
    return json({ error: `Couldn't convert those rows: ${message}` }, status >= 400 ? status : 502);
  }
});
