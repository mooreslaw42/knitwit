// Ported from reference/index.html's in-memory data model (MATERIALS/TOOLS/PATTERNS/PROJECTS
// seeds and their catalogs). Deliberately kept close to the original shapes rather than
// redesigned — see AGENTS.md.

export type CraftType = 'knit' | 'crochet';

export type LengthUnit = 'cm' | 'inch';

// Gauge — how many stitches and rows a knitter gets over a measured window of fabric. The window
// is stored rather than assumed, which is what lets one type hold every convention: metric
// patterns state it per 10cm, US patterns per 4in, older ones per 1in, and some give a different
// height from width.
//
// Stored exactly as the pattern states it, never normalised on entry. That matters more than it
// looks: 4 inches is 10.16cm, so "22 sts / 4in" is 21.65 sts/10cm, and a pattern printing
// "22 sts to 4in (10cm)" is rounding. The two readings differ by 1.6% — half a stitch on a
// cast-on, more across a body — so the conversion happens where it's computed, not where it's
// typed. See src/lib/gauge.ts.
export type Gauge = {
  stitches: number;
  rows: number;
  width: number;
  height: number;
  unit: LengthUnit;
};

// Preferences that belong to the person, not to any pattern or project.
//
// Kept as one object rather than loose fields because that is the shape it needs to be in when
// accounts arrive: today it is persisted with the rest of the local store, and it should then
// move onto the user record and follow them between devices. Language belongs here too once
// there is more than one to choose from — adding the setting before the translations would be a
// control that does nothing.
export type UserSettings = {
  // The unit new gauges default to, and the one stored gauges are shown in. Storage is unaffected:
  // a gauge is always kept as it was written, and converted at the point it is displayed.
  gaugeUnit: LengthUnit;
};

// One entry per day the knitter actually knitted. Keyed by *local* date, because a streak is
// about their days rather than UTC's: knitting at 11pm and again at 1am is two days, at 11pm and
// 00:30 is one.
export type ActivityDay = {
  date: string; // YYYY-MM-DD, local
  rows: number;
  stitches: number;
  seconds: number;
  // Rows counted in each part of the day, for the time-of-day awards. Absent on a day recorded
  // before the app tracked it, which reads as "we don't know" rather than "none".
  bands?: Partial<Record<'night' | 'dawn' | 'day' | 'evening', number>>;
};

// What the awards are computed from. Nothing else in the app is dated, so this is the only record
// of what happened rather than what is currently true.
export type Achievements = {
  // Monotonic: deleting, frogging or tidying up never takes back what was knitted. An award you
  // can lose by housekeeping is worse than no award.
  totals: {
    rows: number;
    stitches: number;
    seconds: number;
    projectsFinished: number;
    projectsFrogged: number;
    patternsCreated: number;
    techniquesAdded: number;
  };
  finishedByCategory: Partial<Record<PatternCategory, number>>;
  finishedByCraft: Partial<Record<TechniqueCraft, number>>;
  finishedByPattern: Record<string, number>;
  days: ActivityDay[];
  earned: Record<string, string>; // award id → the date it was earned
};

// A stored status wins; an 'active' project still reads as finished once every row is counted, so
// today's derived behaviour is unchanged and two things it couldn't express are now possible —
// calling something done before the last row, and frogging it.
export type ProjectStatus = 'active' | 'finished' | 'frogged';

export type Craft = {
  thickness: string;
  gauge: Gauge | null;
};

export type Material = {
  brand: string;
  colorName: string;
  colorLot: string;
  price: string;
  weight: string; // yarn weight code, see YARN_WEIGHTS
  grams: string;
  meters: string;
  composition: string;
  thickness: string;
  strands: string;
  craftType: CraftType;
  washing: string;
  gauge: Gauge | null;
  link: string;
  photo: string | null;
  crafts?: Partial<Record<CraftType, Craft>>;
};

// A user-kept reference note for a knitting/crochet technique — a cast-on, a decrease, a
// finishing trick — with an optional link to a tutorial. Entirely user-authored.
export type TechniqueCraft = CraftType | 'both';

