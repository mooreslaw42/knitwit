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
    summary: str(row.summary),
    aliases: Array.isArray(row.aliases) ? row.aliases.filter((a): a is string => typeof a === 'string') : [],
    video: str(row.video),
    link: str(row.link),
  };
}

const COLUMNS = 'id,name,craft,family,abbr,summary,aliases,video,link';
// The same query for a project whose database has not been migrated yet. Selecting a column that
// isn't there is an error, not an empty field, so asking for `abbr` against an older project would
// cost the knitter the entire catalogue rather than one column of it — and the app ships to the web
// and to TestFlight on its own schedule, so it will sometimes be the newer half.
const COLUMNS_WITHOUT_ABBR = 'id,name,craft,family,summary,aliases,video,link';

export async function fetchTechniqueCatalogue(): Promise<CatalogueTechnique[]> {
  const query = (columns: string) =>
    getSupabase().from('technique_catalogue').select(columns).order('name');

  let { data, error } = await query(COLUMNS);
  if (error && /abbr/.test(error.message)) {
    ({ data, error } = await query(COLUMNS_WITHOUT_ABBR));
  }
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[])
    .map(toTechnique)
    .filter((t): t is CatalogueTechnique => t !== null);
}
