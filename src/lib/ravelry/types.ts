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
