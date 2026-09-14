import { CATEGORY_LABELS, CATEGORY_ORDER } from '@/constants/catalogs';
import { bandsWorked, currentStreak, daysInBand, longestStreak } from '@/lib/achievements';
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
  | 'frogging'
  | 'clock';

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

// The most parts of one day the knitter has ever spread a single day's knitting across.
const mostBandsInOneDay = (a: Achievements) =>
  a.days.reduce((best, d) => Math.max(best, Object.values(d.bands ?? {}).filter((n) => n > 0).length), 0);

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
  // Craft, rather than craft × category: a "crocheted scarf" award for every combination would be
  // sixty badges nobody reads. A piece marked 'both' counts toward each, since it is each.
  {
    id: 'craft-knit',
    name: 'Knitter',
    description: 'Finish something knitted.',
    group: 'range',
    goal: 1,
    points: 5,
    measure: (a) => (a.finishedByCraft.knit ?? 0) + (a.finishedByCraft.both ?? 0),
  },
  {
    id: 'craft-crochet',
    name: 'Hooked',
    description: 'Finish something crocheted.',
    group: 'range',
    goal: 1,
    points: 5,
    measure: (a) => (a.finishedByCraft.crochet ?? 0) + (a.finishedByCraft.both ?? 0),
  },
  {
    id: 'craft-both',
    name: 'Two hands',
    description: 'Finish something knitted and something crocheted.',
    group: 'range',
    goal: 2,
    points: 25,
    measure: (a) =>
      (((a.finishedByCraft.knit ?? 0) + (a.finishedByCraft.both ?? 0) > 0 ? 1 : 0) +
        ((a.finishedByCraft.crochet ?? 0) + (a.finishedByCraft.both ?? 0) > 0 ? 1 : 0)),
  },
  // A fixed six rather than "every category". It used to be CATEGORY_ORDER.length, which was fine
  // at ten and absurd at twenty-one — and it counted Queue and Swatch, neither of which is a thing
  // you finish. An award nobody can reach isn't an award.
  {
    id: 'range-all',
    name: 'A bit of everything',
    description: 'Finish a project in six different categories.',
    group: 'range',
    goal: 6,
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

  // When you knit, rather than how much. Counted in days, not rows: "an early bird five times"
  // means five mornings, not five rows before breakfast on one of them.
  //
  // Only rows count towards these, never banked time — a timer left running overnight would
  // otherwise hand out Night owl to someone who was asleep.
  { id: 'dawn-1', name: 'Early bird', description: 'Knit before 8am.', group: 'clock', goal: 1, points: 5, measure: (a) => daysInBand(a, 'dawn') },
  { id: 'dawn-5', name: 'Up with the lark', description: 'Knit before 8am on five days.', group: 'clock', goal: 5, points: 10, measure: (a) => daysInBand(a, 'dawn') },
  { id: 'dawn-25', name: 'Dawn patrol', description: 'Knit before 8am on twenty-five days.', group: 'clock', goal: 25, points: 25, measure: (a) => daysInBand(a, 'dawn') },

  { id: 'night-1', name: 'Night owl', description: 'Knit between midnight and 5am.', group: 'clock', goal: 1, points: 5, measure: (a) => daysInBand(a, 'night') },
  { id: 'night-5', name: 'Burning the midnight oil', description: 'Knit in the small hours on five days.', group: 'clock', goal: 5, points: 10, measure: (a) => daysInBand(a, 'night') },
  { id: 'night-25', name: 'Nocturnal', description: 'Knit in the small hours on twenty-five days.', group: 'clock', goal: 25, points: 25, measure: (a) => daysInBand(a, 'night') },

  { id: 'evening-25', name: 'Wind-down', description: 'Knit in the evening on twenty-five days.', group: 'clock', goal: 25, points: 10, measure: (a) => daysInBand(a, 'evening') },
  { id: 'clock-all', name: 'Round the clock', description: 'Knit in the small hours, before 8am, in the day and in the evening.', group: 'clock', goal: 4, points: 25, measure: bandsWorked },

  // One sitting that runs from one part of the day into the next — the sleeve that was going to
  // be "just one more row".
  { id: 'clock-3-in-a-day', name: 'Lost track of time', description: 'Knit in three different parts of one day.', group: 'clock', goal: 3, points: 25, measure: mostBandsInOneDay },
];

// The order the groups read in. Lives next to the labels rather than in the screen, because the
// two are the same kind of fact and keeping them apart is how a whole group of awards came to be
// invisible: the screen had its own list and adding 'clock' to the type didn't add it there.
// A test asserts this covers every group.
export const GROUP_ORDER: AwardGroup[] = [
  'streak',
  'finishing',
  'volume',
  'time',
  'clock',
  'range',
  'devotion',
  'making',
  'frogging',
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
  clock: 'Hours kept',
};

export type AwardProgress = {
  award: Award;
  at: number;
  earned: boolean;
  // 0–1, for a progress bar.
  fraction: number;
  label: string; // "4,200 of 10,000", for reading in a sentence
  fractionLabel: string; // "4,200 / 10,000", for a stat tile
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
    fractionLabel: `${format(Math.min(at, award.goal))} / ${format(award.goal)}`,
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
