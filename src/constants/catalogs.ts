// Ported verbatim from reference/index.html's catalog constants.
import type {
  PatternCategory,
  ProjectStatus,
  SectionStatus,
  TechniqueCraft,
  ToolType,
} from '@/types/knitwit';

export const CATEGORY_LABELS: Record<PatternCategory, string> = {
  sweaters: 'Sweater & jumper',
  cardigans: 'Cardigan',
  tops: 'Top & tee',
  dresses: 'Dress & skirt',
  accessories: 'Accessory',
  hats: 'Hat & beanie',
  scarves: 'Scarf & cowl',
  shawls: 'Shawl & wrap',
  mittens: 'Mittens & gloves',
  socks: 'Socks',
  slippers: 'Slippers',
  bags: 'Bag & purse',
  blankets: 'Blanket & throw',
  cushions: 'Cushion & pillow',
  dishcloths: 'Dishcloth & washcloth',
  home: 'Home & decor',
  toys: 'Toy & stuffed animal',
  baby: 'Baby & kids',
  swatches: 'Swatch',
  other: 'Other',
  queue: 'Queue',
};

// A pattern is knitted, crocheted, or both — a knitted garment with a crocheted edging is common
// enough to need saying. Techniques already use the same three.
export const CRAFT_LABELS: Record<TechniqueCraft, string> = {
  knit: 'Knitting',
  crochet: 'Crochet',
  both: 'Both',
};

export const CRAFT_ORDER: TechniqueCraft[] = ['knit', 'crochet', 'both'];

// Grouped the way a knitter would look for them — worn on the body, then worn as accessories,
// then made for the house, then everything else — rather than alphabetically or by when each was
// added. "Other" and "Queue" sit at the bottom because they are answers of last resort.
export const CATEGORY_ORDER: PatternCategory[] = [
  'sweaters',
  'cardigans',
  'tops',
  'dresses',
  'hats',
  'scarves',
  'shawls',
  'mittens',
  'socks',
  'slippers',
  'bags',
  'accessories',
  'blankets',
  'cushions',
  'dishcloths',
  'home',
  'toys',
  'baby',
  'swatches',
  'other',
  'queue',
];

// What a project is, in the knitter's words. Shared so the detail screen's chip and the list's
// pill always say the same thing — they were two copies of these three strings.
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: 'On the needles',
  finished: 'Finished',
  frogged: 'Frogged',
};

export const SECTION_STATUS_LABELS: Record<SectionStatus, string> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  complete: 'Complete',
};

export const TOOL_TYPE_LABELS: Record<ToolType, string> = {
  straight: 'Straight',
  circular: 'Circular',
  dpn: 'DPN',
  interchangeable: 'Interchangeable',
  'crochet-hook': 'Crochet hook',
  'cable-needle': 'Cable needle',
  'cable-pin': 'Cable pin',
  other: 'Other',
};

// Needle and hook sizes, in millimetres. Half-millimetre steps up to 20, which is the scale they
// are actually sold on, plus 25 at the top end for arm-knitting territory.
//
// The quarter sizes are in there too. Needles are mostly a 0.5 scale, but 2.25, 2.75, 3.25 and
// 3.75 are standard — they're the metric equivalents of US 1, 2, 3 and 5, and a knitter who owns
// a pair would otherwise have no way to say so.
const HALF_STEPS = Array.from({ length: 40 }, (_, i) => (i + 1) * 0.5);
const QUARTER_SIZES = [2.25, 2.75, 3.25, 3.75];

export const TOOL_SIZES: number[] = [...HALF_STEPS, ...QUARTER_SIZES, 25].sort((a, b) => a - b);

export const formatToolSize = (mm: number) => `${mm}mm`;

// The options for a size picker, with whatever is already stored kept selectable even when it
// isn't on the scale. A pattern imported as "3 mm [US 2.5] circular needles" is a real value, and
// a picker that silently dropped it would rewrite the knitter's data the next time they saved.
export function toolSizeOptions(current: string): { value: string; label: string }[] {
  const options = [
    { value: '', label: '— not set —' },
    ...TOOL_SIZES.map((mm) => ({ value: formatToolSize(mm), label: `${mm} mm` })),
  ];
  if (current && !options.some((o) => o.value === current)) {
    options.splice(1, 0, { value: current, label: current });
  }
  return options;
}

