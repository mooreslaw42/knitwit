// The slices of Ravelry's API responses that the import actually reads. Deliberately partial and
// defensive: every field is optional because Ravelry fills a stash entry in as sparsely as the
// knitter did, and a yarn the API has never heard of still has to map to *something* rather than
// throw. Shapes captured from real responses — see docs/plans/ravelry-import.md, Appendix A.

export type RavelryPhoto = {
  medium_url?: string | null;
  square_url?: string | null;
  thumbnail_url?: string | null;
  url?: string | null;
};

export type RavelryFiber = {
  percentage?: number | null;
  fiber_type?: { name?: string | null } | null;
  fiber_category?: { name?: string | null } | null;
};

export type RavelryYarn = {
  name?: string | null;
  permalink?: string | null; // e.g. "garnstudio-drops-saga" → the yarn's library page
  grams?: number | null; // grams per skein, as the yarn is sold
  yardage?: number | null; // yards per skein
  yarn_company?: { name?: string | null } | null;
  yarn_weight?: { name?: string | null } | null; // "DK", "Fingering", …
  yarn_fibers?: RavelryFiber[] | null;
};

// One quantity line against a stash entry. A stash entry can hold several (a split skein, a second
// dye lot); the one with no primary_pack_id is the head of the group.
export type RavelryStashPack = {
  primary_pack_id?: number | null;
  grams_per_skein?: number | null;
  meters_per_skein?: number | null;
  yards_per_skein?: number | null;
  total_paid?: string | null;
};

export type RavelryStash = {
  id: number;
  permalink?: string | null; // the stash entry's own slug, e.g. "drops-saga"
  name?: string | null; // "Garnstudio DROPS Saga" — company and yarn, already composed
  colorway_name?: string | null; // "3 Birk"
  dye_lot?: string | null; // "123"
  yarn_weight_name?: string | null; // "DK" — the stash entry's own, may differ from the yarn's
  notes?: string | null;
  photos?: RavelryPhoto[] | null;
  yarn?: RavelryYarn | null;
  packs?: RavelryStashPack[] | null;
  user?: { username?: string | null } | null;
};

export type RavelryNeedleType = {
  length?: number | null; // in inches
  metric_name?: string | null; // "3.25"
  name?: string | null; // US size: "3 ", "D", "00000", or null for sizes with no US equivalent
  type_name?: string | null; // "circular" | "dp" | "hook" | "steel" | "straight" | …
};

// Ravelry keeps one record per physical needle a knitter owns; identical needles share a
// needle_type_id, which is how duplicates are counted back into a quantity.
export type RavelryNeedleRecord = {
  id: number;
  needle_type_id?: number | null;
  needle_type?: RavelryNeedleType | null;
  comment?: string | null;
};

// Categories nest: "Sleeveless Top" → parent "Tops" → parent "Clothing". The chain is walked
// most-specific-first when deciding which Knitwit PatternCategory it is.
export type RavelryPatternCategory = {
  name?: string | null;
  permalink?: string | null;
  parent?: RavelryPatternCategory | null;
};

export type RavelryPatternNeedleSize = {
  metric?: number | null; // in millimetres
  hook?: boolean | null;
  name?: string | null; // the US label, e.g. "US 2½ - 3.0 mm"
};

export type RavelryPattern = {
  id: number;
  permalink?: string | null; // → the Ravelry library page
  name?: string | null;
  notes?: string | null; // the designer's description, plain text
  gauge?: number | null; // stitches per gauge_divisor
  row_gauge?: number | null; // rows per gauge_divisor
  gauge_divisor?: number | null; // the measured window, in inches (occasionally 10 for cm)
  yardage_description?: string | null; // "656 - 1312 yards"
  yarn_weight_description?: string | null; // "Fingering (14 wpi)"
  sizes_available?: string | null; // freeform, e.g. "XS-4XL" — a range, not a clean list
  difficulty_average?: number | null; // 1–10, lower is easier
  difficulty_count?: number | null;
  craft?: { name?: string | null } | null; // "Knitting" | "Crochet"
  pattern_type?: { name?: string | null } | null; // "Tank/Camisole"
  pattern_categories?: RavelryPatternCategory[] | null;
  pattern_needle_sizes?: RavelryPatternNeedleSize[] | null;
  pattern_author?: { name?: string | null } | null;
  photos?: RavelryPhoto[] | null;
  languages?: { name?: string | null }[] | null;
  personal_attributes?: { favorited?: boolean | null } | null;
};

// A yarn used in a project. `stash_id` is set only when the knitter linked it to a stash entry —
// that is the one id that can match an imported Material (keyed by stash id); `yarn_id` is the yarn
// catalogue, kept for a looser fallback.
export type RavelryProjectPack = {
  stash_id?: number | null;
  yarn_id?: number | null;
  skeins?: number | null;
};

export type RavelryProjectNeedleSize = {
  metric?: number | null; // millimetres
};

export type RavelryProject = {
  id: number;
  permalink?: string | null;
  name?: string | null;
  pattern_id?: number | null; // → the pattern this was made from, to link an imported card
  craft_name?: string | null; // "Knitting" | "Crochet"
  status_name?: string | null; // "In progress" | "Finished" | "Frogged" | "Hibernating" | …
  progress?: number | null; // percent complete, 0–100; null when the knitter never set it
  started?: string | null; // "2026/10/01"
  personal_source_name?: string | null;
  notes?: string | null;
  tag_names?: string[] | null;
  size?: string | null; // freeform, e.g. "M"
  gauge?: number | null; // the knitter's own, stitches per gauge_divisor
  row_gauge?: number | null;
  gauge_divisor?: number | null;
  photos?: RavelryPhoto[] | null;
  needle_sizes?: RavelryProjectNeedleSize[] | null;
  packs?: RavelryProjectPack[] | null;
  user?: { username?: string | null } | null;
};
