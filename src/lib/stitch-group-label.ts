import { STITCHES } from '@/constants/catalogs';
import type { StitchSpan } from '@/types/knitwit';

// A short readable summary of one stitch group, e.g. "k2", "M1L", "k to last 1", "p across".
//
// Lifted out of the stitch editor, where it was private and untested, on the way to building
// something else that needed it. That caller went a different way in the end and the editor is
// the only one again — but a pure function that turns data into words the knitter reads is worth
// having somewhere it can be tested, which is the state it is in now.
//
// Takes the count already resolved to a plain number: the editor holds it as a draft string, and
// a pattern section holds it per size.
export function stitchGroupLabel(group: {
  type: string;
  span: StitchSpan;
  count: number | null;
}): string {
  const def = STITCHES[group.type];
  const abbr = def ? def.abbr : group.type;
  if (group.span === 'all') return `${abbr} across`;
  if (group.span === 'to-last') return `${abbr} to last ${group.count || '?'}`;
  return `${abbr}${def && def.takes > 0 && group.count ? group.count : ''}`;
}
