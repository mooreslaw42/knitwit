import {
  currentStreak,
  emptyAchievements,
  knittedToday,
  localDate,
  longestStreak,
  recordActivity,
  stitchesForRow,
} from '@/lib/achievements';
import { awardProgress, AWARDS, levelFor, nextAward, pointsForLevel, standing } from '@/lib/awards';
import type { Achievements } from '@/types/knitwit';

const on = (a: Achievements, date: string, rows = 1) => recordActivity(a, { rows }, date);

describe('recordActivity', () => {
  it('merges into the same day rather than adding a second entry', () => {
    let a = recordActivity(emptyAchievements(), { rows: 3, stitches: 90 }, '2026-09-13');
    a = recordActivity(a, { rows: 2, stitches: 60 }, '2026-09-13');
    expect(a.days).toHaveLength(1);
    expect(a.days[0]).toMatchObject({ rows: 5, stitches: 150 });
  });

  it('keeps lifetime totals alongside the daily log', () => {
    let a = recordActivity(emptyAchievements(), { rows: 3, stitches: 90 }, '2026-09-12');
    a = recordActivity(a, { rows: 2, stitches: 60 }, '2026-09-13');
    expect(a.totals.rows).toBe(5);
    expect(a.totals.stitches).toBe(150);
  });

  it('ignores an empty record rather than creating a day with nothing in it', () => {
    expect(recordActivity(emptyAchievements(), {}, '2026-09-13').days).toEqual([]);
  });

  it('never records a negative', () => {
    const a = recordActivity(emptyAchievements(), { rows: -5, stitches: -20 }, '2026-09-13');
    expect(a.totals.rows).toBe(0);
  });
});

describe('currentStreak', () => {
  it('counts consecutive days up to today', () => {
    let a = emptyAchievements();
    for (const d of ['2026-09-11', '2026-09-12', '2026-09-13']) a = on(a, d);
    expect(currentStreak(a, '2026-09-13')).toBe(3);
  });

  // A knitter part-way through today hasn't broken anything. Telling them at 9am that their
  // streak is over would be both wrong and unkind.
  it('holds when yesterday counted but today has not happened yet', () => {
    let a = emptyAchievements();
    for (const d of ['2026-09-11', '2026-09-12']) a = on(a, d);
    expect(currentStreak(a, '2026-09-13')).toBe(2);
    expect(knittedToday(a, '2026-09-13')).toBe(false);
  });

  it('is broken by a missed day', () => {
    let a = emptyAchievements();
    for (const d of ['2026-09-09', '2026-09-11', '2026-09-12']) a = on(a, d);
    expect(currentStreak(a, '2026-09-12')).toBe(2);
  });

  it('is zero when nothing has been knitted for two days', () => {
    const a = on(emptyAchievements(), '2026-09-10');
    expect(currentStreak(a, '2026-09-13')).toBe(0);
  });

  // Date arithmetic done on strings would fall apart here; done on Date objects it holds.
  it('crosses a month boundary', () => {
    let a = emptyAchievements();
    for (const d of ['2026-08-30', '2026-08-31', '2026-09-01']) a = on(a, d);
    expect(currentStreak(a, '2026-09-01')).toBe(3);
  });

  it('crosses a leap day', () => {
    let a = emptyAchievements();
    for (const d of ['2028-02-28', '2028-02-29', '2028-03-01']) a = on(a, d);
    expect(currentStreak(a, '2028-03-01')).toBe(3);
  });

  // The clock shifts on this date in Europe; the calendar does not.
  it('crosses a daylight-saving change', () => {
    let a = emptyAchievements();
    for (const d of ['2026-03-28', '2026-03-29', '2026-03-30']) a = on(a, d);
    expect(currentStreak(a, '2026-03-30')).toBe(3);
  });

  it('ignores a day that logged only time, since the streak is about knitting', () => {
    let a = on(emptyAchievements(), '2026-09-12');
    a = recordActivity(a, { seconds: 600 }, '2026-09-13');
    expect(currentStreak(a, '2026-09-13')).toBe(1);
  });
});

