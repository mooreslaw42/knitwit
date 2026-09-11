import { EMPTY_USAGE, type ModelProvider, type ModelRequest, type ModelResult } from './provider.ts';

// GreenPT (EU Router) — the provider AGENTS.md always named: EU-hosted, renewable-powered, and
// GDPR-aligned. Its API is OpenAI-compatible (`/v1/chat/completions`), so there's no SDK to pull
// in; plain fetch keeps the Edge Function dependency-free and makes the schema fallback below
// easy to see.
const BASE_URL = 'https://api.greenpt.ai/v1';

// The job is small and tightly constrained: read one irregular row, emit a handful of stitch
// groups against a fixed schema. That doesn't want a flagship coding model — glm-5.2 costs
// €1.10/€4.40 per million tokens and is built for multi-file software engineering. glm-5.3-flash
// is a tenth of that (€0.11/€0.44) and still has reasoning and tool use, and being the same
// vendor family its schema handling should match what we've already seen work.
//
// This is safe to be wrong about: rowStitchesAfter() reconciles every parsed row against the
// count the pattern states for itself, so a model that reads rows worse shows up as rows flagged
// for review, not as a silently bad chart. Override per call to compare.
const DEFAULT_MODEL = 'glm-5.3-flash';

// Whether this endpoint honours `response_format: {type:'json_schema'}` is not documented, so we
// find out at runtime rather than assume: ask for the schema, and if the API rejects the
// parameter, fall back to plain JSON mode with the schema stated in the prompt. Remembered per
// isolate so only the first call after a cold start pays for the discovery.
let schemaMode: 'json_schema' | 'json_object' | 'unknown' = 'unknown';

type ChatResponse = {
  model?: string;
  choices?: { message?: { content?: string } }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
  };
};

// An OpenAI-compatible endpoint in JSON mode usually returns bare JSON, but smaller models fence
// it in markdown or prefix it with reasoning. Recover the object rather than failing the import
// over punctuation — the caller validates the result either way.
export function extractJson(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) return trimmed;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end > start) return trimmed.slice(start, end + 1);

  return trimmed;
}

export function greenptProvider(apiKey: string, baseUrl = BASE_URL): ModelProvider {
  async function post(req: ModelRequest, mode: 'json_schema' | 'json_object'): Promise<Response> {
    // In fallback mode the schema moves into the system message. It's the same bytes on every
    // request, so the stable prefix stays stable — whatever caching GreenPT does is unaffected.
    const system =
      mode === 'json_schema'
        ? req.system
        : `${req.system}\n\n# Output\n\nReturn a single JSON object and nothing else — no prose, no markdown fence — matching this JSON Schema exactly:\n\n${JSON.stringify(req.schema)}`;

    return await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: req.model,
        max_tokens: req.maxTokens,
        stream: false,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: req.user },
        ],
        ...(mode === 'json_schema'
          ? {
              response_format: {
                type: 'json_schema',
                json_schema: { name: 'pattern_rows', strict: true, schema: req.schema },
              },
            }
          : { response_format: { type: 'json_object' } }),
      }),
    });
  }

  return {
    name: 'greenpt',
    defaultModel: DEFAULT_MODEL,

    async complete(req: ModelRequest): Promise<ModelResult> {
      let mode: 'json_schema' | 'json_object' =
        schemaMode === 'unknown' ? 'json_schema' : schemaMode;
      let response = await post(req, mode);

      // A 4xx on the first attempt is most likely the unsupported `response_format` — retry once
      // in plain JSON mode before giving up, and remember the answer.
      if (!response.ok && mode === 'json_schema' && response.status >= 400 && response.status < 500) {
        console.warn(
          `GreenPT rejected json_schema (${response.status}); falling back to json_object mode.`,
        );
        schemaMode = 'json_object';
        mode = 'json_object';
        response = await post(req, mode);
      }

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        const error = new Error(
          `GreenPT returned ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`,
        );
        // Carried through so a rate limit reaches the client as one.
        (error as { status?: number }).status = response.status;
        throw error;
      }

      if (schemaMode === 'unknown') schemaMode = mode;

      const body = (await response.json()) as ChatResponse;
      const content = body.choices?.[0]?.message?.content;
      if (!content) throw new Error('GreenPT returned no message content.');

      return {
        text: extractJson(content),
        model: body.model ?? req.model,
        usage: {
          ...EMPTY_USAGE,
          input_tokens: body.usage?.prompt_tokens ?? 0,
          output_tokens: body.usage?.completion_tokens ?? 0,
          cache_read_input_tokens: body.usage?.prompt_tokens_details?.cached_tokens ?? 0,
        },
      };
    },
  };
}
