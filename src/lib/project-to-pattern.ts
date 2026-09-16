import { TOOL_TYPE_LABELS } from '@/constants/catalogs';
import { newPatternSection } from '@/lib/entity-id';
import { resolveTechnique } from '@/lib/technique-catalogue';
import type {
  CatalogueTechnique,
  Material,
  Pattern,
  PatternCategory,
  PatternMaterial,
  PatternSection,
  PatternTechnique,
  PatternTool,
  Project,
  Technique,
  Tool,
} from '@/types/knitwit';

// The knitter's own yarn, needles and techniques, keyed the way the store keys them. A project
// section points at these by id; a pattern can't, because a pattern is generic — so the ids have to
// be turned into slots on the way across.
export type Stash = {
  materials: Record<string, Material>;
  tools: Record<string, Tool>;
  techniques: Record<string, Technique>;
  // The shared catalogue, so a technique id can be turned back into a name. A project points at
  // catalogue slugs; the pattern it becomes names them inline for anyone who reads it.
  catalogue: Record<string, CatalogueTechnique>;
};

let uid = 0;
const nextId = (prefix: string) => `${prefix}${Date.now().toString(36)}${uid++}`;

const shortForIndex = (i: number) => String.fromCharCode(65 + (i % 26));

// First-use order, so slot A is the yarn the first section calls for rather than whichever the
// store happened to list first. Flattened across sections, because a section names several.
function distinct(perSection: string[][]): string[] {
  const seen: string[] = [];
  for (const ids of perSection) for (const id of ids) if (id && !seen.includes(id)) seen.push(id);
  return seen;
}

// A project is never categorised, so the pattern made from one has to start somewhere. The name is
// the only signal there is, and it usually says outright what the thing is.
//
// Ordered by how specific the word is, not by the category list: "Clover Baby Blanket" is a
// blanket that happens to be for a baby, so the object noun has to be tried before the recipient.
// This is a form default the knitter is looking at, not a claim — anything unrecognised falls
// through to the top of the list rather than guessing harder.
const CATEGORY_WORDS: [PatternCategory, string[]][] = [
  ['slippers', ['slipper', 'bootie', 'bed sock']],
  ['socks', ['sock']],
  ['blankets', ['blanket', 'throw', 'afghan']],
  ['hats', ['hat', 'beanie', 'bonnet', 'balaclava', 'toque']],
  ['shawls', ['shawl', 'wrap', 'stole', 'poncho']],
  ['scarves', ['scarf', 'scarves', 'cowl', 'snood', 'neckwarmer']],
  ['mittens', ['mitten', 'mitt', 'glove', 'wristwarmer']],
  ['toys', ['toy', 'amigurumi', 'stuffed', 'plushie', 'bear', 'bunny', 'doll', 'softie']],
  ['cushions', ['cushion', 'pillow']],
  ['dishcloths', ['dishcloth', 'washcloth', 'facecloth', 'scrubby']],
  ['bags', ['bag', 'purse', 'tote', 'pouch', 'backpack']],
  ['home', ['coaster', 'basket', 'placemat', 'tea cosy', 'garland', 'ornament', 'rug']],
  ['cardigans', ['cardigan', 'cardi']],
  ['dresses', ['dress', 'skirt', 'pinafore']],
  ['tops', ['tee', 'top', 'tank', 'camisole', 'blouse']],
  ['sweaters', ['sweater', 'jumper', 'pullover', 'vest', 'yoke']],
  ['swatches', ['swatch', 'gauge', 'tension square']],
  ['accessories', ['headband', 'legwarmer', 'belt', 'tie']],
  ['baby', ['baby', 'newborn', 'toddler']],
];

export function categoryFromName(name: string): PatternCategory {
  const lower = name.toLowerCase();
  for (const [category, words] of CATEGORY_WORDS) {
    if (words.some((w) => lower.includes(w))) return category;
  }
  return 'sweaters';
}

function toolLabel(tool: Tool | undefined): string {
  if (!tool) return '';
  const type = TOOL_TYPE_LABELS[tool.type] ?? '';
  return [tool.thickness, type].filter(Boolean).join(' ');
}

