import { rescaleStitches, roundToMultiple, type StitchMultiple } from '@/lib/gauge';
import { rowStitchesAfter, sectionRowCounts } from '@/lib/knitwit-helpers';
import type { PatternRow, StitchSide } from '@/types/knitwit';

// Re-gauging a section: what its numbers become when the knitter's fabric isn't the pattern's.
//
// Two things make this tractable rather than guesswork, and both already existed. Shaping is
// *detected* from the chart — a row whose running stitch count differs from the one before it is
// a shaping row, and the difference is how much it shapes — so nobody has to describe the shaping
// by hand. And the running count itself is the check: a rescale that doesn't arrive at the number
// it was aiming for says so.
//
// Rows are never scaled, only stitches. Row gauge varies with blocking and with how the knitter
// measures, and patterns routinely say "work to 40cm" rather than trusting a row count. So a run
// keeps its length and the shaping is redistributed within it.

// A stretch of the section where the stitch count is moving: "increase every 4th row, 7 times".
export type ShapingRun = {
  from: number; // first row index of the run
  to: number; // last row index that shapes (inclusive)
  rows: number; // rows spanned, from the first shaping row to the last
  shapingRows: number[]; // indices of the rows that actually shape
  delta: number; // stitches gained or lost per shaping row, e.g. +2
  before: number; // live stitches entering the run
  after: number; // live stitches leaving it
};

// "every 4th row 3 times, then every 5th row 5 times" — two frequencies, which is how a pattern
// would have printed it and how a knitter expects to read it.
export type Interval = { every: number; times: number };

export type RescaledRun = {
  run: ShapingRun;
  before: number; // rescaled stitch count entering
  after: number; // rescaled count leaving
  shapingRows: number; // how many shaping rows are needed now
  intervals: Interval[];
  // Populated when the arithmetic wouldn't come out — the run is still described, but the knitter
  // is told what didn't work rather than handed a number that doesn't knit.
  issues: string[];
};

// Which rows change the stitch count, and by how much.
function rowDeltas(rows: PatternRow[], castOn: number, sizeIndex: number): number[] {
  const before = sectionRowCounts(rows, castOn, sizeIndex);
  return rows.map((row, i) => rowStitchesAfter(row, before[i], sizeIndex) - before[i]);
}

// Group the shaping rows into runs. A run continues while the shaping keeps going the same way by
// the same amount; a change of direction or of step starts a new one, because "increase every 4th
// row" and "decrease every 6th row" are different instructions even when they abut.
export function detectShapingRuns(
  rows: PatternRow[],
  castOn: number,
  sizeIndex = 0,
): ShapingRun[] {
  const before = sectionRowCounts(rows, castOn, sizeIndex);
  const deltas = rowDeltas(rows, castOn, sizeIndex);
  const runs: ShapingRun[] = [];

  let current: ShapingRun | null = null;
  for (let i = 0; i < rows.length; i++) {
    const delta = deltas[i];
    if (delta === 0) continue;

    if (current && current.delta === delta) {
      current.to = i;
      current.shapingRows.push(i);
      current.after = before[i] + delta;
      current.rows = current.to - current.from + 1;
      continue;
    }

    if (current) runs.push(current);
    current = {
      from: i,
      to: i,
      rows: 1,
      shapingRows: [i],
      delta,
      before: before[i],
      after: before[i] + delta,
    };
  }
  if (current) runs.push(current);
  return runs;
}

// Spread `count` shaping rows as evenly as possible across `rows` rows. There is rarely a single
// interval that divides, so this returns the two that do — which is exactly what a pattern prints
// when it says "every 4th row 3 times, then every 5th row 5 times".
export function distributeShaping(rows: number, count: number): Interval[] {
  if (count <= 0) return [];
  if (rows <= count) return [{ every: 1, times: count }];
  const q = Math.floor(rows / count);
  const r = rows % count;
  // The longer intervals go first: a pattern shapes more gently at the start of a run, and it
  // reads better than trailing them.
  return [
    { every: q + 1, times: r },
    { every: q, times: count - r },
  ].filter((i) => i.times > 0);
}

