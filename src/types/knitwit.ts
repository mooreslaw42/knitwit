// Ported from reference/index.html's in-memory data model (MATERIALS/TOOLS/PATTERNS/PROJECTS
// seeds and their catalogs). Deliberately kept close to the original shapes rather than
// redesigned — see AGENTS.md.

export type CraftType = 'knit' | 'crochet';

export type Craft = {
  thickness: string;
  gaugeStitches: string;
  gaugeRows: string;
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
  gaugeStitches: string;
  gaugeRows: string;
  link: string;
  photo: string | null;
  crafts?: Partial<Record<CraftType, Craft>>;
};

// A user-kept reference note for a knitting/crochet technique — a cast-on, a decrease, a
// finishing trick — with an optional link to a tutorial. Entirely user-authored.
export type TechniqueCraft = CraftType | 'both';

export type Technique = {
  name: string;
  craft: TechniqueCraft;
  notes: string;
  link: string;
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

export type PatternCategory =
  | 'sweaters'
  | 'accessories'
  | 'hats'
  | 'scarves'
  | 'socks'
  | 'blankets'
  | 'toys'
  | 'home'
  | 'baby'
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

// A run of one stitch/action within a row — e.g. "k2" (type knit, span exact, count 2) or
// "*yo, k2tog* across" (two groups, span all). `type` is a key into the STITCHES catalog.
export type PatternStitchGroup = {
  id: string;
  type: string;
  span: StitchSpan;
  count: number | null;
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

export type PatternSection = {
  name: string;
  totalRows: number;
  castOn: number; // live stitch count the section starts from, for the running stitch-count math
  materials: string[]; // ids of the pattern's material slots this section uses
  tools: string[]; // ids of the pattern's tool slots this section uses
  techniques: string[]; // ids of the pattern's techniques this section uses
  // Raw written/pasted pattern text for this section (Phase 1 of the stitch engine).
  description: string;
  // The structured stitch-by-stitch-per-row model (Phase 2+). Empty until authored/parsed; the
  // counter and editor consume it, and stitch counts are derived from it, never stored.
  rows: PatternRow[];
  notes: ProjectNote[];
  markers: number[];
};

// The full section/row/stitch-group pattern engine (expansionFor / currentRowContext /
// rowShorthand) is still not ported; `sections` here is the planning template that seeds a
// project's countable sections, not that engine. `materials`/`tools` are the generic slots a
// project resolves against the user's stash.
export type Pattern = {
  name: string;
  category: PatternCategory;
  weight: string; // legacy yarn-weight descriptor (kept for seeds); new patterns use needleSize
  needleSize: string; // recommended needle / hook size, e.g. "4.5mm"
  video: string; // optional link to an instruction video
  // The original pattern the user imported, kept for reference (and future automatic parsing).
  sourceName: string; // uploaded file name, if any
  sourceText: string; // pasted pattern text, if any
  accentColor: string;
  photo: string | null;
  gaugeStitches: string;
  gaugeRows: string;
  favorited: boolean;
  level: PatternLevel;
  sizes: string[];
  materials: PatternMaterial[];
  tools: PatternTool[];
  techniques: PatternTechnique[];
  sections: PatternSection[];
};

export type ProjectSection = {
  name: string;
  totalRows: number;
  row: number;
  complete: boolean;
  seconds: number;
  notes: ProjectNote[];
  materialId: string | null;
  toolId: string | null;
  markers: number[];
  // The stitch chart is copied from the pattern when the project is created, not read live from
  // it: a project in progress shouldn't silently change under the knitter because the pattern was
  // edited afterwards. Empty when the project isn't working from a charted pattern.
  castOn: number;
  rows: PatternRow[];
};

export type Project = {
  name: string;
  started: string;
  photo: string | null;
  color: string;
  colorDeep: string;
  patternId: string | null;
  // Maps a pattern material/tool slot id to one of the user's own material/tool ids — how a
  // generic pattern requirement is resolved to the actual stash item for this project.
  slotMaterials?: Record<string, string>;
  slotTools?: Record<string, string>;
  sections: ProjectSection[];
};

export type SectionStatus = 'not-started' | 'in-progress' | 'complete';