describe('longestStreak', () => {
  it('finds the best run, not the current one', () => {
    let a = emptyAchievements();
    for (const d of ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04']) a = on(a, d);
    for (const d of ['2026-09-12', '2026-09-13']) a = on(a, d);
    expect(longestStreak(a)).toBe(4);
    expect(currentStreak(a, '2026-09-13')).toBe(2);
  });

  it('is zero with nothing recorded', () => {
    expect(longestStreak(emptyAchievements())).toBe(0);
  });
});

describe('stitchesForRow', () => {
  const knit = { id: 'g', type: 'knit', span: 'all' as const, count: null, materialSlot: null, note: '' };
  const row = (id: string) => ({ id, label: id, side: 'RS' as const, marker: false, instruction: '', stitches: [knit] });

  it('is exact for a charted section', () => {
    expect(stitchesForRow({ rows: [row('a'), row('b')], castOn: 88 }, 1)).toBe(88);
  });

  it('falls back to the cast-on when there is no chart', () => {
    expect(stitchesForRow({ rows: [], castOn: 60 }, 12)).toBe(60);
  });

  // An improvised project has neither — the row still counts, the stitches honestly don't.
  it('is zero when there is nothing to go on', () => {
    expect(stitchesForRow({ rows: [], castOn: 0 }, 4)).toBe(0);
  });
});

describe('awards', () => {
  it('gives every award a unique id', () => {
    const ids = AWARDS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('reads progress as a fraction and a label', () => {
    const a = recordActivity(emptyAchievements(), { rows: 1, stitches: 4200 }, '2026-09-13');
    const p = awardProgress(AWARDS.find((x) => x.id === 'stitches-10k')!, a);
    expect(p.earned).toBe(false);
    expect(p.fraction).toBeCloseTo(0.42, 5);
    expect(p.label).toBe('4,200 of 10,000');
  });

  it('caps a label at the goal rather than reading past it', () => {
    const a = recordActivity(emptyAchievements(), { rows: 1, stitches: 50000 }, '2026-09-13');
    expect(awardProgress(AWARDS.find((x) => x.id === 'stitches-10k')!, a).label).toBe(
      '10,000 of 10,000',
    );
  });

  it('earns nothing from an empty record', () => {
    expect(nextAward(emptyAchievements())?.earned).toBe(false);
    expect(standing(emptyAchievements()).level).toBe(1);
  });

  // Pointing a knitter at a hundred-day streak they're 2% into would be useless; the nearest
  // reachable thing is the point of the Home stat.
  it('picks the closest unearned award', () => {
    let a = recordActivity(emptyAchievements(), { rows: 1, stitches: 900 }, '2026-09-13');
    a = { ...a, totals: { ...a.totals, patternsCreated: 0 } };
    expect(nextAward(a)?.award.id).toBe('stitches-1k');
  });

  it('stops offering an award once it is earned', () => {
    const a = { ...emptyAchievements(), totals: { ...emptyAchievements().totals, patternsCreated: 1 } };
    expect(awardProgress(AWARDS.find((x) => x.id === 'pattern-1')!, a).earned).toBe(true);
    expect(nextAward(a)?.award.id).not.toBe('pattern-1');
  });
});

describe('levels', () => {
  it('costs ten more points per level than the one before', () => {
    expect([1, 2, 3, 4, 5, 6].map(pointsForLevel)).toEqual([0, 10, 30, 60, 100, 150]);
  });

  it('places a knitter in the right band', () => {
    expect(levelFor(0).level).toBe(1);
    expect(levelFor(9).level).toBe(1);
    expect(levelFor(10).level).toBe(2);
    expect(levelFor(29).level).toBe(2);
    expect(levelFor(30).level).toBe(3);
  });

  it('reports how far into the level and how far to the next', () => {
    const at = levelFor(45);
    expect(at).toMatchObject({ level: 3, into: 15, needed: 30, toNext: 15 });
  });

  it('rises as awards are earned', () => {
    const base = emptyAchievements();
    const some = {
      ...base,
      totals: { ...base.totals, patternsCreated: 5, techniquesAdded: 1, projectsFinished: 1 },
    };
    expect(standing(some).level).toBeGreaterThan(standing(base).level);
  });
});

describe('localDate', () => {
  it('uses the local calendar day, not UTC', () => {
    // 00:30 local on the 13th is still the 12th in UTC; the knitter's day is what matters.
    expect(localDate(new Date(2026, 8, 13, 0, 30))).toBe('2026-09-13');
    expect(localDate(new Date(2026, 8, 13, 23, 30))).toBe('2026-09-13');
  });
});

describe('craft awards', () => {
  const withCraft = (finishedByCraft: Achievements['finishedByCraft']) => ({
    ...emptyAchievements(),
    finishedByCraft,
  });
  const find = (id: string) => AWARDS.find((x) => x.id === id)!;

  it('awards the craft you actually finished something in', () => {
    const a = withCraft({ crochet: 1 });
    expect(awardProgress(find('craft-crochet'), a).earned).toBe(true);
    expect(awardProgress(find('craft-knit'), a).earned).toBe(false);
  });

  // A piece that is both is genuinely both, so it counts toward each rather than neither.
  it('counts a both-craft project toward knitting and crochet alike', () => {
    const a = withCraft({ both: 1 });
    expect(awardProgress(find('craft-knit'), a).earned).toBe(true);
    expect(awardProgress(find('craft-crochet'), a).earned).toBe(true);
    expect(awardProgress(find('craft-both'), a).earned).toBe(true);
  });

  it('needs one of each for Two hands, not two of one', () => {
    expect(awardProgress(find('craft-both'), withCraft({ knit: 5 })).earned).toBe(false);
    expect(awardProgress(find('craft-both'), withCraft({ knit: 1, crochet: 1 })).earned).toBe(true);
  });
});