export function describeIntervals(intervals: Interval[], delta: number): string {
  const verb = delta > 0 ? 'increase' : 'decrease';
  if (intervals.length === 0) return `no ${verb}s`;
  const parts = intervals.map(
    (i) => `every ${ordinal(i.every)} row ${i.times} ${i.times === 1 ? 'time' : 'times'}`,
  );
  return `${verb} ${parts.join(', then ')}`;
}

function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

// Re-gauge one shaping run. Both ends are rescaled and rounded, then the shaping is recomputed to
// get from one to the other — which is the part a naive implementation gets wrong by scaling the
// frequency and the count independently until they stop agreeing.
export function rescaleRun(
  run: ShapingRun,
  ratio: number,
  multiple?: StitchMultiple | null,
): RescaledRun {
  const issues: string[] = [];
  const before = rescaleStitches(run.before, ratio, multiple).rounded;
  let after = rescaleStitches(run.after, ratio, multiple).rounded;

  const step = Math.abs(run.delta);
  let shapingRows = Math.abs(after - before) / step;

  // The two rounded ends have to be reachable in whole shaping rows. When they aren't, move the
  // far end to the nearest count that is — the alternative is a run that can't be worked.
  if (!Number.isInteger(shapingRows)) {
    const rounded = Math.round(shapingRows);
    const adjusted = before + Math.sign(run.delta) * rounded * step;
    issues.push(
      `${after} sts isn't reachable in whole ${step === 1 ? 'stitches' : `${step}-stitch steps`} from ${before} — using ${adjusted}.`,
    );
    after = adjusted;
    shapingRows = rounded;
  }

  // A multiple can pull the ends apart in a way that leaves nothing to do, or asks for more
  // shaping rows than the run has room for.
  if (shapingRows === 0 && run.shapingRows.length > 0) {
    issues.push('At your gauge this run has no shaping left to do.');
  }
  if (shapingRows > run.rows) {
    issues.push(
      `${shapingRows} shaping rows won't fit in ${run.rows} rows — work them closer together or lengthen the run.`,
    );
  }

  const intervals = distributeShaping(run.rows, shapingRows);

  // The check that makes the rest trustworthy: the intervals must actually land on the number we
  // aimed at. Cheap to verify, and it catches a mistake in the distribution rather than trusting
  // the arithmetic above.
  const worked = intervals.reduce((n, i) => n + i.times, 0);
  const arrivesAt = before + Math.sign(run.delta) * worked * step;
  if (worked !== shapingRows || arrivesAt !== after) {
    issues.push(`Rescale doesn't reconcile: ${worked} shaping rows reach ${arrivesAt}, not ${after}.`);
  }

  return { run, before, after, shapingRows, intervals, issues };
}

export type RescaledSection = {
  castOn: { from: number; to: number };
  finalStitches: { from: number; to: number };
  runs: RescaledRun[];
  issues: string[];
};

// The whole section at the knitter's gauge: what to cast on, how the shaping changes, and where
// it ends up.
export function rescaleSection(
  rows: PatternRow[],
  castOn: number,
  ratio: number,
  multiple?: StitchMultiple | null,
  sizeIndex = 0,
): RescaledSection {
  const runs = detectShapingRuns(rows, castOn, sizeIndex).map((run) =>
    rescaleRun(run, ratio, multiple),
  );
  const before = sectionRowCounts(rows, castOn, sizeIndex);
  const originalFinal =
    rows.length > 0 ? rowStitchesAfter(rows[rows.length - 1], before[rows.length - 1], sizeIndex) : castOn;

  const newCastOn = roundToMultiple(castOn * ratio, multiple);
  // Follow the rescaled runs through from the new cast-on rather than scaling the final count
  // directly — the run-by-run arithmetic is what the knitter will actually work.
  const newFinal = runs.reduce((n, r) => n + (r.after - r.before), newCastOn);

  return {
    castOn: { from: castOn, to: newCastOn },
    finalStitches: { from: originalFinal, to: newFinal },
    runs,
    issues: runs.flatMap((r) => r.issues),
  };
}

