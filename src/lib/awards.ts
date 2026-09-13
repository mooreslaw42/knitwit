import { CATEGORY_LABELS, CATEGORY_ORDER } from '@/constants/catalogs';
import { currentStreak, longestStreak } from '@/lib/achievements';
import type { Achievements, PatternCategory } from '@/types/knitwit';

// The award catalogue, and the level derived from it.
//
// Every award is a number measured against a threshold, so progress is always expressible as
// "N of M" rather than an opaque locked/unlocked. That matters for the Home stat, which shows the
// nearest unearned one: a knitter should be able to see what they're close to.

export type AwardGroup =
  | 'streak'
  | 'volume'
  | 'time'
  | 'finishing'
  | 'range'
  | 'devotion'
  | 'making'
  | 'frogging';

export type Award = {
  id: string;
  name: string;
  description: string;
  group: AwardGroup;
  goal: number;
  // Weighted by how hard it is. Flat points would make "note your first technique" worth as much
  // as a hundred-day streak, and the level would stop meaning anything.
  points: number;
  // Current standing against the goal.
  measure: (a: Achievements) => number;
  // How the number reads on screen — "4,200" of "10,000 stitches" needs different units.
  format?: (n: number) => string;
};

const hours = (n: number) => `${Math.floor(n)}h`;
const withCommas = (n: number) => Math.floor(n).toLocaleString('en-GB');

const finishedCategories = (a: Achievements) =>
  CATEGORY_ORDER.filter((c) => (a.finishedByCategory[c] ?? 0) > 0).length;

// The most times any one pattern has been finished.
const mostRepeated = (a: Achievements) =>
  Object.values(a.finishedByPattern).reduce((best, n) => Math.max(best, n), 0);

function category(id: PatternCategory, name: string, points: number): Award {
  return {
    id: `range-${id}`,
    name,
    description: `Finish a ${CATEGORY_LABELS[id].toLowerCase()}.`,
    group: 'range',
    goal: 1,
    points,
    measure: (a) => a.finishedByCategory[id] ?? 0,
  };
}

export const AWARDS: Award[] = [
  // Streaks — the habit.
  {
    id: 'streak-3',
    name: 'Three in a row',
    description: 'Knit on three consecutive days.',
    group: 'streak',
    goal: 3,
    points: 5,
    measure: (a) => Math.max(currentStreak(a), longestStreak(a)),
  },
  {
    id: 'streak-7',
    name: 'A full week',
    description: 'Knit every day for a week.',
    group: 'streak',
    goal: 7,
    points: 10,
    measure: (a) => Math.max(currentStreak(a), longestStreak(a)),
  },
  {
    id: 'streak-30',
    name: 'A month of evenings',
    description: 'Knit every day for thirty days.',
    group: 'streak',
    goal: 30,
    points: 25,
    measure: (a) => Math.max(currentStreak(a), longestStreak(a)),
  },
  {
    id: 'streak-100',
    name: 'A hundred days',
    description: 'Knit every day for a hundred days.',
    group: 'streak',
    goal: 100,
    points: 50,
    measure: (a) => Math.max(currentStreak(a), longestStreak(a)),
  },

  // Volume.
  { id: 'stitches-1k', name: 'A thousand stitches', description: 'Work 1,000 stitches.', group: 'volume', goal: 1000, points: 5, measure: (a) => a.totals.stitches, format: withCommas },
  { id: 'stitches-10k', name: 'Ten thousand stitches', description: 'Work 10,000 stitches.', group: 'volume', goal: 10000, points: 10, measure: (a) => a.totals.stitches, format: withCommas },
  { id: 'stitches-100k', name: 'A hundred thousand', description: 'Work 100,000 stitches.', group: 'volume', goal: 100000, points: 25, measure: (a) => a.totals.stitches, format: withCommas },
  { id: 'stitches-1m', name: 'A million stitches', description: 'Work 1,000,000 stitches.', group: 'volume', goal: 1000000, points: 50, measure: (a) => a.totals.stitches, format: withCommas },

  // Time, measured by the stopwatch.
  { id: 'time-1h', name: 'An hour in', description: 'Log an hour of knitting.', group: 'time', goal: 3600, points: 5, measure: (a) => a.totals.seconds, format: (n) => hours(n / 3600) },
  { id: 'time-10h', name: 'Ten hours', description: 'Log ten hours of knitting.', group: 'time', goal: 36000, points: 10, measure: (a) => a.totals.seconds, format: (n) => hours(n / 3600) },
  { id: 'time-100h', name: 'A hundred hours', description: 'Log a hundred hours of knitting.', group: 'time', goal: 360000, points: 50, measure: (a) => a.totals.seconds, format: (n) => hours(n / 3600) },

  // Finishing.
  { id: 'finish-1', name: 'Cast off', description: 'Finish your first project.', group: 'finishing', goal: 1, points: 5, measure: (a) => a.totals.projectsFinished },
  { id: 'finish-5', name: 'Five finished', description: 'Finish five projects.', group: 'finishing', goal: 5, points: 10, measure: (a) => a.totals.projectsFinished },
  { id: 'finish-25', name: 'Twenty-five finished', description: 'Finish twenty-five projects.', group: 'finishing', goal: 25, points: 50, measure: (a) => a.totals.projectsFinished },

  // Range — one per kind of thing, plus the full set.
  category('sweaters', 'Sweater weather', 5),
  category('hats', 'Hats off', 5),
  category('scarves', 'Wrapped up', 5),
  category('socks', 'Sock drawer', 10),
  category('blankets', 'Blanket statement', 10),
  category('toys', 'Something soft', 5),
  {
    id: 'range-all',
    name: 'A bit of everything',
    description: 'Finish a project in every category.',
    group: 'range',
    goal: CATEGORY_ORDER.length,
    points: 50,
    measure: finishedCategories,
  },

  // Devotion — the same pattern, more than once.
  { id: 'again-2', name: 'Once more', description: 'Finish the same pattern twice.', group: 'devotion', goal: 2, points: 10, measure: mostRepeated },
  { id: 'again-3', name: 'A firm favourite', description: 'Finish the same pattern three times.', group: 'devotion', goal: 3, points: 25, measure: mostRepeated },
  { id: 'again-5', name: 'Knitting it from memory', description: 'Finish the same pattern five times.', group: 'devotion', goal: 5, points: 50, measure: mostRepeated },

  // Making — building up the library rather than the knitting.
  { id: 'pattern-1', name: 'Pattern keeper', description: 'Add your first pattern.', group: 'making', goal: 1, points: 5, measure: (a) => a.totals.patternsCreated },
  { id: 'pattern-5', name: 'A shelf of patterns', description: 'Add five patterns.', group: 'making', goal: 5, points: 10, measure: (a) => a.totals.patternsCreated },
  { id: 'pattern-25', name: 'A library', description: 'Add twenty-five patterns.', group: 'making', goal: 25, points: 25, measure: (a) => a.totals.patternsCreated },
  { id: 'technique-1', name: 'Something new', description: 'Note down your first technique.', group: 'making', goal: 1, points: 5, measure: (a) => a.totals.techniquesAdded },
  { id: 'technique-10', name: 'Ten tricks', description: 'Note down ten techniques.', group: 'making', goal: 10, points: 25, measure: (a) => a.totals.techniquesAdded },

  // Frogging — because pulling it back is part of it.
  { id: 'frog-1', name: 'Rip it, rip it', description: 'Frog a project. It happens.', group: 'frogging', goal: 1, points: 5, measure: (a) => a.totals.projectsFrogged },
  { id: 'frog-5', name: 'No regrets', description: 'Frog five projects.', group: 'frogging', goal: 5, points: 25, measure: (a) => a.totals.projectsFrogged },
];