// One entry in the shared catalogue (public.technique_catalogue). The same for every knitter, so
// two people's "German short rows" are the same thing and a pattern can point at one.
//
// `id` is a slug and a foreign key: it appears in saved patterns, in project sections, and in
// achievement tallies. Names and summaries are free to change; ids are not.
export type CatalogueTechnique = {
  id: string;
  name: string;
  craft: TechniqueCraft;
  family: TechniqueFamily;
  summary: string;
  // What patterns actually call it, so imported text can be matched back to this entry.
  aliases: string[];
  video: string;
  link: string;
};

export type TechniqueFamily =
  | 'cast-on'
  | 'bind-off'
  | 'increase'
  | 'decrease'
  | 'joining'
  | 'colourwork'
  | 'shaping'
  | 'texture'
  | 'finishing'
  | 'other';

// Where a knitter is with a technique. Absent from their map means they have never said.
export type TechniqueStatus = 'want' | 'learning' | 'known';

// What one knitter records about one technique. Everything factual about the technique itself
// lives in the catalogue; this is only theirs.
export type Technique = {
  status: TechniqueStatus;
  notes: string;
  addedOn: string; // ISO YYYY-MM-DD
  // Set on a technique the knitter added because the catalogue didn't have it. It carries its own
  // name and craft, is never matched from a pattern, and sorts below catalogue entries. The
  // escape hatch, not a second catalogue.
  custom?: { name: string; craft: TechniqueCraft };
};

export type ToolType =
  | 'straight'
  | 'circular'
  | 'dpn'
  | 'interchangeable'
  | 'crochet-hook'
  | 'cable-needle'
  | 'cable-pin'
  | 'other';

export type Tool = {
  type: ToolType;
  thickness: string;
  length: string;
  quantity: number; // how many of this tool the user owns
};

// Only ever added to. Every value here may be sitting in someone's saved pattern, in their
// achievements' finishedByCategory tally, or in an award id — renaming one would orphan all three.
// The labels are free to change; these strings are not.
export type PatternCategory =
  | 'sweaters'
  | 'cardigans'
  | 'tops'
  | 'dresses'
  | 'accessories'
  | 'hats'
  | 'scarves'
  | 'shawls'
  | 'mittens'
  | 'socks'
  | 'slippers'
  | 'bags'
  | 'blankets'
  | 'cushions'
  | 'dishcloths'
  | 'home'
  | 'toys'
  | 'baby'
  | 'swatches'
  | 'other'
  | 'queue';

export type PatternLevel = 'beginner' | 'easy' | 'intermediate' | 'advanced';

export type ProjectNote = {
  id: number;
  row: number;
  text: string;
};

// A generic yarn requirement a pattern calls for — "Main colour", "Contrast" — not a specific
// skein in anyone's stash. A project maps each of these slots to one of the user's own materials
// (see Project.slotMaterials).
export type PatternMaterial = {
  id: string; // slot id, unique within the pattern
  label: string;
  short: string; // one-letter tag used in charts, e.g. "A"
};

// A generic tool requirement — "4.5mm circular, US 7" — again not a specific tool the user owns.
export type PatternTool = {
  id: string; // slot id, unique within the pattern
  type: ToolType;
  thickness: string;
  note: string; // e.g. a US size
};

// A technique a pattern calls for, jotted inline on the pattern itself.
export type PatternTechnique = {
  id: string;
  name: string;
  note: string;
};

// The template a project section is stamped from when a project is created from a pattern. It
// holds the planned shape — row count, which of the pattern's generic yarn/tool slots it uses,
// per-row notes and the rows that carry a stitch-marker event — but none of the runtime progress
// (current row, elapsed time, completion) that only a project in progress accrues.
// Which side of the work a row is knitted from.
export type StitchSide = 'RS' | 'WS';

// How a stitch group's `count` is read: a fixed number of units (`exact`), repeat across all the
// remaining working stitches (`all`), or repeat until `count` stitches are left (`to-last`).
export type StitchSpan = 'all' | 'exact' | 'to-last';

// A number a pattern states per size — "CO 6 (6) 7 (7) 9 sts". A plain number means "the same for
// every size"; an array lines up index-for-index with Pattern.sizes. Resolve one with sizeValue().
export type SizedNumber = number | number[];

