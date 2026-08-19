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

export function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return (h ? h + ':' : '') + mm + ':' + String(r).padStart(2, '0');
}
