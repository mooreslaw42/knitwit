import { CATEGORY_LABELS, CRAFT_LABELS } from '@/constants/catalogs';
import type { Pattern, PatternLevel } from '@/types/knitwit';

export const LEVEL_LABELS: Record<PatternLevel, string> = {
  beginner: 'Beginner',
  easy: 'Easy',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export type PatternSummary = {
  // What kind of pattern it is: category, craft, level, needle or hook.
  kind: string;
  // What is in it, and what has been done with it: sizes, sections, yarns, where it came from, how
  // many projects have been made from it. Empty for a pattern that is still just a name.
  contents: string;
  // The yarn colours, for a colourwork pattern whose slots carry one. A row of swatches tells two
  // pixel patterns apart at a glance where their names ("Pixel pattern", "Pixel pattern") cannot.
  colors: string[];
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// "XS–XL (5 sizes)". One size, or none recorded, says nothing — every pattern has at least that.
function describeSizes(sizes: string[]): string {
  const real = sizes.filter((s) => s.trim() && s !== 'One size');
  if (real.length === 0) return '';
  if (real.length === 1) return real[0];
  return `${real[0]}–${real[real.length - 1]} (${real.length} sizes)`;
}

// The two lines under a pattern's name in the library. A list of names with "Sweater · 4.5mm"
// beneath each looked the same from one row to the next; this is what actually tells them apart.
export function summarizePattern(pattern: Pattern, projectCount: number): PatternSummary {
  const tool = pattern.needleSize || pattern.weight;
  const kind = [
    CATEGORY_LABELS[pattern.category],
    CRAFT_LABELS[pattern.craft],
    LEVEL_LABELS[pattern.level],
    tool,
  ]
    .filter(Boolean)
    .join(' · ');

  const sections = pattern.sections ?? [];
  const charted = sections.some((s) => s.rows.length > 0);
  const materials = pattern.materials ?? [];
  const colors = materials.map((m) => m.color).filter((c): c is string => !!c);

  const contents = [
    describeSizes(pattern.sizes ?? []),
    sections.length
      ? `${plural(sections.length, 'section', 'sections')}${charted ? ', charted' : ''}`
      : '',
    // A colourwork pattern's yarns are colours, and are counted as such: the swatches beside this
    // stop after a handful, so the number is what says how many there really are.
    colors.length
      ? plural(colors.length, 'colour', 'colours')
      : materials.length
        ? plural(materials.length, 'yarn', 'yarns')
        : '',
    pattern.ravelrySource ? 'from Ravelry' : '',
    projectCount ? plural(projectCount, 'project', 'projects') : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return { kind, contents, colors };
}
