import {
  describeIntervals,
  detectShapingRuns,
  distributeShaping,
  rescaleRun,
  rescaleSection,
} from '@/lib/regauge';
import type { PatternRow, PatternStitchGroup } from '@/types/knitwit';

let n = 0;
const g = (type: string, span: PatternStitchGroup['span'], count: number | null): PatternStitchGroup => ({
  id: `g${n++}`,
  type,
  span,
  count,
  materialSlot: null,
  note: '',
});

const row = (label: string, stitches: PatternStitchGroup[]): PatternRow => ({
  id: `r${n++}`,
  label,
  side: 'RS',
  marker: false,
  instruction: '',
  stitches,
});

// "K1, M1L, knit to last st, M1R, K1" — the standard two-stitch increase row.
const incRow = () =>
  row('inc', [g('knit', 'exact', 1), g('m1l', 'exact', 1), g('knit', 'to-last', 1), g('m1r', 'exact', 1), g('knit', 'exact', 1)]);
const plainRow = () => row('plain', [g('knit', 'all', null)]);
const decRow = () =>
  row('dec', [g('knit', 'exact', 1), g('k2tog', 'exact', 1), g('knit', 'to-last', 3), g('ssk', 'exact', 1), g('knit', 'exact', 1)]);

describe('detectShapingRuns', () => {
  // Nobody describes the shaping to the app — the chart already knows which rows move the count.
  it('finds a run of increases without being told where it is', () => {
    const rows = [plainRow(), incRow(), plainRow(), incRow(), plainRow(), incRow(), plainRow()];
    const runs = detectShapingRuns(rows, 30);
    expect(runs).toHaveLength(1);
    expect(runs[0].shapingRows).toEqual([1, 3, 5]);
    expect(runs[0].delta).toBe(2);
    expect(runs[0].before).toBe(30);
    expect(runs[0].after).toBe(36);
  });

  it('spans from the first shaping row to the last, ignoring plain rows either side', () => {
    const rows = [plainRow(), plainRow(), incRow(), plainRow(), incRow(), plainRow(), plainRow()];
    const runs = detectShapingRuns(rows, 30);
    expect(runs[0].from).toBe(2);
    expect(runs[0].to).toBe(4);
    expect(runs[0].rows).toBe(3);
  });

  it('splits when the shaping changes direction', () => {
    const rows = [incRow(), plainRow(), incRow(), plainRow(), decRow(), plainRow(), decRow()];
    const runs = detectShapingRuns(rows, 30);
    expect(runs).toHaveLength(2);
    expect(runs[0].delta).toBe(2);
    expect(runs[1].delta).toBe(-2);
  });

  it('finds nothing in a section that never shapes', () => {
    expect(detectShapingRuns([plainRow(), plainRow()], 30)).toEqual([]);
  });
});

describe('distributeShaping', () => {
  // The point of two frequencies: 28 rows and 7 shapings divides, but 28 and 8 doesn't.
  it('uses a single interval when the rows divide evenly', () => {
    expect(distributeShaping(28, 7)).toEqual([{ every: 4, times: 7 }]);
  });

  it('mixes two intervals when they don’t, the way a pattern prints it', () => {
    expect(distributeShaping(28, 8)).toEqual([
      { every: 4, times: 4 },
      { every: 3, times: 4 },
    ]);
  });

  it('always accounts for exactly the rows and shapings it was given', () => {
    for (const [rows, count] of [
      [28, 8],
      [30, 7],
      [61, 13],
      [100, 3],
      [17, 16],
    ]) {
      const intervals = distributeShaping(rows, count);
      expect(intervals.reduce((n, i) => n + i.times, 0)).toBe(count);
      expect(intervals.reduce((n, i) => n + i.every * i.times, 0)).toBe(rows);
    }
  });

  it('has nothing to spread when there is no shaping', () => {
    expect(distributeShaping(20, 0)).toEqual([]);
  });
});

describe('describeIntervals', () => {
  it('reads the way a pattern would print it', () => {
    expect(describeIntervals([{ every: 4, times: 7 }], 2)).toBe('increase every 4th row 7 times');
    expect(
      describeIntervals(
        [
          { every: 4, times: 3 },
          { every: 3, times: 5 },
        ],
        -2,
      ),
    ).toBe('decrease every 4th row 3 times, then every 3rd row 5 times');
  });

  it('gets its ordinals right', () => {
    expect(describeIntervals([{ every: 1, times: 1 }], 2)).toContain('1st');
    expect(describeIntervals([{ every: 2, times: 1 }], 2)).toContain('2nd');
    expect(describeIntervals([{ every: 3, times: 1 }], 2)).toContain('3rd');
    expect(describeIntervals([{ every: 11, times: 1 }], 2)).toContain('11th');
    expect(describeIntervals([{ every: 21, times: 1 }], 2)).toContain('21st');
  });
});