export const TOOL_ICONS: Record<ToolType, string> = {
  straight: '➖',
  circular: '⭕',
  dpn: '▦',
  interchangeable: '🔧',
  'crochet-hook': '🪝',
  'cable-needle': '➰',
  'cable-pin': '📌',
  other: '🧰',
};

export const YARN_WEIGHTS = [
  { code: '0', label: 'Lace' },
  { code: '1', label: 'Super fine' },
  { code: '2', label: 'Fine' },
  { code: '3', label: 'Light' },
  { code: '4', label: 'Medium' },
  { code: '5', label: 'Bulky' },
  { code: '6', label: 'Super bulky' },
  { code: '7', label: 'Jumbo' },
] as const;

export function yarnWeightLabel(code: string): string {
  const w = YARN_WEIGHTS.find((x) => x.code === String(code));
  return w ? `${w.code} · ${w.label}` : '';
}

// The common size runs a pattern is graded for. "One size" stands apart from the graded run —
// used for patterns that aren't sized (shawls, blankets, most accessories).
export const SIZE_OPTIONS = [
  'One size',
  'Newborn',
  'Baby',
  'XS',
  'S',
  'M',
  'L',
  'XL',
  '2XL',
  '3XL',
  '4XL',
] as const;

// The stitch/action vocabulary a row is built from, ported from reference/index.html's
// STITCH_TYPES + actions catalog. `delta` is the net live-stitch-count change per unit worked;
// `takes` is how many stitches a unit consumes off the left needle. `symbol` is the chart glyph.
// These two numbers drive all the running-count math (see rowStitchesAfter).
export type StitchDef = {
  label: string;
  abbr: string;
  symbol: string;
  delta: number;
  takes: number;
  kind: 'stitch' | 'action';
};

export const STITCHES: Record<string, StitchDef> = {
  knit: { label: 'Knit', abbr: 'k', symbol: '|', delta: 0, takes: 1, kind: 'stitch' },
  purl: { label: 'Purl', abbr: 'p', symbol: '–', delta: 0, takes: 1, kind: 'stitch' },
  ktbl: { label: 'Knit through back loop', abbr: 'ktbl', symbol: 'Q', delta: 0, takes: 1, kind: 'stitch' },
  slip: { label: 'Slip stitch', abbr: 'sl', symbol: '⌇', delta: 0, takes: 1, kind: 'stitch' },
  k2tog: { label: 'Knit 2 together', abbr: 'k2tog', symbol: '/', delta: -1, takes: 2, kind: 'stitch' },
  p2tog: { label: 'Purl 2 together', abbr: 'p2tog', symbol: '\\', delta: -1, takes: 2, kind: 'stitch' },
  ssk: { label: 'Slip slip knit', abbr: 'ssk', symbol: '\\', delta: -1, takes: 2, kind: 'stitch' },
  yo: { label: 'Yarn over', abbr: 'yo', symbol: 'o', delta: 1, takes: 0, kind: 'stitch' },
  kfb: { label: 'Knit front and back', abbr: 'kfb', symbol: 'V', delta: 1, takes: 1, kind: 'stitch' },
  // Directional glyphs so a left- and right-leaning increase are distinguishable in the chart.
  m1l: { label: 'Make one left', abbr: 'M1L', symbol: '↖', delta: 1, takes: 0, kind: 'action' },
  m1r: { label: 'Make one right', abbr: 'M1R', symbol: '↗', delta: 1, takes: 0, kind: 'action' },
  co: { label: 'Cast on', abbr: 'CO', symbol: '_', delta: 1, takes: 0, kind: 'action' },
  bo: { label: 'Bind off', abbr: 'BO', symbol: '‾', delta: -1, takes: 1, kind: 'action' },
  pm: { label: 'Place marker', abbr: 'pm', symbol: '◆', delta: 0, takes: 0, kind: 'action' },
};

export const STITCH_ORDER = Object.keys(STITCHES);

export function stitchDef(type: string): StitchDef | undefined {
  return STITCHES[type];
}

export const WASHING_LABELS: Record<string, string> = {
  'hand-wash': 'Hand wash cold',
  'machine-cold': 'Machine wash cold',
  'machine-wool': 'Machine wash (wool cycle)',
  'dry-clean': 'Dry clean only',
  'lay-flat': 'Lay flat to dry',
  'no-wash': 'Do not wash',
};
