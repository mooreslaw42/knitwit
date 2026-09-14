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
// Must stay in step with STITCHES in src/constants/catalogs.ts — a type the model can return but
// the app has no entry for draws a blank cell and, worse, contributes nothing to the running
// count. Both crafts are listed; which one applies is said in the user turn.
export const STITCH_TYPES = [
  // Knitting
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
  // Crochet
  'ch',
  'slst',
  'sc',
  'hdc',
  'dc',
  'tr',
  'scinc',
  'dcinc',
  'sc2tog',
  'dc2tog',
  'shell',
  // Either
  'co',
  'bo',
  'pm',
] as const;

export const SPANS = ['exact', 'all', 'to-last'] as const;

// Mirrors PatternCategory / PatternLevel / ToolType in src/types/knitwit.ts. Constraining the
// model to these means the wizard never has to cope with a category it has no label for.
// Must stay in step with PatternCategory in src/types/knitwit.ts. The model can only answer with
// what is listed here, so a category the app knows and this doesn't is one it will never pick.
export const CATEGORIES = [
  'sweaters',
  'cardigans',
  'tops',
  'dresses',
  'accessories',
  'hats',
  'scarves',
  'shawls',
  'mittens',
  'socks',
  'slippers',
  'bags',
  'blankets',
  'cushions',
  'dishcloths',
  'home',
  'toys',
  'baby',
  'swatches',
  'other',
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
  // The whole section. In fill mode the model reads it for context only; in section mode it is
  // the thing being charted.
  sectionText: string;
  // Exactly the rows the deterministic parser refused. Sending the refusals rather than the whole
  // section keeps the call small and stops the model second-guessing rows we already got right.
  //
  // Empty means **section mode**: the parser couldn't read this section at all, so there are no
  // refusals to list and the model charts the section from scratch.
  rows: { index: number; label: string; side: 'RS' | 'WS'; instruction: string }[];
  // The pattern's size names. Per-size counts must come back with one entry per size.
  sizes: string[];
  // Which stitch vocabulary to read the rows in. Both tables are in the system prompt; this picks
  // one. Absent means knitting, which is what every request sent before crochet existed.
  craft?: 'knit' | 'crochet' | 'both';
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

// One row's worth of stitch groups. Shared by both row schemas below — the stitch vocabulary and
// the per-size count rule are the same whether the model is filling a gap or charting a whole
// section, and duplicating them would let the two drift.
const STITCHES_PROPERTY = {
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
} as const;

// Section mode needs each row's identity back as well as its stitches, because these rows don't
// exist yet — nothing on the client can supply a label, a side or the original wording. Kept as a
// separate schema from ROWS_SCHEMA so the far more common fill mode isn't billed for three extra
// string fields per row that it would only throw away.
const SECTION_ROW_PROPERTIES = {
  index: {
    type: 'integer',
    description: 'Position of this row in the section, starting at 0 and counting up with no gaps.',
  },
  label: { type: 'string', description: 'What the pattern calls this row, e.g. "Row 7".' },
  side: { type: 'string', enum: ['RS', 'WS'] },
  instruction: {
    type: 'string',
    description:
      "The row's wording, copied from the pattern. This is what the knitter reads when the chart " +
      "can't express something, so it must survive verbatim.",
  },
  stitches: STITCHES_PROPERTY,
  confident: { type: 'boolean' },
  note: { type: 'string' },
} as const;

export const SECTION_SCHEMA = {
  type: 'object',
  properties: {
    rows: {
      type: 'array',
      description:
        'Every row this section works, in order, with repeats expanded — if a block of four rows ' +
        'is worked seven times, that is twenty-eight rows, not four.',
      items: {
        type: 'object',
        properties: SECTION_ROW_PROPERTIES,
        required: ['index', 'label', 'side', 'instruction', 'stitches', 'confident', 'note'],
        additionalProperties: false,
      },
    },
  },
  required: ['rows'],
  additionalProperties: false,
} as const;

// ---- Whole-document import (task: 'document') ----

export type DocumentRequest = {
  task: 'document';
  // The whole pattern as text — pasted, or extracted from a PDF's text layer.
  text: string;
  // The shared technique catalogue, so the model can name techniques by slug instead of inventing
  // them. Sent by the client, which caches it anyway, rather than read here: it keeps this
  // function stateless and saves a query per import. Absent means match nothing.
  techniques?: { id: string; name: string }[];
  model?: string;
};

export const DOCUMENT_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'The pattern\'s title. Empty string if not stated.' },
    category: { type: 'string', enum: [...CATEGORIES, ''] },
    craft: {
      type: 'string',
      enum: ['knit', 'crochet', 'both', ''],
      description:
        'Whether the pattern is knitted, crocheted, or uses both (a knitted garment with a ' +
        'crocheted edging). Read it from the stitches and tools the pattern calls for — hooks ' +
        'and stitches like sc/dc/tr mean crochet.',
    },
    level: { type: 'string', enum: [...LEVELS, ''] },
    needleSize: {
      type: 'string',
      description: 'Recommended needle or hook size as written, e.g. "4.5mm" or "4.5mm / US 7".',
    },
    gauge: {
      type: 'object',
      description:
        'The gauge statement, with the window it was measured over. The window matters: "22 sts ' +
        'to 4 inches" is not the same fabric as "22 sts to 10cm", so report the unit the pattern ' +
        'actually used rather than converting. All zeros if no gauge is stated.',
      properties: {
        stitches: { type: 'number', minimum: 0, description: '0 if not stated.' },
        rows: { type: 'number', minimum: 0, description: '0 if not stated.' },
        width: { type: 'number', minimum: 0, description: 'e.g. 10 for 10cm, 4 for 4in.' },
        height: {
          type: 'number',
          minimum: 0,
          description: 'Usually the same as width. Only differs if the pattern says so.',
        },
        unit: { type: 'string', enum: ['cm', 'inch'] },
      },
      required: ['stitches', 'rows', 'width', 'height', 'unit'],
      additionalProperties: false,
    },
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
          // The catalogue slug where the technique is one Knitwit already knows, so two patterns
          // naming the same thing land on the same entry. Empty when it isn't in the list.
          id: { type: 'string' },
          name: { type: 'string' },
          note: { type: 'string' },
        },
        required: ['id', 'name', 'note'],
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
    'craft',
    'level',
    'needleSize',
    'gauge',
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
          stitches: STITCHES_PROPERTY,
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
