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

// Where to go when the default model itself is down.
//
// Measured 2026-09-14: glm-5.3-flash returned 503 "The model provider encountered an error" on
// 9 of 11 calls while glm-5.2 answered 4 of 4, so this is one model being unwell rather than
// GreenPT being down — and no amount of retrying the same name fixes that.
//
// glm-5.2 is ten times the price (€1.10/€4.40 per million against €0.11/€0.44), which is exactly
// why it isn't the default. It is still far cheaper than an import that doesn't work. The
// fallback is deliberately narrow: only when the *default* was in play, and only after the
// retries are spent, so a caller who pinned a model still gets the model they asked for and a
// healthy day never touches it. Every response carries the model that answered, and the usage
// log records it, so the cost of a bad week is visible rather than inferred.
const FALLBACK_MODEL = 'glm-5.2';

// Whether this endpoint honours `response_format: {type:'json_schema'}` is not documented, so we
// find out at runtime rather than assume: ask for the schema, and if the API rejects the
// parameter, fall back to plain JSON mode with the schema stated in the prompt. Remembered per
// isolate so only the first call after a cold start pays for the discovery.
let schemaMode: 'json_schema' | 'json_object' | 'unknown' = 'unknown';

// Transient failures, retried rather than surfaced.
//
// A 503 here is the upstream model provider blinking, not a problem with the request — GreenPT's
// own body says "Please try again". Without this, one hiccup ends the whole import: a document
// pass is a single call with up to 32k output tokens, so the knitter waits, loses it, and has to
// re-upload and pay for the tokens again. The Anthropic provider has retried 429s and 5xx all
// along, because its SDK does it by default; this brings the fetch path in line.
//
// 408/409/429 are in the list too — request timeout, lock conflict, rate limit — all of which
// mean "same request, later", unlike the rest of the 4xx range which means "not this request".
const RETRY_STATUSES = new Set([408, 409, 429, 500, 502, 503, 504]);

// Three in total, not more. Supabase Edge Functions have a wall-clock budget and a document call
// is already slow, so the backoff stays short: a provider that is actually down should fail the
// import quickly rather than hold the request open until the platform kills it.
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 4_000;

export function isRetryableStatus(status: number): boolean {
  return RETRY_STATUSES.has(status);
}

// How long to wait before attempt N+1 (`attempt` is 1-based).
//
// `Retry-After` wins when the server states one, since it knows better than our curve — both
// forms are allowed by the spec, a count of seconds or an HTTP date. Otherwise exponential with
// full jitter: two Edge Function isolates that fail at the same moment shouldn't retry in step.
export function retryDelayMs(
  attempt: number,
  retryAfter: string | null,
  random: () => number = Math.random,
): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, MAX_DELAY_MS);
    const at = Date.parse(retryAfter);
    if (Number.isFinite(at)) return Math.min(Math.max(at - Date.now(), 0), MAX_DELAY_MS);
  }
  const ceiling = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);
  return Math.round(ceiling * random());
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

  // `post`, plus the transient-failure retries. A network-level throw is treated the same as a
  // retryable status: from here they are the same event, a request that didn't land.
  async function postWithRetry(
    req: ModelRequest,
    mode: 'json_schema' | 'json_object',
  ): Promise<Response> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      let response: Response;
      try {
        response = await post(req, mode);
      } catch (error) {
        lastError = error;
        if (attempt === MAX_ATTEMPTS) throw error;
        await sleep(retryDelayMs(attempt, null));
        continue;
      }

      if (response.ok || !isRetryableStatus(response.status)) return response;
      if (attempt === MAX_ATTEMPTS) return response;

      const delay = retryDelayMs(attempt, response.headers.get('retry-after'));
      console.warn(
        `GreenPT returned ${response.status}; retrying in ${delay}ms (attempt ${attempt} of ${MAX_ATTEMPTS}).`,
      );
      // The body is never read on this path, so cancel it rather than leaking the stream.
      await response.body?.cancel().catch(() => {});
      await sleep(delay);
    }

    // Unreachable — the loop either returns or throws — but it keeps the signature honest.
    throw lastError ?? new Error('GreenPT could not be reached.');
  }

  return {
    name: 'greenpt',
    defaultModel: DEFAULT_MODEL,

    async complete(req: ModelRequest): Promise<ModelResult> {
      let mode: 'json_schema' | 'json_object' =
        schemaMode === 'unknown' ? 'json_schema' : schemaMode;
      let response = await postWithRetry(req, mode);

      // The default model is down rather than busy — retries are spent and it is still failing
      // transiently. Try the fallback once before giving up. Only for the default: a pinned model
      // is a deliberate choice, and quietly answering with a different one would make a
      // comparison run lie about what it measured.
      if (!response.ok && isRetryableStatus(response.status) && req.model === DEFAULT_MODEL) {
        console.warn(
          `GreenPT: ${DEFAULT_MODEL} still failing with ${response.status} after ${MAX_ATTEMPTS} attempts; falling back to ${FALLBACK_MODEL}, which costs more.`,
        );
        await response.body?.cancel().catch(() => {});
        response = await postWithRetry({ ...req, model: FALLBACK_MODEL }, mode);
      }

      // A 4xx on the first attempt is most likely the unsupported `response_format` — retry once
      // in plain JSON mode before giving up, and remember the answer. The retryable 4xx codes are
      // excluded: a rate limit that outlasted its retries says nothing about schema support, and
      // treating it as a rejection would spend one more call to learn the wrong lesson and
      // strand the isolate in json_object mode for good.
      if (
        !response.ok &&
        mode === 'json_schema' &&
        response.status >= 400 &&
        response.status < 500 &&
        !isRetryableStatus(response.status)
      ) {
        console.warn(
          `GreenPT rejected json_schema (${response.status}); falling back to json_object mode.`,
        );
        schemaMode = 'json_object';
        mode = 'json_object';
        response = await postWithRetry(req, mode);
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