// What a project turns into when it becomes a pattern.
//
// The two models overlap but aren't the same shape, and the differences are the interesting part:
//
//  - A project is knitted in one size, so the pattern it produces is a one-size pattern. Nothing
//    here invents a size run the knitter never worked.
//  - A project's sections point at the knitter's own stash; a pattern's point at generic slots.
//    Each distinct yarn and tool the project used becomes one slot, labelled from the stash item so
//    it still reads as something recognisable ("Rowan Felted Tweed — Ancient") rather than "Yarn A".
//  - A project holds no verbatim pattern text, only the chart. When the project came from a
//    pattern, the text is carried back across by section name; otherwise the chart is the pattern.
//
// `source` is the pattern the project was made from, if any. Everything taken from it is something
// the project genuinely has no record of — the wording, the techniques, the size's name.
export function projectToPattern(project: Project, stash: Stash, source: Pattern | null): Pattern {
  const materialIds = distinct(project.sections.map((s) => s.materialIds));
  const toolIds = distinct(project.sections.map((s) => s.toolIds));
  const techniqueIds = distinct(project.sections.map((s) => s.techniqueIds));

  const materialSlots = new Map(materialIds.map((id) => [id, nextId('ms')]));
  const toolSlots = new Map(toolIds.map((id) => [id, nextId('ts')]));
  const techniqueSlots = new Map(techniqueIds.map((id) => [id, nextId('pte')]));

  const materials: PatternMaterial[] = materialIds.map((id, i) => {
    const m = stash.materials[id];
    return {
      id: materialSlots.get(id)!,
      label: m ? `${m.brand} — ${m.colorName}` : `Yarn ${shortForIndex(i)}`,
      short: shortForIndex(i),
    };
  });

  const tools: PatternTool[] = toolIds.map((id) => {
    const t = stash.tools[id];
    return {
      id: toolSlots.get(id)!,
      type: t?.type ?? 'other',
      thickness: t?.thickness ?? '',
      note: t?.length ? `${t.length} long` : '',
    };
  });

  // A project points at the knitter's own technique library; a pattern names its techniques
  // inline, so each one used is copied out as a slot of the pattern's own.
  const ownTechniques: PatternTechnique[] = techniqueIds.map((id) => {
    const t = stash.techniques[id];
    const resolved = resolveTechnique(id, t, stash.catalogue);
    return { id: techniqueSlots.get(id)!, name: resolved.name, note: t?.notes ?? '' };
  });

  // Matched by name because that's the only thing the two share: a project's sections are stamped
  // from the pattern's in order, but sections get added, renamed and deleted afterwards, so the
  // index means nothing by the time anyone converts.
  const sourceSection = (name: string) => source?.sections.find((s) => s.name === name) ?? null;

  const sections: PatternSection[] = project.sections.map((s) => {
    const from = sourceSection(s.name);
    return newPatternSection({
      name: s.name,
      totalRows: s.totalRows,
      castOn: s.castOn,
      materials: s.materialIds.map((id) => materialSlots.get(id)!),
      tools: s.toolIds.map((id) => toolSlots.get(id)!),
      // The knitter's own techniques where the section names any; otherwise the source pattern's,
      // whose ids stay resolvable because its whole technique list is copied across with them.
      techniques: s.techniqueIds.length
        ? s.techniqueIds.map((id) => techniqueSlots.get(id)!)
        : (from?.techniques ?? []),
      // The project's own wording wins. It only falls back to the source pattern for a section
      // the knitter never wrote anything on — before a project could hold a description at all,
      // the fallback was the only way to get one.
      description: s.description.trim() ? s.description : (from?.description ?? ''),
      rows: s.rows,
      rowNotes: s.rowNotes,
      // Same rule as the description: the project's own wording wins, falling back to the source
      // pattern only for a section the knitter never wrote anything on.
      notes: s.notes.trim() ? s.notes : (from?.notes ?? ''),
      markers: s.markers,
      stitchMultiple: s.stitchMultiple ?? from?.stitchMultiple ?? null,
    });
  });

  // The gauge the fabric was actually knitted at is the one a pattern written from it should state.
  // A project with no gauge of its own was worked at the pattern's, so that's what to carry.
  const gauge = project.gauge?.mine ?? source?.gauge ?? null;

  return {
    name: project.name,
    // Read off the project rather than guessed. A project records all of this itself now, so the
    // conversion form is pre-filled with real answers; categoryFromName still exists, but it runs
    // once when the project is created rather than every time one is converted.
    category: project.category,
    craft: project.craft,
    weight: '',
    // Falls back to the first needle the project was actually worked with, which is a better
    // answer than blank for a knitter who never filled the field in.
    needleSize: project.needleSize || toolLabel(stash.tools[toolIds[0]]),
    video: project.video,
    sourceName: project.sourceName,
    sourceText: project.sourceText,
    // Back the way they came. The project's own notes win; a project made from a pattern started
    // with that pattern's, so this is either what the knitter wrote or what they left alone.
    notes: project.notes,
    // Taken from the project so the pattern reads as the same thing in the library, and so
    // re-deriving the project's colours from it is a no-op.
    accentColor: project.color,
    photo: project.photo,
    gauge,
    // The gauge above already is the knitter's own measurement; recording it a second time as a
    // swatch would make re-gauging compare a number against itself.
    swatchGauge: null,
    favorited: false,
    level: project.level,
    sizes: [source?.sizes[project.sizeIndex] ?? 'One size'],
    materials,
    tools,
    // Both, when the project added techniques of its own to a pattern that already had some:
    // dropping either would leave a section pointing at an id that resolves to nothing.
    techniques: [...(source?.techniques ?? []), ...ownTechniques],
    sections,
  };
}

// "4 sections · 96 rows charted · 2 yarns, 1 tool" — what is actually coming across, so the knitter
// can see before pressing the button whether there's a pattern in here or just an empty shell.
export function describeConversion(pattern: Pattern): string {
  const rowsCharted = pattern.sections.reduce((n, s) => n + s.rows.length, 0);
  const written = pattern.sections.filter((s) => s.description.trim()).length;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const parts = [
    plural(pattern.sections.length, 'section', 'sections'),
    plural(rowsCharted, 'row charted', 'rows charted'),
  ];
  // Worth its own count: the wording is what makes a converted pattern readable, and it's the
  // thing a project could not hold at all until recently.
  if (written) parts.push(`${written} written up`);
  if (pattern.materials.length) parts.push(plural(pattern.materials.length, 'yarn', 'yarns'));
  if (pattern.tools.length) parts.push(plural(pattern.tools.length, 'tool', 'tools'));
  if (pattern.techniques.length) {
    parts.push(plural(pattern.techniques.length, 'technique', 'techniques'));
  }
  return parts.join(' · ');
}
