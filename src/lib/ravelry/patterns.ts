// Turn a Ravelry pattern into a Knitwit Pattern — the metadata "library card" tier.
//
// Ravelry hands out what a pattern *is* (name, craft, category, gauge, needles, sizes, a photo, a
// link) but never the row-by-row instructions, which are copyrighted. So the card this produces has
// no sections and an empty counter; the opt-in "build the chart from the PDF" tier fills those later
// by running the owned PDF through parse-pattern. See docs/plans/ravelry-import.md, Phases 2 & 4.
//
// Pure: Ravelry in, a Pattern out, the import timestamp passed so it stays testable.

import { matchTechnique } from '@/lib/technique-catalogue';
import type {
  CatalogueTechnique,
  Gauge,
  Pattern,
  PatternCategory,
  PatternLevel,
  PatternTechnique,
  TechniqueCraft,
} from '@/types/knitwit';
import type { RavelryPattern, RavelryPatternAttribute, RavelryPatternCategory } from './types';

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

// ---- Pattern attributes ----
//
// Ravelry tags every pattern from a fixed vocabulary, and most of it is not a technique at all. The
// camisole in the fixtures carries eleven: `female`, `unisex`, `adult`, `negative-ease`, `fitted`,
// `crew-neck`, `sleeveless`, `top-down`, `written-pattern`, `in-the-round`, `other-edging`. Two of
// those are arguably skills; the rest describe who it is for, how it fits, and what shape it is.
//
// So the catalogue is the filter rather than a hand-written allow-list: each attribute is turned
// into words and looked up with the same matcher that reads techniques out of imported pattern
// text, against only the entries for this pattern's craft. `cables`, `brioche`, `intarsia` and
// `lace` land (the last via its alias); `adult` and `crew-neck` match nothing, which is the right
// answer. Construction — `top-down`, `in-the-round` — matches nothing either, because the catalogue
// deliberately leaves garment construction out; it goes in the notes with everything else.

// The few whose permalink does not read like what the catalogue calls it. Several phrases may be
// offered for one attribute: the craft filter decides between them, which is how `mosaic` reaches
// mosaic knitting on a knitting pattern and mosaic crochet on a crochet one.
const ATTRIBUTE_PHRASES: Record<string, string[]> = {
  stranded: ['stranded colourwork'],
  felted: ['felting'],
  steeks: ['steeking'],
  amigurumi: ['amigurumi shaping'],
  'granny-squares': ['granny square'],
  mosaic: ['mosaic knitting', 'mosaic crochet'],
  'double-knit': ['double knitting'],
  tunisian: ['tunisian crochet'],
};

// "crew-neck" → "crew neck". What the matcher wants, and what reads properly in a sentence.
function humanise(permalink: string): string {
  return permalink.replace(/-/g, ' ').trim();
}

function attributeList(pattern: RavelryPattern): RavelryPatternAttribute[] {
  return (pattern.pattern_attributes ?? []).filter((a) => Boolean(a.permalink));
}

// The attributes that name something in the catalogue, as pattern techniques.
//
// Craft-filtered first, which is both a correctness fix and what lets an ambiguous attribute
// resolve: 'Lace knitting' is a knitting entry, so a crochet pattern tagged `lace` cannot land on
// it. Deduplicated, because two attributes can point at the same entry.
function mapTechniques(
  pattern: RavelryPattern,
  craft: TechniqueCraft,
  catalogue: CatalogueTechnique[],
): PatternTechnique[] {
  const forCraft = catalogue.filter((t) => t.craft === craft || t.craft === 'both');
  if (forCraft.length === 0) return [];

  const found = new Map<string, PatternTechnique>();
  for (const attribute of attributeList(pattern)) {
    const permalink = attribute.permalink as string;
    const phrases = ATTRIBUTE_PHRASES[permalink] ?? [humanise(permalink)];
    for (const phrase of phrases) {
      const hit = matchTechnique(phrase, forCraft);
      if (hit && !found.has(hit.id)) {
        // No note: Ravelry says the pattern uses the technique, not anything about how.
        found.set(hit.id, { id: hit.id, name: hit.name, note: '' });
        break;
      }
    }
  }
  return [...found.values()];
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
// sizes offered, yardage, yarn weight, and everything Ravelry's attributes say that is not a
// technique), kept as the knitter's notes for the card.
function composeNotes(pattern: RavelryPattern, techniques: PatternTechnique[]): string {
  // Whatever the catalogue did not claim. Worth keeping — "adult, fitted, crew neck, sleeveless,
  // top-down, in the round" is a fair description of a garment, and dropping it on the floor
  // because it is not a skill would lose the most useful half of what Ravelry tagged.
  const claimed = new Set(techniques.map((t) => t.name.toLowerCase()));
  const details = attributeList(pattern)
    .map((a) => humanise(a.permalink as string))
    .filter((words) => !claimed.has(words.toLowerCase()));

  return [
    pattern.pattern_author?.name ? `By ${pattern.pattern_author.name}` : '',
    pattern.sizes_available ? `Sizes: ${pattern.sizes_available}` : '',
    pattern.yardage_description ? `Yardage: ${pattern.yardage_description}` : '',
    pattern.yarn_weight_description ? `Yarn: ${pattern.yarn_weight_description}` : '',
    details.length > 0 ? `Details: ${details.join(', ')}` : '',
    pattern.notes ?? '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function ravelryPatternToPattern(
  pattern: RavelryPattern,
  importedAt: string,
  // The shared technique catalogue, for matching Ravelry's attributes. Defaulted to empty so the
  // mapper stays usable (and testable) without it: no catalogue simply means no techniques matched,
  // and every attribute ends up described in the notes instead.
  catalogue: CatalogueTechnique[] = [],
): Pattern {
  const photo = pattern.photos?.[0];
  const languages = (pattern.languages ?? []).map((l) => l.name).filter(Boolean);
  const craft = mapCraft(pattern.craft?.name);
  const techniques = mapTechniques(pattern, craft, catalogue);

  return {
    name: pattern.name ?? '',
    category: mapCategory(pattern),
    craft,
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
    notes: composeNotes(pattern, techniques),
    level: mapLevel(pattern),
    sizes: [],
    // The designer's own page for the pattern — where it was bought, and where an update to it
    // would appear. Ravelry's deep link is kept separately on ravelrySource.
    link: pattern.url ?? '',
    // Empty until the opt-in PDF parse: Ravelry gives no requirements or instructions to fill these.
    materials: [],
    tools: [],
    // What Ravelry's attributes named that the catalogue recognises. Everything else they said is
    // in the notes.
    techniques,
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
