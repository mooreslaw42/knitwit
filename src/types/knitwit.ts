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

// Library-card level of detail only — the full section/row/stitch-group pattern
// engine (expansionFor / currentRowContext / rowShorthand) is not ported yet.
export type Pattern = {
  name: string;
  category: PatternCategory;
  weight: string;
  accentColor: string;
  photo: string | null;
  gaugeStitches: string;
  gaugeRows: string;
  favorited: boolean;
  level: PatternLevel;
  sizes: string[];
};

export type ProjectNote = {
  id: number;
  row: number;
  text: string;
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
};

export type Project = {
  name: string;
  started: string;
  photo: string | null;
  color: string;
  colorDeep: string;
  patternId: string | null;
  slotMaterials?: Record<string, string>;
  sections: ProjectSection[];
};

export type SectionStatus = 'not-started' | 'in-progress' | 'complete';
