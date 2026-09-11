// Ported verbatim from reference/index.html's catalog constants.
import type { PatternCategory, SectionStatus, ToolType } from '@/types/knitwit';

export const CATEGORY_LABELS: Record<PatternCategory, string> = {
  sweaters: 'Sweater',
  accessories: 'Accessory',
  hats: 'Hat',
  scarves: 'Scarf & cowl',
  socks: 'Socks',
  blankets: 'Blanket',
  toys: 'Toy',
  home: 'Home decor',
  baby: 'Baby & kids',
  queue: 'Queue',
};

export const CATEGORY_ORDER: PatternCategory[] = [
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
];

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
