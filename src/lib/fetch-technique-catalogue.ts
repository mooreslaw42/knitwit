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
    summary: str(row.summary),
    aliases: Array.isArray(row.aliases) ? row.aliases.filter((a): a is string => typeof a === 'string') : [],
    video: str(row.video),
    link: str(row.link),
  };
}

export async function fetchTechniqueCatalogue(): Promise<CatalogueTechnique[]> {
  const { data, error } = await getSupabase()
    .from('technique_catalogue')
    .select('id,name,craft,family,summary,aliases,video,link')
    .order('name');
  if (error) throw new Error(error.message);
  return (data ?? []).map(toTechnique).filter((t): t is CatalogueTechnique => t !== null);
}
