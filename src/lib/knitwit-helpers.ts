// Ported from reference/index.html's project/section helper functions.
import { STITCHES } from '@/constants/catalogs';
import type {
  PatternRow,
  PatternStitchGroup,
  Project,
  ProjectSection,
  SectionStatus,
} from '@/types/knitwit';

// ---- Stitch-by-stitch row math (ported from reference resolveStitches / rowDelta) ----

function groupTakes(g: PatternStitchGroup): number {
  const def = STITCHES[g.type];
  return def ? def.takes : 1;
}

// Resolve how many units each group works in a row, given the live stitch count entering it.
// Exact spans consume a fixed amount; to-last reserves `count` stitches at the end; the remaining
// pool is split evenly between the flexible (all / to-last) groups that actually consume stitches.
// A flexible group that consumes nothing (a lone yarn-over / M1) defaults to one unit.
export function resolveRowGroups(
  row: PatternRow,
  stitchesBefore: number,
): { group: PatternStitchGroup; units: number; takes: number; consumes: number }[] {
  const groups = row.stitches ?? [];
  const units = new Array(groups.length).fill(0);
  const takes = groups.map(groupTakes);
  let fixed = 0;
  const flex: number[] = [];
  groups.forEach((g, i) => {
    if (g.span === 'exact') {
      units[i] = Math.max(0, g.count || 0);
      fixed += units[i] * takes[i];
    } else if (g.span === 'to-last') {
      flex.push(i);
      fixed += Math.max(0, g.count || 0);
    } else {
      flex.push(i);
    }
  });
  const pool = Math.max(0, (stitchesBefore || 0) - fixed);
  const consuming = flex.filter((i) => takes[i] > 0);
  if (consuming.length) {
    const share = Math.floor(pool / consuming.length);
    consuming.forEach((gi, k) => {
      const stitches = k === consuming.length - 1 ? pool - share * (consuming.length - 1) : share;
      units[gi] = Math.floor(stitches / takes[gi]);
    });
  }
  flex.filter((i) => takes[i] === 0).forEach((i) => {
    if (!units[i]) units[i] = 1;
  });
  return groups.map((g, i) => ({ group: g, units: units[i], takes: takes[i], consumes: units[i] * takes[i] }));
}

// The live stitch count after working a row, given the count before it.
export function rowStitchesAfter(row: PatternRow, stitchesBefore: number): number {
  return resolveRowGroups(row, stitchesBefore).reduce((total, x) => {
    const def = STITCHES[x.group.type];
    return total + (def ? def.delta : 0) * x.units;
  }, stitchesBefore);
}

// Running live-stitch count entering each row of a section, starting from `castOn`. Returns one
// entry per row: the count as you begin that row. (Count after row i is counts[i+1], or the final
// return for the last row.)
export function sectionRowCounts(rows: PatternRow[], castOn: number): number[] {
  const counts: number[] = [];
  let n = Math.max(0, castOn || 0);
  for (const row of rows) {
    counts.push(n);
    n = rowStitchesAfter(row, n);
  }
  return counts;
}

// The row numbers a section should prompt a stitch marker on. A marker can be set two ways —
// as a bare row number on the section, or by flagging a charted row in the stitch editor — and the
// counter only understands row numbers, so both are merged here.
export function patternSectionMarkers(section: {
  markers: number[];
  rows: PatternRow[];
}): number[] {
  const fromRows = (section.rows ?? [])
    .map((row, i) => (row.marker ? i + 1 : 0))
    .filter((n) => n > 0);
  return Array.from(new Set([...(section.markers ?? []), ...fromRows])).sort((a, b) => a - b);
}

// ---- Project / section helpers ----

export function projectProgress(p: Project): { done: number; total: number; pct: number } {
  let done = 0;
  let total = 0;
  p.sections.forEach((s) => {
    done += s.row;
    total += s.totalRows;
  });
  return { done, total, pct: total ? done / total : 0 };
}

// How many of a tool are currently tied up in a project. A tool counts as in use once for every
// unfinished section that calls for it — two live projects both needing the 4.5mm circular means
// two are in use. Finished sections release their tool.
export function toolInUseCount(projects: Record<string, Project>, toolId: string): number {
  return Object.values(projects).reduce(
    (n, p) => n + p.sections.filter((s) => s.toolId === toolId && !s.complete).length,
    0,
  );
}

// "1 in use" / "2 are in use" / "None in use" — the subject-verb agreement the UI asks for.
export function inUseLabel(count: number): string {
  if (count <= 0) return 'None in use';
  if (count === 1) return '1 in use';
  return `${count} are in use`;
}

export function sectionStatus(sec: ProjectSection): SectionStatus {
  if (sec.complete) return 'complete';
  if (sec.row > 0) return 'in-progress';
  return 'not-started';
}

// Index of the first non-complete section, or the last section if all are complete.
export function currentSectionIndexOf(p: Project): number {
  const idx = p.sections.findIndex((s) => !s.complete);
  return idx === -1 ? p.sections.length - 1 : idx;
}

const NEUTRAL_PROJECT_COLORS = { color: '#F7EBDD', colorDeep: '#8A7873' };

// Multiplies each channel toward black. Ported from the original's darken().
export function darken(hex: string, pct = 0.28): string {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 6) return NEUTRAL_PROJECT_COLORS.colorDeep;
  const f = Math.max(0, 1 - pct);
  const channel = (n: number) =>
    Math.round(Math.max(0, Math.min(255, n)) * f)
      .toString(16)
      .padStart(2, '0');
  return (
    '#' +
    channel(parseInt(h.slice(0, 2), 16)) +
    channel(parseInt(h.slice(2, 4), 16)) +
    channel(parseInt(h.slice(4, 6), 16))
  );
}

// A project takes its colour from the pattern it is knitting; neutral when improvising.
// There is deliberately no colour picker — this keeps a project visually tied to its pattern.
export function deriveProjectColors(accentColor: string | null): {
  color: string;
  colorDeep: string;
} {
  if (!accentColor) return { ...NEUTRAL_PROJECT_COLORS };
  return { color: accentColor, colorDeep: darken(accentColor, 0.28) };
}

export function todayStarted(date = new Date()): string {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `Started ${months[date.getMonth()]} ${date.getDate()}`;
}

export function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return (h ? h + ':' : '') + mm + ':' + String(r).padStart(2, '0');
}
