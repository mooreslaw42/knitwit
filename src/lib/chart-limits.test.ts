import {
  CROCHET_CHART_LIMITS,
  chartLimitNote,
  KNIT_CHART_LIMITS,
  rowsWithinBudget,
  type ChartLimits,
} from '@/lib/chart-limits';

const limits = (over: Partial<ChartLimits> = {}): ChartLimits => ({
  maxStitchesPerRow: 10,
  maxRows: 5,
  maxTotal: 30,
  ...over,
});

describe('rowsWithinBudget', () => {
  it('draws everything when everything fits', () => {
    expect(rowsWithinBudget([4, 4, 4], limits())).toBe(3);
  });

  it('stops at the row ceiling', () => {
    expect(rowsWithinBudget([1, 1, 1, 1, 1, 1, 1], limits())).toBe(5);
  });

  it('stops when the rows together cost too much', () => {
    // Ten a row against a budget of thirty: three rows, not the five the row ceiling would allow.
    expect(rowsWithinBudget([10, 10, 10, 10, 10], limits())).toBe(3);
  });

  it('counts a wide row at the width it is actually drawn, not its full length', () => {
    // 40 stitches each, drawn 10 wide: three rows fit in the budget of thirty.
    expect(rowsWithinBudget([40, 40, 40, 40], limits())).toBe(3);
  });

  // A card with a chart heading and nothing under it says less than a partial drawing does.
  it('always draws at least one row, however wide', () => {
    expect(rowsWithinBudget([500], limits())).toBe(1);
    expect(rowsWithinBudget([0, 0], limits())).toBe(2);
  });

  it('never claims more rows than it was given', () => {
    expect(rowsWithinBudget([2], limits())).toBe(1);
    expect(rowsWithinBudget([], limits())).toBe(1);
  });

  // The numbers that ship. A garment row and a blanket row both fit; the guard is there for the
  // pattern that is both wide and long.
  it('draws an ordinary pattern whole', () => {
    const blanket = new Array(40).fill(48);
    expect(rowsWithinBudget(blanket, CROCHET_CHART_LIMITS)).toBe(40);
    expect(rowsWithinBudget(blanket, KNIT_CHART_LIMITS)).toBe(40);
  });
});

// The whole point of the module: a chart that leaves something out has to say so. Silently drawing
// the first forty stitches of a sixty-stitch row is a picture of a garment nobody is knitting.
describe('chartLimitNote', () => {
  it('says nothing when nothing was left out', () => {
    expect(
      chartLimitNote({ rowsShown: 12, rowsTotal: 12, clippedRows: 0, maxStitchesPerRow: 120 }),
    ).toBe('');
  });

  it('counts the rows it is not showing', () => {
    expect(
      chartLimitNote({ rowsShown: 60, rowsTotal: 92, clippedRows: 0, maxStitchesPerRow: 120 }),
    ).toBe('Showing the first 60 of 92 rows.');
  });

  it('says when a row runs on past the edge', () => {
    expect(
      chartLimitNote({ rowsShown: 8, rowsTotal: 8, clippedRows: 1, maxStitchesPerRow: 120 }),
    ).toBe('One row is wider than the 120 stitches shown — the … marks where it runs on');
    expect(
      chartLimitNote({ rowsShown: 8, rowsTotal: 8, clippedRows: 5, maxStitchesPerRow: 120 }),
    ).toBe('5 rows are wider than the 120 stitches shown — the … marks where they run on');
  });

  // An ellipsis followed by a full stop reads as four dots and looks like a mistake.
  it('does not put a full stop after the ellipsis', () => {
    const note = chartLimitNote({
      rowsShown: 8,
      rowsTotal: 8,
      clippedRows: 2,
      maxStitchesPerRow: 120,
    });
    expect(note).not.toContain('….');
  });

  it('says both at once when both happened', () => {
    const note = chartLimitNote({
      rowsShown: 60,
      rowsTotal: 92,
      clippedRows: 3,
      maxStitchesPerRow: 120,
    });
    expect(note).toContain('first 60 of 92 rows');
    expect(note).toContain('3 rows are wider');
  });
});
