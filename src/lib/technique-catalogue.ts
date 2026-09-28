import type {
  CatalogueTechnique,
  Technique,
  TechniqueCraft,
  TechniqueFamily,
} from '@/types/knitwit';

// Everything about the shared technique catalogue that doesn't touch the network: the labels, the
// matching, and turning an id into something a screen can render.
//
// Deliberately free of the Supabase client. Importing it pulls in AsyncStorage at module scope,
// which means any pure function living beside it drags a native module into whatever imports it —
// including project-to-pattern, which is plain data work and has no business needing one. The
// fetch lives in fetch-technique-catalogue.ts.

// A day. The catalogue changes when someone edits a row in the dashboard, which is rare, so
// re-fetching more often than this is spending a request to learn nothing.
export const CATALOGUE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const FAMILY_LABELS: Record<TechniqueFamily, string> = {
  'cast-on': 'Cast-ons',
  'bind-off': 'Bind-offs',
  increase: 'Increases',
  decrease: 'Decreases',
  joining: 'Joining & seaming',
  colourwork: 'Colourwork',
  shaping: 'Shaping',
  texture: 'Texture & stitch patterns',
  finishing: 'Finishing',
  other: 'Other',
};

export const FAMILY_ORDER: TechniqueFamily[] = [
  'cast-on',
  'increase',
  'decrease',
  'shaping',
  'texture',
  'colourwork',
  'joining',
  'bind-off',
  'finishing',
  'other',
];

export const STATUS_LABELS = {
  want: 'Want to learn',
  learning: 'Learning',
  known: 'Mastered',
} as const;

export const STATUS_ORDER = ['want', 'learning', 'known'] as const;

// ---- Matching text to the catalogue ----

const normalise = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// Find the catalogue entry a pattern means when it names a technique.
//
// Exact on the name or an alias first, then a contained match, and nothing clever after that. A
// wrong match is worse than none: it would tell a knitter they already know something they have
// never done, and quietly attach the wrong video to a pattern.
export function matchTechnique(
  text: string,
  catalogue: CatalogueTechnique[],
): CatalogueTechnique | null {
  const q = normalise(text);
  if (!q) return null;

  for (const t of catalogue) {
    if (normalise(t.name) === q) return t;
    // The short form is what a pattern actually writes, and it is exactly the case a knitter needs
    // looked up: "w&t" in an imported row should find Wrap and turn. Exact only — a two-letter
    // abbreviation inside a sentence matches half the language, which is why the contained pass
    // below never considers one.
    if (t.abbr && normalise(t.abbr) === q) return t;
    if (t.aliases.some((a) => normalise(a) === q)) return t;
  }
  // "German short rows (see page 4)" should still find German short rows. Longest name first, so
  // a pattern naming a specific variant doesn't land on a shorter, more general entry.
  const byLength = [...catalogue].sort((a, b) => b.name.length - a.name.length);
  for (const t of byLength) {
    const name = normalise(t.name);
    if (name.length >= 5 && q.includes(name)) return t;
    const alias = t.aliases.find((a) => normalise(a).length >= 5 && q.includes(normalise(a)));
    if (alias) return t;
  }
  return null;
}

// ---- Resolving what to show ----

// Everything a screen needs to render one of the knitter's techniques, whether it came from the
// catalogue or they added it themselves. Callers shouldn't have to branch on that.
export type ResolvedTechnique = {
  id: string;
  name: string;
  craft: TechniqueCraft;
  family: TechniqueFamily;
  abbr: string;
  summary: string;
  video: string;
  link: string;
  isCustom: boolean;
};

export function resolveTechnique(
  id: string,
  mine: Technique | undefined,
  catalogue: Record<string, CatalogueTechnique>,
): ResolvedTechnique {
  const entry = catalogue[id];
  // `abbr` is defaulted here rather than trusted: a catalogue cached by an older version of the app
  // has no such field, and it is read on every screen that names a technique.
  if (entry) return { ...entry, abbr: entry.abbr ?? '', isCustom: false };
  if (mine?.custom) {
    return {
      id,
      name: mine.custom.name,
      craft: mine.custom.craft,
      family: 'other',
      abbr: mine.custom.abbr ?? '',
      summary: '',
      video: '',
      link: '',
      isCustom: true,
    };
  }
  // A catalogue slug that isn't cached yet — first run, still loading, or a row that was removed.
  // Shown as its own slug rather than vanishing: a section that says it uses this still does.
  return {
    id,
    name: id.replace(/-/g, ' '),
    craft: 'both',
    family: 'other',
    abbr: '',
    summary: '',
    video: '',
    link: '',
    isCustom: false,
  };
}

// "Slip slip knit (ssk)" — how a technique reads wherever it is named beside other things: a pill
// on a section, a row in the library, a line in a summary. The full name first, because that is
// what it is called; the short form after, because that is what the pattern in the knitter's hand
// says. Just the name when there is no short form, rather than an empty pair of brackets.
export function techniqueLabel(technique: { name: string; abbr?: string }): string {
  const abbr = technique.abbr?.trim();
  return abbr ? `${technique.name} (${abbr})` : technique.name;
}
