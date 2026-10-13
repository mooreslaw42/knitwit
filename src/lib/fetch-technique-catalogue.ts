import { getSupabase } from '@/lib/supabase';
import { FAMILY_ORDER } from '@/lib/technique-catalogue';
import type { CatalogueTechnique, TechniqueCraft, TechniqueFamily } from '@/types/knitwit';

// Reading the shared catalogue out of Supabase (public.technique_catalogue).
//
// Separate from technique-catalogue.ts so the pure half — matching, labels, resolving an id —
// stays importable by code that must not pull in the Supabase client.

// One row as the table returns it. Kept separate from CatalogueTechnique so a column that comes
// back null — which a hand-edited row easily can — is repaired here rather than downstream.
type Row = {
  id?: unknown;
  name?: unknown;
  craft?: unknown;
  family?: unknown;
  abbr?: unknown;
  stitch_key?: unknown;
  summary?: unknown;
  aliases?: unknown;
  video?: unknown;
  link?: unknown;
};

const str = (v: unknown) => (typeof v === 'string' ? v : '');

function toTechnique(row: Row): CatalogueTechnique | null {
  const id = str(row.id).trim();
  const name = str(row.name).trim();
  if (!id || !name) return null;
  const craft = str(row.craft);
  const family = str(row.family);
  return {
    id,
    name,
    craft: (craft === 'crochet' || craft === 'both' ? craft : 'knit') as TechniqueCraft,
    family: (FAMILY_ORDER as string[]).includes(family)
      ? (family as TechniqueFamily)
      : 'other',
    abbr: str(row.abbr).trim(),
    stitchKey: str(row.stitch_key).trim(),
    summary: str(row.summary),
    aliases: Array.isArray(row.aliases) ? row.aliases.filter((a): a is string => typeof a === 'string') : [],
    video: str(row.video),
    link: str(row.link),
  };
}

// Newest schema first, each fallback dropping the column the one above it added.
//
// Selecting a column that isn't there is an error, not an empty field, so asking for `stitch_key`
// against a project that hasn't run the migration would cost the knitter the entire catalogue
// rather than one column of it. The app ships to the web and to TestFlight on its own schedule,
// so it will sometimes be the newer half. Written as a list rather than another special case
// because this is now the second column to need it, and there will be a third.
const COLUMN_SETS = [
  'id,name,craft,family,abbr,stitch_key,summary,aliases,video,link',
  'id,name,craft,family,abbr,summary,aliases,video,link',
  'id,name,craft,family,summary,aliases,video,link',
];

// Postgres names the column it could not find, so a missing-column error is told apart from a
// genuine failure by whether it mentions one we only just started asking for.
const OPTIONAL_COLUMNS = /abbr|stitch_key/;

export async function fetchTechniqueCatalogue(): Promise<CatalogueTechnique[]> {
  const query = (columns: string) =>
    getSupabase().from('technique_catalogue').select(columns).order('name');

  let data: unknown = null;
  let error: { message: string } | null = null;
  for (const columns of COLUMN_SETS) {
    ({ data, error } = await query(columns));
    if (!error || !OPTIONAL_COLUMNS.test(error.message)) break;
  }
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[])
    .map(toTechnique)
    .filter((t): t is CatalogueTechnique => t !== null);
}
