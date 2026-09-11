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

// Mirrors PatternCategory / PatternLevel / ToolType in src/types/knitwit.ts. Constraining the
// model to these means the wizard never has to cope with a category it has no label for.
export const CATEGORIES = [
  'sweaters',
  'accessories',
  'hats',
  'scarves',
  'socks',
  'blankets',
  'toys',
  'home',
  'baby',
  'queue',
] as const;

export const LEVELS = ['beginner', 'easy', 'intermediate', 'advanced'] as const;

export const TOOL_TYPES = [
  'straight',
  'circular',
  'dpn',
  'interchangeable',
  'crochet-hook',
  'cable-needle',
  'cable-pin',
  'other',
] as const;

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

// ---- Whole-document import (task: 'document') ----

export type DocumentRequest = {
  task: 'document';
  // The whole pattern as text — pasted, or extracted from a PDF's text layer.
  text: string;
  model?: string;
};

export const DOCUMENT_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'The pattern\'s title. Empty string if not stated.' },
    category: { type: 'string', enum: [...CATEGORIES, ''] },
    level: { type: 'string', enum: [...LEVELS, ''] },
    needleSize: {
      type: 'string',
      description: 'Recommended needle or hook size as written, e.g. "4.5mm" or "4.5mm / US 7".',
    },
    gaugeStitches: {
      type: 'string',
      description: 'Stitches per 10cm/4in from the gauge statement. Digits only, or empty.',
    },
    gaugeRows: { type: 'string', description: 'Rows per 10cm/4in. Digits only, or empty.' },
    sizes: {
      type: 'array',
      description:
        'Size names in the order the pattern grades them, e.g. ["S","M","L"]. Empty if unsized.',
      items: { type: 'string' },
    },
    materials: {
      type: 'array',
      description:
        'The yarns the pattern calls for, as generic slots — "Yarn A, DK weight wool" — never a ' +
        'brand the knitter must own.',
      items: {
        type: 'object',
        properties: {
          label: {
            type: 'string',
            description:
              'A short name, under 50 characters — "Yarn A — DK weight wool". It is shown on a ' +
              'chip, so do not pack the fibre, the ball weight and the per-size yardage into it.',
          },
          short: { type: 'string', description: 'One letter for charts: A, B, C…' },
        },
        required: ['label', 'short'],
        additionalProperties: false,
      },
    },
    tools: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: [...TOOL_TYPES] },
          thickness: { type: 'string', description: 'e.g. "4.5mm"' },
          note: { type: 'string', description: 'e.g. "US 7, 80cm cable"' },
        },
        required: ['type', 'thickness', 'note'],
        additionalProperties: false,
      },
    },
    techniques: {
      type: 'array',
      description: 'Named techniques the pattern assumes, e.g. "German short rows".',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          note: { type: 'string' },
        },
        required: ['name', 'note'],
        additionalProperties: false,
      },
    },
    sections: {
      type: 'array',
      description:
        'The pattern split into the pieces it is worked in — Back, Front, Sleeve, Collar. Each ' +
        "carries its own instructions verbatim, so they can be charted later.",
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          castOn: {
            type: 'array',
            description:
              'Cast-on stitches, one per size in the order given above. Empty if not stated.',
            items: { type: 'integer', minimum: 0 },
          },
          totalRows: {
            type: 'array',
            description: 'Row count, one per size. Empty if not stated.',
            items: { type: 'integer', minimum: 0 },
          },
          description: {
            type: 'string',
            description:
              "This section's instructions, copied verbatim from the pattern. Do not summarise, " +
              'reword, or renumber — this text is charted row by row afterwards, and anything ' +
              'you change is changed for the knitter too.',
          },
          usesMaterials: {
            type: 'array',
            description:
              'Which yarns this section uses, as indices into the materials list above (0 is the ' +
              'first). A section worked in one yarn throughout still lists it. Empty only if the ' +
              'pattern genuinely does not say.',
            items: { type: 'integer', minimum: 0 },
          },
          usesTools: {
            type: 'array',
            description:
              'Which tools this section uses, as indices into the tools list above — the needle ' +
              'size this piece is worked on, which often differs from the main one (ribbing, ' +
              'edgings).',
            items: { type: 'integer', minimum: 0 },
          },
          usesTechniques: {
            type: 'array',
            description: 'Which techniques this section calls for, as indices into the list above.',
            items: { type: 'integer', minimum: 0 },
          },
        },
        required: [
          'name',
          'castOn',
          'totalRows',
          'description',
          'usesMaterials',
          'usesTools',
          'usesTechniques',
        ],
        additionalProperties: false,
      },
    },
    notes: {
      type: 'string',
      description: 'Anything important that did not fit above. One or two sentences, or empty.',
    },
  },
  required: [
    'name',
    'category',
    'level',
    'needleSize',
    'gaugeStitches',
    'gaugeRows',
    'sizes',
    'materials',
    'tools',
    'techniques',
    'sections',
    'notes',
  ],
  additionalProperties: false,
} as const;

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