// A run of one stitch/action within a row — e.g. "k2" (type knit, span exact, count 2) or
// "*yo, k2tog* across" (two groups, span all). `type` is a key into the STITCHES catalog.
export type PatternStitchGroup = {
  id: string;
  type: string;
  span: StitchSpan;
  count: SizedNumber | null;
  materialSlot: string | null; // pattern material slot id, or null
  note: string;
};

// One worked row: its side, whether it carries a stitch-marker event, an optional written
// instruction, and the ordered stitch groups that make it up.
export type PatternRow = {
  id: string;
  label: string;
  side: StitchSide;
  marker: boolean;
  instruction: string;
  stitches: PatternStitchGroup[];
};

// "A multiple of 4, plus 2 edge stitches" — what a section's stitch pattern needs to come out
// even. Only consulted when re-gauging: rescaling a cast-on and rounding to the nearest whole
// stitch is arithmetically right and can leave a rib three stitches short of a repeat.
export type StitchMultiple = { of: number; plus: number };

export type PatternSection = {
  // As on ProjectSection, and for the same reason.
  id: string;
  updatedAt: string;
  name: string;
  // Both are stated per size on real patterns. A project resolves them to plain numbers for the
  // one size it is being knitted in.
  totalRows: SizedNumber;
  castOn: SizedNumber; // live stitch count the section starts from, for the running-count math
  materials: string[]; // ids of the pattern's material slots this section uses
  tools: string[]; // ids of the pattern's tool slots this section uses
  techniques: string[]; // ids of the pattern's techniques this section uses
  // Raw written/pasted pattern text for this section (Phase 1 of the stitch engine).
  description: string;
  // The structured stitch-by-stitch-per-row model (Phase 2+). Empty until authored/parsed; the
  // counter and editor consume it, and stitch counts are derived from it, never stored.
  rows: PatternRow[];
  // Notes pinned to a particular row, which is what the counter raises as you reach them. Named
  // for what they are so that `notes` can mean the plain free-text field below.
  rowNotes: ProjectNote[];
  // Anything the knitter wants to say about this section as a whole — a reminder, a measurement,
  // what went wrong last time. Not tied to a row and not the instructions.
  notes: string;
  markers: number[];
  // Null means "no repeat to preserve" — rounding is then free to take the nearest stitch.
  stitchMultiple: StitchMultiple | null;
};

// The full section/row/stitch-group pattern engine (expansionFor / currentRowContext /
// rowShorthand) is still not ported; `sections` here is the planning template that seeds a
// project's countable sections, not that engine. `materials`/`tools` are the generic slots a
// project resolves against the user's stash.
export type Pattern = {
  name: string;
  category: PatternCategory;
  // Knitting, crochet, or a piece that uses both — a knitted garment with a crocheted edging is
  // common enough to need saying. Today this is a label: it drives awards and the library filter,
  // but the stitch vocabulary, chart and parser are all still knitting-shaped. Making crochet a
  // first-class craft is its own piece of work — see docs/plans/crochet-mode.md.
  craft: TechniqueCraft;
  weight: string; // legacy yarn-weight descriptor (kept for seeds); new patterns use needleSize
  needleSize: string; // recommended needle / hook size, e.g. "4.5mm"
  video: string; // optional link to an instruction video
  // The original pattern the user imported, kept for reference (and future automatic parsing).
  sourceName: string; // uploaded file name, if any
  sourceText: string; // pasted pattern text, if any
  accentColor: string;
  photo: string | null;
  gauge: Gauge | null;
  // The knitter's own measured gauge for this pattern, from a swatch. Kept beside the pattern's
  // own gauge rather than replacing it: comparing the two is the whole basis of re-gauging, so
  // both have to survive. A project will snapshot this when it's created.
  swatchGauge: Gauge | null;
  favorited: boolean;
  // The knitter's own notes about the pattern as a whole — distinct from sourceText, which is the
  // document it came from. A project made from this pattern starts with a copy.
  notes: string;
  level: PatternLevel;
  sizes: string[];
  materials: PatternMaterial[];
  tools: PatternTool[];
  techniques: PatternTechnique[];
  sections: PatternSection[];
};