export type RegaugedSection = {
  castOn: number;
  rows: PatternRow[];
  // False when the rebuild couldn't be trusted and the pattern's own chart was kept instead.
  applied: boolean;
  issues: string[];
};

const cloneRow = (row: PatternRow, side: StitchSide, seq: number): PatternRow => ({
  ...row,
  id: `rg${seq}`,
  side,
  // Markers belong to rows the knitter set them on; a rebuilt row is not that row.
  marker: false,
  stitches: row.stitches.map((g, i) => ({ ...g, id: `rg${seq}-${i}` })),
});

// Rebuild a section's chart at the knitter's gauge.
//
// The cast-on alone isn't enough. Most groups are span-based — "knit to last 1" absorbs a
// different stitch count on its own — but the *number* of shaping rows has to change too, or the
// running count arrives somewhere the pattern never intended. So the shaping rows are laid out
// again at their new spacing, using the section's own rows as templates rather than inventing any.
//
// The result is checked before it's returned. If the rebuilt chart doesn't reconcile to the count
// the rescale aimed at, the pattern's chart is kept and the caller is told — a project that
// silently disagrees with itself is worse than one that hasn't been re-gauged.
export function regaugeSectionRows(
  rows: PatternRow[],
  castOn: number,
  ratio: number,
  multiple?: StitchMultiple | null,
  sizeIndex = 0,
): RegaugedSection {
  const plan = rescaleSection(rows, castOn, ratio, multiple, sizeIndex);
  const keep = (issues: string[]): RegaugedSection => ({
    castOn: plan.castOn.to,
    rows,
    applied: false,
    issues,
  });

  if (plan.runs.length === 0) {
    // Nothing shapes, so the spans do all the work and the chart needs no rebuilding.
    return { castOn: plan.castOn.to, rows, applied: true, issues: plan.issues };
  }

  let seq = 0;
  const out: PatternRow[] = [];
  let cursor = 0;

  for (const r of plan.runs) {
    for (let i = cursor; i < r.run.from; i++) out.push(rows[i]);

    const shaping = rows[r.run.shapingRows[0]];
    const plains = rows
      .slice(r.run.from, r.run.to + 1)
      .filter((_, i) => !r.run.shapingRows.includes(r.run.from + i));
    const needsPlain = r.intervals.some((iv) => iv.every > 1);
    if (needsPlain && plains.length === 0) {
      return keep([
        ...plan.issues,
        `Rows ${r.run.from + 1}–${r.run.to + 1}: every row shapes, so there's no plain row to space them with.`,
      ]);
    }

    // Sides keep alternating across the rebuild; a plain template of the right side is preferred
    // so a wrong-side row stays purl rather than becoming knit.
    let side: StitchSide = r.run.from > 0 ? (rows[r.run.from - 1].side === 'RS' ? 'WS' : 'RS') : shaping.side;
    const plainFor = (s: StitchSide) => plains.find((p) => p.side === s) ?? plains[0];

    for (const iv of r.intervals) {
      for (let t = 0; t < iv.times; t++) {
        out.push(cloneRow(shaping, side, seq++));
        side = side === 'RS' ? 'WS' : 'RS';
        for (let k = 1; k < iv.every; k++) {
          out.push(cloneRow(plainFor(side), side, seq++));
          side = side === 'RS' ? 'WS' : 'RS';
        }
      }
    }
    cursor = r.run.to + 1;
  }
  for (let i = cursor; i < rows.length; i++) out.push(rows[i]);

  // The same check the parser gets: does the chart actually arrive where the rescale said?
  const before = sectionRowCounts(out, plan.castOn.to, sizeIndex);
  const final =
    out.length > 0 ? rowStitchesAfter(out[out.length - 1], before[out.length - 1], sizeIndex) : plan.castOn.to;
  if (final !== plan.finalStitches.to) {
    return keep([
      ...plan.issues,
      `Re-gauged chart ends on ${final} sts, not the ${plan.finalStitches.to} the rescale aimed at — keeping the pattern's own rows.`,
    ]);
  }

  return { castOn: plan.castOn.to, rows: out, applied: true, issues: plan.issues };
}
