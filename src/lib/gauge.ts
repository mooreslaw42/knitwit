import type { Gauge, LengthUnit } from '@/types/knitwit';

// The gauge layer. Everything that will eventually re-gauge a pattern stands on these functions,
// so they stay pure and exhaustively tested.
//
// The one rule: gauge is stored as the pattern wrote it, and converted only where it's computed.
// Normalising on entry would quietly turn "22 sts to 4 inches" into "22 sts to 10cm", which is a
// different fabric — 1.6% different, or about half a stitch on a cast-on and considerably more
// across a body.

const CM_PER_INCH = 2.54;

// The windows patterns actually use. "Custom" is the escape hatch — a pattern stating a different
// height from width, or a crochet motif measured its own way, still fits the same type.
export const GAUGE_PRESETS: { label: string; width: number; height: number; unit: LengthUnit }[] = [
  { label: 'per 10cm', width: 10, height: 10, unit: 'cm' },
  { label: 'per 4in', width: 4, height: 4, unit: 'inch' },
  { label: 'per 1in', width: 1, height: 1, unit: 'inch' },
];

export function toCm(value: number, unit: LengthUnit): number {
  return unit === 'inch' ? value * CM_PER_INCH : value;
}

export function fromCm(cm: number, unit: LengthUnit): number {
  return unit === 'inch' ? cm / CM_PER_INCH : cm;
}

// Canonical form for all arithmetic. Nothing is stored in these terms; everything computes in them.
export function stitchesPerCm(g: Gauge): number {
  const width = toCm(g.width, g.unit);
  return width > 0 ? g.stitches / width : 0;
}

export function rowsPerCm(g: Gauge): number {
  const height = toCm(g.height, g.unit);
  return height > 0 ? g.rows / height : 0;
}

// A gauge is only usable if it says something about stitches over a real width. Rows are allowed
// to be missing — plenty of patterns give a stitch gauge and tell you to work to a measurement,
// which is also why the rescale works on stitches rather than rows.
export function isUsableGauge(g: Gauge | null | undefined): g is Gauge {
  return !!g && g.stitches > 0 && g.width > 0;
}

export function hasRowGauge(g: Gauge | null | undefined): boolean {
  return !!g && g.rows > 0 && g.height > 0;
}

// Re-express a gauge in another window without changing the fabric it describes. This is the
// "inch to cm" conversion, and it deliberately changes the stitch and row numbers so that the
// stitches-per-cm stays identical — the pattern has not been re-gauged, only restated.
export function convertGauge(g: Gauge, to: { width: number; height: number; unit: LengthUnit }): Gauge {
  return {
    stitches: round2(stitchesPerCm(g) * toCm(to.width, to.unit)),
    rows: round2(rowsPerCm(g) * toCm(to.height, to.unit)),
    width: to.width,
    height: to.height,
    unit: to.unit,
  };
}

// Gauge numbers are counted stitches, so they're usually whole — but a converted one rarely is,
// and rounding it to an integer would throw away the precision the conversion existed to keep.
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function trim(n: number): string {
  return String(Math.round(n * 100) / 100);
}

export function formatWindow(g: Gauge): string {
  const unit = g.unit === 'inch' ? 'in' : 'cm';
  return g.width === g.height ? `${trim(g.width)}${unit}` : `${trim(g.width)}×${trim(g.height)}${unit}`;
}

// "22 × 30 sts/rows per 10cm", or "22 sts per 10cm" when no row gauge was given.
export function formatGauge(g: Gauge | null | undefined): string {
  if (!isUsableGauge(g)) return '';
  const window = formatWindow(g);
  if (!hasRowGauge(g)) return `${trim(g.stitches)} sts per ${window}`;
  return `${trim(g.stitches)} × ${trim(g.rows)} sts/rows per ${window}`;
}

// How many of the knitter's stitches stand in for one of the pattern's. Above 1 means their
// fabric is finer, so the pattern's counts must go up to reach the same width.
//
// Only the stitch axis is returned. Row gauge varies with blocking, fabric relaxation and how the
// knitter measures, and patterns routinely say "work to 40cm" rather than trusting a row count —
// so length is reported as a measurement rather than scaled. See the plan.
export function stitchRatio(pattern: Gauge, mine: Gauge): number | null {
  if (!isUsableGauge(pattern) || !isUsableGauge(mine)) return null;
  const from = stitchesPerCm(pattern);
  return from > 0 ? stitchesPerCm(mine) / from : null;
}

// What a length of fabric worked at `g` measures, in centimetres.
export function stitchesToCm(stitches: number, g: Gauge): number | null {
  const perCm = stitchesPerCm(g);
  return perCm > 0 ? stitches / perCm : null;
}

export function rowsToCm(rows: number, g: Gauge): number | null {
  const perCm = rowsPerCm(g);
  return perCm > 0 ? rows / perCm : null;
}

// Build a gauge from what a form holds — free-text numbers and a chosen window. Returns null when
// there's nothing usable, so "not stated" stays a real answer rather than becoming a zero.
export function makeGauge(
  stitches: string,
  rows: string,
  window: { width: number; height: number; unit: LengthUnit },
): Gauge | null {
  const s = parseFloat(stitches.replace(',', '.'));
  const r = parseFloat(rows.replace(',', '.'));
  const hasStitches = Number.isFinite(s) && s > 0;
  const hasRows = Number.isFinite(r) && r > 0;
  if (!hasStitches && !hasRows) return null;
  return {
    stitches: hasStitches ? s : 0,
    rows: hasRows ? r : 0,
    width: window.width,
    height: window.height,
    unit: window.unit,
  };
}

// The inverse, for putting a stored gauge back into a form.
export function gaugeFields(g: Gauge | null | undefined): {
  stitches: string;
  rows: string;
  window: { width: number; height: number; unit: LengthUnit };
} {
  if (!g) {
    // Destructured rather than passed through: a preset carries a display label, and letting that
    // ride along would put it into stored gauges.
    const { width, height, unit } = GAUGE_PRESETS[0];
    return { stitches: '', rows: '', window: { width, height, unit } };
  }
  return {
    stitches: g.stitches > 0 ? trim(g.stitches) : '',
    rows: g.rows > 0 ? trim(g.rows) : '',
    window: { width: g.width, height: g.height, unit: g.unit },
  };
}

// Which preset a stored gauge matches, so the form can select it. Null means custom.
export function presetIndexFor(g: Gauge | null | undefined): number {
  if (!g) return 0;
  return GAUGE_PRESETS.findIndex(
    (p) => p.width === g.width && p.height === g.height && p.unit === g.unit,
  );
}
