import {
  convertGauge,
  formatGauge,
  gaugeFields,
  hasRowGauge,
  isUsableGauge,
  makeGauge,
  presetIndexFor,
  rowsPerCm,
  stitchesPerCm,
  stitchesToCm,
  stitchRatio,
  toCm,
} from '@/lib/gauge';
import type { Gauge } from '@/types/knitwit';

const metric: Gauge = { stitches: 22, rows: 30, width: 10, height: 10, unit: 'cm' };
const imperial: Gauge = { stitches: 22, rows: 30, width: 4, height: 4, unit: 'inch' };

describe('units', () => {
  it('converts inches exactly, not approximately', () => {
    expect(toCm(4, 'inch')).toBeCloseTo(10.16, 10);
    expect(toCm(10, 'cm')).toBe(10);
  });

  // The whole reason gauge is stored as written: these two are *not* the same fabric, even though
  // patterns routinely print "22 sts to 4in (10cm)" as if they were.
  it('treats 22 sts per 4in as a different gauge from 22 sts per 10cm', () => {
    expect(stitchesPerCm(metric)).toBeCloseTo(2.2, 10);
    expect(stitchesPerCm(imperial)).toBeCloseTo(2.165, 3);
    expect(stitchesPerCm(metric)).not.toBeCloseTo(stitchesPerCm(imperial), 3);
  });

  it('reads a window whose height differs from its width', () => {
    const odd: Gauge = { stitches: 20, rows: 28, width: 10, height: 5, unit: 'cm' };
    expect(stitchesPerCm(odd)).toBe(2);
    expect(rowsPerCm(odd)).toBe(5.6);
  });
});

describe('convertGauge', () => {
  // Restating a gauge is not re-gauging: the numbers move so that the fabric doesn't.
  it('keeps the fabric identical when restating in another unit', () => {
    const converted = convertGauge(metric, { width: 4, height: 4, unit: 'inch' });
    expect(converted.unit).toBe('inch');
    expect(stitchesPerCm(converted)).toBeCloseTo(stitchesPerCm(metric), 2);
    expect(rowsPerCm(converted)).toBeCloseTo(rowsPerCm(metric), 2);
  });

  it('produces the number a pattern would print, not a rounded-off integer', () => {
    // 22 sts / 10cm over a 4in window is 22.35 — dropping the decimal would lose the conversion.
    expect(convertGauge(metric, { width: 4, height: 4, unit: 'inch' }).stitches).toBeCloseTo(
      22.35,
      2,
    );
  });

  it('round-trips', () => {
    const there = convertGauge(metric, { width: 4, height: 4, unit: 'inch' });
    const back = convertGauge(there, { width: 10, height: 10, unit: 'cm' });
    expect(back.stitches).toBeCloseTo(22, 1);
    expect(back.rows).toBeCloseTo(30, 1);
  });
});

describe('stitchRatio', () => {
  it('is above 1 when the knitter’s fabric is finer than the pattern’s', () => {
    const mine: Gauge = { ...metric, stitches: 24 };
    expect(stitchRatio(metric, mine)).toBeCloseTo(24 / 22, 6);
  });

  it('is below 1 when the knitter’s fabric is looser', () => {
    const mine: Gauge = { ...metric, stitches: 20 };
    expect(stitchRatio(metric, mine)).toBeCloseTo(20 / 22, 6);
  });

  // The case the whole "store as written" rule exists for: same printed number, different windows.
  it('is not 1 when the same count is measured over different windows', () => {
    expect(stitchRatio(metric, imperial)).not.toBeCloseTo(1, 3);
    expect(stitchRatio(metric, imperial)).toBeCloseTo(10 / 10.16, 4);
  });

  it('refuses when either side has no usable stitch gauge', () => {
    expect(stitchRatio(metric, { ...metric, stitches: 0 })).toBeNull();
    expect(stitchRatio({ ...metric, width: 0 }, metric)).toBeNull();
  });
});

describe('usability', () => {
  // A stitch gauge with no row gauge is a real pattern, not a broken one — which is also why the
  // rescale works on stitches.
  it('accepts a stitch gauge with no row gauge', () => {
    const noRows: Gauge = { stitches: 22, rows: 0, width: 10, height: 10, unit: 'cm' };
    expect(isUsableGauge(noRows)).toBe(true);
    expect(hasRowGauge(noRows)).toBe(false);
  });

  it('rejects nothing at all', () => {
    expect(isUsableGauge(null)).toBe(false);
    expect(isUsableGauge({ stitches: 0, rows: 0, width: 10, height: 10, unit: 'cm' })).toBe(false);
  });
});

describe('formatGauge', () => {
  it('names the window it was measured over', () => {
    expect(formatGauge(metric)).toBe('22 × 30 sts/rows per 10cm');
    expect(formatGauge(imperial)).toBe('22 × 30 sts/rows per 4in');
  });

  it('says only what it knows when there is no row gauge', () => {
    expect(formatGauge({ ...metric, rows: 0 })).toBe('22 sts per 10cm');
  });

  it('shows both dimensions when the window is not square', () => {
    expect(formatGauge({ stitches: 20, rows: 28, width: 10, height: 5, unit: 'cm' })).toContain(
      '10×5cm',
    );
  });

  it('is empty rather than misleading when nothing was stated', () => {
    expect(formatGauge(null)).toBe('');
  });
});

describe('form round-trip', () => {
  it('builds a gauge from typed fields', () => {
    expect(makeGauge('22', '30', { width: 10, height: 10, unit: 'cm' })).toEqual(metric);
  });

  it('accepts a decimal comma, which half of Europe types', () => {
    expect(makeGauge('21,5', '30', { width: 10, height: 10, unit: 'cm' })?.stitches).toBe(21.5);
  });

  it('keeps "not stated" as null rather than turning it into zero', () => {
    expect(makeGauge('', '', { width: 10, height: 10, unit: 'cm' })).toBeNull();
    expect(makeGauge('  ', 'abc', { width: 10, height: 10, unit: 'cm' })).toBeNull();
  });

  it('keeps a stitch-only gauge', () => {
    expect(makeGauge('22', '', { width: 10, height: 10, unit: 'cm' })).toMatchObject({
      stitches: 22,
      rows: 0,
    });
  });

  it('puts a stored gauge back into a form unchanged', () => {
    const fields = gaugeFields(metric);
    expect(fields).toEqual({
      stitches: '22',
      rows: '30',
      window: { width: 10, height: 10, unit: 'cm' },
    });
    expect(makeGauge(fields.stitches, fields.rows, fields.window)).toEqual(metric);
  });

  it('leaves an absent gauge as empty fields on the default window', () => {
    expect(gaugeFields(null)).toEqual({
      stitches: '',
      rows: '',
      window: { width: 10, height: 10, unit: 'cm' },
    });
  });
});

describe('presetIndexFor', () => {
  it('finds the preset a stored gauge was measured with', () => {
    expect(presetIndexFor(metric)).toBe(0);
    expect(presetIndexFor(imperial)).toBe(1);
    expect(presetIndexFor({ ...metric, width: 1, height: 1, unit: 'inch' })).toBe(2);
  });

  it('reports a custom window as no preset', () => {
    expect(presetIndexFor({ stitches: 20, rows: 28, width: 10, height: 5, unit: 'cm' })).toBe(-1);
  });
});

describe('measurements', () => {
  it('says what a stitch count measures', () => {
    expect(stitchesToCm(44, metric)).toBe(20);
  });
});