export type ProjectSection = {
  // Stable across devices and across reordering. Sections used to be addressed by their position
  // in the array, which identifies nothing: move a section and every stored reference to it now
  // points at a different piece of knitting. See entity-id.ts.
  id: string;
  // When this section last changed, for reconciling two devices. Provisional — the server owns
  // this once these are rows in Postgres.
  updatedAt: string;
  name: string;
  totalRows: number;
  row: number;
  complete: boolean;
  seconds: number;
  rowNotes: ProjectNote[];
  // Free text about the section as a whole, carried to and from the pattern it came from.
  notes: string;
  // What this section is worked with, as ids into the knitter's own stash — Material, Tool and
  // Technique in the store. Lists, because a pattern section already carries lists and a real
  // section genuinely uses more than one of each: a yoke in two colours, a body swapped from
  // circulars to DPNs at the crown. These used to be one `materialId` and one `toolId`, which
  // meant a two-colour section resolved to neither.
  materialIds: string[];
  toolIds: string[];
  // A project has techniques of its own for the first time here. A pattern names them inline
  // (PatternTechnique); a project points at the ones in the knitter's library, the same way it
  // points at their yarn.
  techniqueIds: string[];
  // The written instructions, the same field a pattern section carries. A project improvised
  // without a pattern still has instructions — they're just in the knitter's head until there's
  // somewhere to put them, and they're what the chart below is read from.
  description: string;
  // Only consulted when re-gauging, and carried for the same reason a pattern carries it: a
  // rescaled cast-on rounded to the nearest stitch can leave a rib short of a repeat.
  stitchMultiple: StitchMultiple | null;
  markers: number[];
  // The stitch chart is copied from the pattern when the project is created, not read live from
  // it: a project in progress shouldn't silently change under the knitter because the pattern was
  // edited afterwards. Empty when the project isn't working from a charted pattern.
  castOn: number;
  rows: PatternRow[];
};

export type Project = {
  name: string;
  // ISO YYYY-MM-DD, or null when the knitter didn't say. A real date rather than the free text it
  // used to be, so it can be sorted, compared and shown in whatever form suits the screen.
  startedOn: string | null;
  // A project can be a different craft from the pattern it came from — crocheting an edging onto
  // a knitted pattern, say — so it carries its own rather than reading the pattern's.
  craft: TechniqueCraft;
  photo: string | null;
  color: string;
  colorDeep: string;
  // Everything a pattern records about itself that a project has no other way to hold. A project
  // improvised without a pattern is still a sweater knitted at an intermediate level on 4.5mm
  // needles from a page someone pasted in — and when it's turned into a pattern, these are the
  // fields that were previously guessed or asked for again.
  category: PatternCategory;
  level: PatternLevel;
  needleSize: string;
  video: string;
  sourceName: string;
  sourceText: string;
  // Copied from the pattern when the project is cast on, and copied back if the project is ever
  // saved as a pattern of its own. Yours to change either way — editing it here never touches the
  // pattern in the library.
  notes: string;
  // Free-text groupings the knitter invents — "Christmas presents 2027", "for Mum", "stash-bust".
  // A list rather than one, because a project is often in more than one at once and a knitter who
  // only ever uses a single label never notices the difference.
  //
  // Deliberately not a catalogue. Unlike techniques, the whole value here is that nobody else
  // decides what the groups are, and there is nothing to share between knitters.
  labels: string[];
  patternId: string | null;
  // Which of the pattern's sizes this project is being knitted in. Every per-size number is
  // resolved against this when the project is created, so the project itself holds plain numbers.
  sizeIndex: number;
  status: ProjectStatus;
  // Both gauges as they stood when the project was cast on. The pattern's is snapshotted too,
  // because a pattern can be edited afterwards and a project already on the needles must not
  // silently re-scale underneath the knitter. Null means it was worked at the pattern's gauge.
  gauge: { pattern: Gauge; mine: Gauge } | null;
  // Maps a pattern material/tool slot id to one of the user's own material/tool ids — how a
  // generic pattern requirement is resolved to the actual stash item for this project.
  slotMaterials?: Record<string, string>;
  slotTools?: Record<string, string>;
  sections: ProjectSection[];
};

export type SectionStatus = 'not-started' | 'in-progress' | 'complete';
