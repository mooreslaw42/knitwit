import { mergeMonotonic } from '@/lib/sync/monotonic';

// Awards count rather than describe, and the type says of itself that nothing here ever decreases.
// Everything below is about that one promise.

describe('merging things that only count upwards', () => {
  it('takes whatever arrived when there is nothing here yet', () => {
    expect(mergeMonotonic(undefined, { rows: 10 })).toEqual({ rows: 10 });
  });

  // The failure last-write-wins produces: a device shut for a week pushes its stale total and the
  // knitter watches their rows count go backwards.
  it('never lets a count go backwards', () => {
    expect(mergeMonotonic({ rows: 500 }, { rows: 120 })).toEqual({ rows: 500 });
  });

  it('takes the larger either way round', () => {
    expect(mergeMonotonic({ rows: 120 }, { rows: 500 })).toEqual({ rows: 500 });
  });

  it('goes all the way down', () => {
    const local = { totals: { rows: 500, stitches: 100, seconds: 30 }, byCraft: { knit: 3 } };
    const incoming = { totals: { rows: 120, stitches: 900, seconds: 30 }, byCraft: { knit: 1 } };
    expect(mergeMonotonic(local, incoming)).toEqual({
      totals: { rows: 500, stitches: 900, seconds: 30 },
      byCraft: { knit: 3 },
    });
  });

  it('keeps a key only one side has', () => {
    expect(mergeMonotonic({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
  });

  // A renamed award or a changed unit is a description, not a count.
  it('lets the arriving value win for anything that is not a number', () => {
    expect(mergeMonotonic({ unit: 'cm' }, { unit: 'inch' })).toEqual({ unit: 'inch' });
  });
});

describe('merging the days a knitter knitted', () => {
  const day = (date: string, rows: number) => ({ date, rows, stitches: 0, seconds: 0 });

  // Paired by date, never by position: one device having a day the other does not would otherwise
  // line Tuesday up against Wednesday and take the larger of two unrelated things.
  it('pairs days by their date rather than their place in the list', () => {
    const local = { days: [day('2026-09-14', 40), day('2026-09-16', 10)] };
    const incoming = { days: [day('2026-09-15', 70), day('2026-09-16', 25)] };

    const merged = mergeMonotonic(local, incoming) as { days: { date: string; rows: number }[] };

    expect(merged.days.map((d) => d.date)).toEqual(['2026-09-14', '2026-09-15', '2026-09-16']);
    expect(merged.days.find((d) => d.date === '2026-09-14')?.rows).toBe(40);
    expect(merged.days.find((d) => d.date === '2026-09-16')?.rows).toBe(25);
  });

  // Two devices that merged the same days in a different order must hold the same list, or the
  // watcher sees a change that is not one and marks it dirty for ever.
  it('always ends in the same order', () => {
    const a = mergeMonotonic({ days: [day('2026-01-02', 1)] }, { days: [day('2026-01-01', 1)] });
    const b = mergeMonotonic({ days: [day('2026-01-01', 1)] }, { days: [day('2026-01-02', 1)] });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  // Documented, not hidden: fifty rows on a phone and thirty on a laptop with no sync between is
  // fifty, because two numbers cannot tell shared history from new work.
  it('takes the larger rather than the sum, as designed', () => {
    const merged = mergeMonotonic({ days: [day('2026-09-16', 50)] }, { days: [day('2026-09-16', 30)] });
    expect((merged as { days: { rows: number }[] }).days[0].rows).toBe(50);
  });
});
