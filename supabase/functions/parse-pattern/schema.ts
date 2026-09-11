// The wire contract between the app and this function, plus the JSON schema the model is
// constrained to emit.
//
// These types are deliberately duplicated from `src/types/knitwit.ts` rather than imported: this
// file runs under Deno with no path aliases and no React Native deps, and the app can't import
// from `supabase/functions` either. The duplication is the seam — keep the two in step, and note
// that the *client* re-validates everything that comes back, so a drift here degrades to a
// rejected response rather than corrupt pattern data.

// Every stitch type the app can chart, from src/constants/catalogs.ts. Constraining the model to
// this enum is what stops it inventing a stitch the chart has no symbol for.
export const STITCH_TYPES = [
  'knit',
  'purl',
  'ktbl',
  'slip',
  'k2tog',
  'p2tog',
  'ssk',
  'yo',
  'kfb',
  'm1l',
  'm1r',
  'co',
  'bo',
  'pm',
] as const;

export const SPANS = ['exact', 'all', 'to-last'] as const;

export type ParsePatternRequest = {
  task: 'rows';
  // The whole section, for context — the model reads it but only charts the rows listed below.
  sectionText: string;
  // Exactly the rows the deterministic parser refused. Sending the refusals rather than the whole
  // section keeps the call small and stops the model second-guessing rows we already got right.
  rows: { index: number; label: string; side: 'RS' | 'WS'; instruction: string }[];
  // The pattern's size names. Per-size counts must come back with one entry per size.
  sizes: string[];
  // Stitches on the needle before the first listed row, so "knit to last 2 sts" is resolvable.
  stitchesBefore: number;
  // Per-call model override, so one path can be promoted without moving the others.
  model?: string;
};

export type ModelGroup = {
  type: string;
  span: 'exact' | 'all' | 'to-last';
  // One entry per size. Empty means "no count" (only valid with span 'all').
  count: number[];
  note: string;
};

export type ModelRow = {
  index: number;
  stitches: ModelGroup[];
  // The model's own judgement. A row it isn't sure about is surfaced for review rather than
  // applied quietly — the stitch-count check catches most errors, but not all of them.
  confident: boolean;
  note: string;
};

export type ParsePatternResponse = {
  model: string;
  rows: ModelRow[];
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
  };
};

// Strict JSON schema — `additionalProperties: false` and a fully `required` object at every level
// is what "strict" means to the API, and it's what lets a smaller model be reliable here.
export const ROWS_SCHEMA = {
  type: 'object',
  properties: {
    rows: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: {
            type: 'integer',
            description: 'The index of the row being charted, copied from the request.',
          },
          stitches: {
            type: 'array',
            description: 'The row worked left to right, in the order the knitter works it.',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: [...STITCH_TYPES] },
                span: {
                  type: 'string',
                  enum: [...SPANS],
                  description:
                    "'exact' works `count` stitches; 'all' works every remaining stitch; " +
                    "'to-last' works up to the last `count` stitches.",
                },
                count: {
                  type: 'array',
                  items: { type: 'integer', minimum: 0 },
                  description:
                    'One entry per size, in the order the sizes were given. Use an empty array ' +
                    "only when span is 'all'. If the pattern gives one number for all sizes, " +
                    'repeat it for every size.',
                },
                note: { type: 'string' },
              },
              required: ['type', 'span', 'count', 'note'],
              additionalProperties: false,
            },
          },
          confident: {
            type: 'boolean',
            description:
              'False if the instruction is ambiguous or you had to guess. False is always better ' +
              'than a confident guess — the app shows unconfident rows to the knitter for review.',
          },
          note: {
            type: 'string',
            description: 'If confident is false, one short sentence on what was unclear.',
          },
        },
        required: ['index', 'stitches', 'confident', 'note'],
        additionalProperties: false,
      },
    },
  },
  required: ['rows'],
  additionalProperties: false,
} as const;
