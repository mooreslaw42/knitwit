import Anthropic from '@anthropic-ai/sdk';

import { EMPTY_USAGE, type ModelProvider, type ModelRequest, type ModelResult } from './provider.ts';

// Sonnet 5 is the starting default on every call. It's the cheap end of the range that can still
// do this reliably, and the work is heavily constrained — a strict JSON schema, a closed stitch
// vocabulary, and an arithmetic check the app runs afterwards. Promote a path to Opus only when
// the measured reconcile rate says to, not on a hunch; the response carries the model back so
// that number can be attributed.
const DEFAULT_MODEL = 'claude-sonnet-5';

export function anthropicProvider(apiKey: string): ModelProvider {
  const client = new Anthropic({ apiKey });

  return {
    name: 'anthropic',
    defaultModel: DEFAULT_MODEL,

    async complete(req: ModelRequest): Promise<ModelResult> {
      const response = await client.messages.create({
        model: req.model,
        max_tokens: req.maxTokens,
        system: [
          {
            type: 'text',
            text: req.system,
            // The breakpoint sits at the end of the stable prefix, not the end of the prompt —
            // the user turn differs every time, so marking that instead would write a fresh
            // cache entry per request and never read one.
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: req.user }],
        // Structured outputs: the response is schema-valid JSON rather than prose we'd have to
        // re-parse. Constraining the shape this hard is also what makes a smaller model viable.
        output_config: { format: { type: 'json_schema', schema: req.schema } },
        // Sonnet 5 runs adaptive thinking by default; stating it keeps the intent visible, and
        // the arithmetic in a graded row genuinely benefits from it. `budget_tokens` is rejected
        // on this model — don't reintroduce it.
        thinking: { type: 'adaptive' },
      });

      const text = response.content.find((block) => block.type === 'text');
      if (!text || text.type !== 'text') {
        throw new Error(`Model returned no text block (stop reason: ${response.stop_reason}).`);
      }

      const usage = response.usage;
      return {
        text: text.text,
        model: response.model,
        usage: {
          ...EMPTY_USAGE,
          input_tokens: usage.input_tokens ?? 0,
          output_tokens: usage.output_tokens ?? 0,
          cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
          cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
        },
      };
    },
  };
}