describe('rescaleRun', () => {
  const run = {
    from: 0,
    to: 27,
    rows: 28,
    shapingRows: [0, 4, 8, 12, 16, 20, 24],
    delta: 2,
    before: 30,
    after: 44,
  };

  it('keeps both ends of the run in proportion', () => {
    // ×0.6: 30 → 18, 44 → 26. Eight stitches apart, so four 2-stitch increases reach it exactly.
    const out = rescaleRun(run, 0.6);
    expect(out.before).toBe(18);
    expect(out.after).toBe(26);
    expect(out.issues).toEqual([]);
  });

  it('recomputes how many shaping rows are needed, not just their spacing', () => {
    // Seven increases in the original; four at this gauge. Scaling the spacing alone would have
    // kept seven and overshot the width by six stitches.
    expect(rescaleRun(run, 0.6).shapingRows).toBe(4);
    expect(run.shapingRows).toHaveLength(7);
  });

  // A two-stitch increase can only ever reach counts of the same parity as where it started, so a
  // rounded end is often simply unreachable. Moving it is right; moving it silently is not.
  it('moves an end that whole shaping steps cannot reach, and says so', () => {
    // ×0.9: 30 → 27, 44 → 40. From an odd 27 in steps of 2, 40 can never be hit.
    const out = rescaleRun(run, 0.9);
    expect(out.before).toBe(27);
    expect(out.after).toBe(41);
    expect(out.shapingRows).toBe(7);
    expect(out.issues.join(' ')).toContain("isn't reachable");
  });

  it('keeps the run the same length, since rows are not rescaled', () => {
    const out = rescaleRun(run, 0.9);
    expect(out.intervals.reduce((n, i) => n + i.every * i.times, 0)).toBe(28);
  });

  it('arrives exactly where it says it will', () => {
    const out = rescaleRun(run, 0.8);
    const worked = out.intervals.reduce((n, i) => n + i.times, 0);
    expect(out.before + worked * run.delta).toBe(out.after);
    // No reconciliation complaint means the distribution agrees with the arithmetic.
    expect(out.issues.filter((i) => i.includes("doesn't reconcile"))).toEqual([]);
  });

  it('leaves a run untouched when the gauges match', () => {
    const out = rescaleRun(run, 1);
    expect(out.before).toBe(30);
    expect(out.after).toBe(44);
    expect(out.shapingRows).toBe(7);
    expect(out.issues).toEqual([]);
  });

  it('says so when the shaping no longer fits in the rows it has', () => {
    const tight = { ...run, rows: 3, to: 2, shapingRows: [0, 1, 2] };
    const out = rescaleRun(tight, 1);
    expect(out.issues.join(' ')).toContain("won't fit");
  });

  it('handles a decreasing run', () => {
    const dec = { ...run, delta: -2, before: 44, after: 30 };
    const out = rescaleRun(dec, 0.5);
    expect(out.before).toBe(22);
    // 15 would be the direct scaling, but it's unreachable from an even 22 in 2-stitch steps.
    expect(out.after).toBe(14);
    // Still arrives where it claims, in whole steps.
    const worked = out.intervals.reduce((n, i) => n + i.times, 0);
    expect(out.before - worked * 2).toBe(out.after);
  });
});

describe('rescaleSection', () => {
  const rows = [plainRow(), incRow(), plainRow(), incRow(), plainRow(), incRow(), plainRow()];

  it('rescales the cast-on and follows the shaping through to the end', () => {
    // 30 sts, three 2-stitch increases → 36. At ×0.6: cast on 18, and 22 at the end.
    const out = rescaleSection(rows, 30, 0.6);
    expect(out.castOn).toEqual({ from: 30, to: 18 });
    expect(out.finalStitches.from).toBe(36);
    expect(out.finalStitches.to).toBe(22);
  });

  // The final count follows the rescaled run, not a direct scaling of the original — because the
  // run is what the knitter actually works, and its ends have been moved to reachable numbers.
  it('reports the end the shaping really arrives at, not the one scaling suggests', () => {
    const out = rescaleSection(rows, 30, 0.5);
    expect(out.castOn.to).toBe(15);
    expect(out.finalStitches.to).toBe(19);
    expect(Math.round(36 * 0.5)).toBe(18);
  });

  it('honours a stitch multiple on the cast-on', () => {
    const out = rescaleSection(rows, 30, 0.9, { of: 4, plus: 2 });
    expect(out.castOn.to % 4).toBe(2);
  });

  it('changes nothing when the gauges match', () => {
    const out = rescaleSection(rows, 30, 1);
    expect(out.castOn).toEqual({ from: 30, to: 30 });
    expect(out.finalStitches).toEqual({ from: 36, to: 36 });
    expect(out.issues).toEqual([]);
  });

  it('handles a section with no shaping at all', () => {
    const out = rescaleSection([plainRow(), plainRow()], 40, 0.75);
    expect(out.castOn.to).toBe(30);
    expect(out.finalStitches.to).toBe(30);
    expect(out.runs).toEqual([]);
  });
});
