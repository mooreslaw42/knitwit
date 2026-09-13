import { sectionRowCounts } from '@/lib/knitwit-helpers';
import type { Achievements, ActivityDay, ProjectSection } from '@/types/knitwit';

// The record the awards are computed from. Pure functions over it live here; the store owns the
// state and calls these when something happens.

// Two years of activity. The totals are separate and never trimmed, so this only bounds how far
// back a streak can be recomputed — not what the knitter has earned.
const MAX_DAYS = 730;

export function emptyAchievements(): Achievements {
  return {
    totals: {
      rows: 0,
      stitches: 0,
      seconds: 0,
      projectsFinished: 0,
      projectsFrogged: 0,
      patternsCreated: 0,
      techniquesAdded: 0,
    },
    finishedByCategory: {},
    finishedByCraft: {},
    finishedByPattern: {},
    days: [],
    earned: {},
  };
}

// Repair a persisted record into a complete one, whatever shape it was saved in.
//
// Called unconditionally by the migration rather than behind a version gate. Every new field on
// Achievements would otherwise need its own gate, and a gate written after the store has already
// passed that version never runs — which is exactly how `finishedByCraft` arrived undefined and
// crashed the awards screen. Filling from a fresh record means a field added tomorrow is repaired
// by the same line.
export function normaliseAchievements(value: unknown): Achievements {
  const base = emptyAchievements();
  if (typeof value !== 'object' || value === null) return base;
  const a = value as Partial<Achievements>;
  return {
    totals: { ...base.totals, ...(a.totals ?? {}) },
    finishedByCategory: a.finishedByCategory ?? {},
    finishedByCraft: a.finishedByCraft ?? {},
    finishedByPattern: a.finishedByPattern ?? {},
    days: Array.isArray(a.days) ? a.days : [],
    earned: a.earned ?? {},
  };
}

// Local, not UTC. A knitter in Amsterdam finishing at 00:30 has not started a new knitting day in
// any sense they'd recognise, and toISOString() would say otherwise.
export function localDate(at: Date = new Date()): string {
  const y = at.getFullYear();
  const m = String(at.getMonth() + 1).padStart(2, '0');
  const d = String(at.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date: string, delta: number): string {
  const [y, m, d] = date.split('-').map(Number);
  // Constructed as a local date and shifted by whole days, so a daylight-saving change moves the
  // clock rather than the calendar — 30 March is still the day after 29 March.
  const at = new Date(y, m - 1, d);
  at.setDate(at.getDate() + delta);
  return localDate(at);
}

// Record a day's knitting, merging into today's entry if there is one.
export function recordActivity(
  a: Achievements,
  add: { rows?: number; stitches?: number; seconds?: number },
  today = localDate(),
): Achievements {
  const rows = Math.max(0, Math.round(add.rows ?? 0));
  const stitches = Math.max(0, Math.round(add.stitches ?? 0));
  const seconds = Math.max(0, Math.round(add.seconds ?? 0));
  if (rows === 0 && stitches === 0 && seconds === 0) return a;

  const days = [...a.days];
  const i = days.findIndex((d) => d.date === today);
  const entry: ActivityDay = i >= 0 ? { ...days[i] } : { date: today, rows: 0, stitches: 0, seconds: 0 };
  entry.rows += rows;
  entry.stitches += stitches;
  entry.seconds += seconds;
  if (i >= 0) days[i] = entry;
  else days.push(entry);

  // Sorted so the streak walk can rely on order, trimmed from the oldest end.
  days.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));

  return {
    ...a,
    days: days.slice(-MAX_DAYS),
    totals: {
      ...a.totals,
      rows: a.totals.rows + rows,
      stitches: a.totals.stitches + stitches,
      seconds: a.totals.seconds + seconds,
    },
  };
}

// Days in a row up to today. Yesterday still counts as a live streak — a knitter part-way through
// today hasn't broken anything yet, and telling them they had at 9am would be both wrong and mean.
export function currentStreak(a: Achievements, today = localDate()): number {
  const knitted = new Set(a.days.filter((d) => d.rows > 0).map((d) => d.date));
  let cursor = knitted.has(today) ? today : addDays(today, -1);
  if (!knitted.has(cursor)) return 0;
  let n = 0;
  while (knitted.has(cursor)) {
    n += 1;
    cursor = addDays(cursor, -1);
  }
  return n;
}

export function knittedToday(a: Achievements, today = localDate()): boolean {
  return a.days.some((d) => d.date === today && d.rows > 0);
}

// The longest run ever, for the awards screen.
export function longestStreak(a: Achievements): number {
  const dates = a.days
    .filter((d) => d.rows > 0)
    .map((d) => d.date)
    .sort();
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const date of dates) {
    run = previous && addDays(previous, 1) === date ? run + 1 : 1;
    previous = date;
    if (run > best) best = run;
  }
  return best;
}

// How many stitches a row is worth. Exact when the section is charted — the live count entering
// the row is what the knitter works across — and the cast-on as a flat estimate when it isn't.
// A section with neither contributes rows but no stitches, which the awards screen says out loud
// rather than passing an undercount off as a total.
export function stitchesForRow(section: Pick<ProjectSection, 'rows' | 'castOn'>, row: number): number {
  const index = Math.max(0, row - 1);
  if (section.rows.length > index) {
    const before = sectionRowCounts(section.rows, section.castOn);
    return Math.max(0, before[index] ?? 0);
  }
  return Math.max(0, section.castOn ?? 0);
}
