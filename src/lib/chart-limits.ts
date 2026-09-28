// How much of a chart is worth drawing, and how to say what was left out.
//
// A chart is a picture of the fabric, and past a certain size the picture stops being readable and
// starts being a performance problem. Every crochet stitch is a small drawing — a group wrapping
// three to six SVG nodes — so a 150-stitch blanket row over a hundred rows is sixty thousand
// nodes, which no phone draws smoothly. A knitting cell is cheaper, a box and a letter, but two
// hundred rows of two hundred stitches is still forty thousand of them.
//
// So there is a ceiling. The ceiling is not the problem; a ceiling hit *silently* is. A chart that
// quietly stops at forty stitches draws a fabric nobody wrote — narrower than the real one, with
// the shaping at the end of the row missing — and looks entirely convincing while doing it. That
// is the one failure this file exists to prevent: everything cut off is counted, so the chart can
// say so.

export type ChartLimits = {
  maxStitchesPerRow: number;
  maxRows: number;
  // A ceiling on the two multiplied out, so a chart that is both wide and long degrades
  // predictably instead of locking up the screen it is drawn on.
  maxTotal: number;
};

// A knitting cell is a box with a symbol in it; a crochet stitch is a drawing of itself, and costs
// several times as much to put on the screen. Hence the smaller total for crochet at the same
// width — the two charts should give out at roughly the same moment in wall-clock terms.
export const KNIT_CHART_LIMITS: ChartLimits = {
  maxStitchesPerRow: 120,
  maxRows: 60,
  maxTotal: 3000,
};

export const CROCHET_CHART_LIMITS: ChartLimits = {
  maxStitchesPerRow: 120,
  maxRows: 60,
  maxTotal: 2000,
};

// How many rows fit inside the budget, counting from the first — a chart is read bottom-up, and
// the start of the piece is what a knitter checks their work against.
//
// Always at least one row: a single row wider than the whole budget is still worth drawing as far
// as it goes, and returning none would leave the card empty with nothing to explain it.
export function rowsWithinBudget(stitchesPerRow: number[], limits: ChartLimits): number {
  let total = 0;
  let rows = 0;
  for (const count of stitchesPerRow.slice(0, limits.maxRows)) {
    const drawn = Math.min(Math.max(0, count), limits.maxStitchesPerRow);
    if (rows > 0 && total + drawn > limits.maxTotal) break;
    total += drawn;
    rows += 1;
  }
  return Math.max(1, Math.min(rows, stitchesPerRow.length));
}

// One line saying what the chart is not showing, or nothing at all when it is showing everything.
//
// Said in stitches and rows rather than in percentages or ellipses alone: a knitter needs to know
// whether the thing they are looking for is missing, and "the first 60 of 92 rows" answers that
// where "…" does not.
export function chartLimitNote({
  rowsShown,
  rowsTotal,
  clippedRows,
  maxStitchesPerRow,
}: {
  rowsShown: number;
  rowsTotal: number;
  // How many of the drawn rows ran on past the width the chart can draw.
  clippedRows: number;
  maxStitchesPerRow: number;
}): string {
  const parts: string[] = [];
  if (rowsShown < rowsTotal) {
    parts.push(`Showing the first ${rowsShown} of ${rowsTotal} rows.`);
  }
  if (clippedRows > 0) {
    // No full stop after the ellipsis: "stops at the …." reads as four dots and looks like a typo.
    parts.push(
      clippedRows === 1
        ? `One row is wider than the ${maxStitchesPerRow} stitches shown — the … marks where it runs on`
        : `${clippedRows} rows are wider than the ${maxStitchesPerRow} stitches shown — the … marks where they run on`,
    );
  }
  return parts.join(' ');
}
