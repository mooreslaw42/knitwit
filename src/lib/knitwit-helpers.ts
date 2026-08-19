// Ported from reference/index.html's project/section helper functions.
import type { Project, ProjectSection, SectionStatus } from '@/types/knitwit';

export function projectProgress(p: Project): { done: number; total: number; pct: number } {
  let done = 0;
  let total = 0;
  p.sections.forEach((s) => {
    done += s.row;
    total += s.totalRows;
  });
  return { done, total, pct: total ? done / total : 0 };
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
