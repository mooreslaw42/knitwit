// Turn a Ravelry pattern into a Knitwit Pattern — the metadata "library card" tier.
//
// Ravelry hands out what a pattern *is* (name, craft, category, gauge, needles, sizes, a photo, a
// link) but never the row-by-row instructions, which are copyrighted. So the card this produces has
// no sections and an empty counter; the opt-in "build the chart from the PDF" tier fills those later
// by running the owned PDF through parse-pattern. See docs/plans/ravelry-import.md, Phases 2 & 4.
//
// Pure: Ravelry in, a Pattern out, the import timestamp passed so it stays testable.

import type {
  Gauge,
  Pattern,
  PatternCategory,
  PatternLevel,
  TechniqueCraft,
} from '@/types/knitwit';
import type { RavelryPattern, RavelryPatternCategory } from './types';

function mapCraft(name: string | null | undefined): TechniqueCraft {
  const n = (name ?? '').toLowerCase();
  if (n.includes('crochet')) return 'crochet';
  return 'knit';
}

// Ravelry's category tree is far bigger than Knitwit's flat list, so this matches on the words that
// appear in the category chain and pattern type, most specific first. Order matters: "cardigan"
// before "sweater", "dishcloth" before "home", "slipper" before "sock". Unmatched → 'other', never
// a wrong guess. The knitter can always change it.
const CATEGORY_RULES: [string, PatternCategory][] = [
  ['cardigan', 'cardigans'],
  ['pullover', 'sweaters'],
  ['sweater', 'sweaters'],
  ['camisole', 'tops'],
  ['tank', 'tops'],
  ['tee', 'tops'],
  ['vest', 'tops'],
  ['top', 'tops'],
  ['dress', 'dresses'],
  ['beanie', 'hats'],
  ['bonnet', 'hats'],
  ['hat', 'hats'],
  ['cowl', 'scarves'],
  ['scarf', 'scarves'],
  ['shawl', 'shawls'],
  ['stole', 'shawls'],
  ['wrap', 'shawls'],
  ['mitten', 'mittens'],
  ['glove', 'mittens'],
  ['fingerless', 'mittens'],
  ['slipper', 'slippers'],
  ['sock', 'socks'],
  ['purse', 'bags'],
  ['tote', 'bags'],
  ['bag', 'bags'],
  ['blanket', 'blankets'],
  ['afghan', 'blankets'],
  ['throw', 'blankets'],
  ['pillow', 'cushions'],
  ['cushion', 'cushions'],
  ['dishcloth', 'dishcloths'],
  ['washcloth', 'dishcloths'],
  ['amigurumi', 'toys'],
  ['softie', 'toys'],
  ['stuffed', 'toys'],
  ['toy', 'toys'],
  ['decor', 'home'],
  ['household', 'home'],
  ['home', 'home'],
  ['baby', 'baby'],
  ['swatch', 'swatches'],
  ['accessor', 'accessories'],
];

function categoryChain(cat: RavelryPatternCategory | null | undefined): string[] {
  const out: string[] = [];
  let node = cat;
  // A tree this shallow cannot loop, but guard the walk anyway.
  for (let i = 0; node && i < 10; i += 1) {
    if (node.name) out.push(node.name);
    node = node.parent;
  }
  return out;
}

function mapCategory(pattern: RavelryPattern): PatternCategory {
  const candidates = [
    pattern.pattern_type?.name ?? '',
    ...(pattern.pattern_categories ?? []).flatMap(categoryChain),
  ]
    .join(' • ')
    .toLowerCase();
  for (const [word, code] of CATEGORY_RULES) {
    if (candidates.includes(word)) return code;
  }
  return 'other';
}

function trimZero(n: number): string {
  return String(Number(n));
}

// One size → "3mm"; a range → "2–3mm". Hooks and needles format the same way.
function formatNeedleSizes(pattern: RavelryPattern): string {
  const metrics = (pattern.pattern_needle_sizes ?? [])
    .map((s) => s.metric)
    .filter((m): m is number => m != null);
  if (metrics.length === 0) return '';
  const min = Math.min(...metrics);
  const max = Math.max(...metrics);
  return min === max ? `${trimZero(min)}mm` : `${trimZero(min)}–${trimZero(max)}mm`;
}

function mapGauge(pattern: RavelryPattern): Gauge | null {
  if (pattern.gauge == null || pattern.gauge_divisor == null) return null;
  const window = pattern.gauge_divisor;
  return {
    stitches: pattern.gauge,
    rows: pattern.row_gauge ?? 0,
    width: window,
    height: window,
    // Ravelry's window is inches unless the divisor is the metric 10.
    unit: window === 10 ? 'cm' : 'inch',
  };
}

function mapLevel(pattern: RavelryPattern): PatternLevel {
  const avg = pattern.difficulty_average;
  if (!pattern.difficulty_count || avg == null) return 'intermediate';
  if (avg < 2.5) return 'beginner';
  if (avg < 4.5) return 'easy';
  if (avg < 6.5) return 'intermediate';
  return 'advanced';
}

// The designer's description plus the facts that have nowhere else to live on a Pattern (author,
// sizes offered, yardage, yarn weight), kept as the knitter's notes for the card.
function composeNotes(pattern: RavelryPattern): string {
  return [
    pattern.pattern_author?.name ? `By ${pattern.pattern_author.name}` : '',
    pattern.sizes_available ? `Sizes: ${pattern.sizes_available}` : '',
    pattern.yardage_description ? `Yardage: ${pattern.yardage_description}` : '',
    pattern.yarn_weight_description ? `Yarn: ${pattern.yarn_weight_description}` : '',
    pattern.notes ?? '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function ravelryPatternToPattern(pattern: RavelryPattern, importedAt: string): Pattern {
  const photo = pattern.photos?.[0];
  const languages = (pattern.languages ?? []).map((l) => l.name).filter(Boolean);

  return {
    name: pattern.name ?? '',
    category: mapCategory(pattern),
    craft: mapCraft(pattern.craft?.name),
    weight: '', // legacy descriptor; new patterns use needleSize
    needleSize: formatNeedleSizes(pattern),
    video: '',
    sourceName: '',
    sourceText: '',
    accentColor: '',
    photo: photo?.medium_url ?? photo?.square_url ?? null,
    gauge: mapGauge(pattern),
    // The knitter's own swatch gauge is theirs to measure, not the pattern's to supply.
    swatchGauge: null,
    favorited: pattern.personal_attributes?.favorited ?? false,
    // Only claim a written language when the pattern offers exactly one; a list of five says nothing
    // about which it was authored in.
    ...(languages.length === 1 ? { language: languages[0] as string } : {}),
    notes: composeNotes(pattern),
    level: mapLevel(pattern),
    sizes: [],
    // Empty until the opt-in PDF parse: Ravelry gives no requirements or instructions to fill these.
    materials: [],
    tools: [],
    techniques: [],
    sections: [],
    ravelrySource: {
      id: String(pattern.id),
      kind: 'pattern',
      url: pattern.permalink
        ? `https://www.ravelry.com/patterns/library/${pattern.permalink}`
        : '',
      importedAt,
    },
  };
}