export const GROUP_LABELS: Record<AwardGroup, string> = {
  streak: 'Keeping at it',
  volume: 'Stitches',
  time: 'Time on the needles',
  finishing: 'Finishing',
  range: 'Range',
  devotion: 'Favourites',
  making: 'Your library',
  frogging: 'Frogging',
};

export type AwardProgress = {
  award: Award;
  at: number;
  earned: boolean;
  // 0–1, for a progress bar.
  fraction: number;
  label: string; // "4,200 of 10,000"
};

export function awardProgress(award: Award, a: Achievements): AwardProgress {
  const at = award.measure(a);
  const format = award.format ?? ((n: number) => String(Math.floor(n)));
  return {
    award,
    at,
    earned: at >= award.goal,
    fraction: award.goal > 0 ? Math.min(1, at / award.goal) : 0,
    label: `${format(Math.min(at, award.goal))} of ${format(award.goal)}`,
  };
}

export function allProgress(a: Achievements): AwardProgress[] {
  return AWARDS.map((award) => awardProgress(award, a));
}

// The one to put on the Home screen: closest to done, among those not yet earned. Ties break
// toward the cheaper award, so a knitter is pointed at something reachable rather than at a
// hundred-day streak they happen to be 2% into.
export function nextAward(a: Achievements): AwardProgress | null {
  const open = allProgress(a).filter((p) => !p.earned);
  if (open.length === 0) return null;
  return open.reduce((best, p) =>
    p.fraction > best.fraction || (p.fraction === best.fraction && p.award.points < best.award.points)
      ? p
      : best,
  );
}

export function earnedPoints(a: Achievements): number {
  return allProgress(a).reduce((n, p) => (p.earned ? n + p.award.points : n), 0);
}

// Each level costs 10 points more than the one before: 10, 30, 60, 100, 150…  The nth level sits
// at 5n(n−1), so the curve never needs a hand-maintained table and adding an award later can move
// someone up retroactively — which is the right way round.
export function pointsForLevel(level: number): number {
  return level <= 1 ? 0 : 5 * level * (level - 1);
}

export type LevelStanding = {
  level: number;
  points: number;
  into: number; // points earned within the current level
  needed: number; // points the current level spans
  toNext: number;
};

export function levelFor(points: number): LevelStanding {
  let level = 1;
  while (pointsForLevel(level + 1) <= points) level += 1;
  const floor = pointsForLevel(level);
  const ceiling = pointsForLevel(level + 1);
  return {
    level,
    points,
    into: points - floor,
    needed: ceiling - floor,
    toNext: ceiling - points,
  };
}

export function standing(a: Achievements): LevelStanding {
  return levelFor(earnedPoints(a));
}
