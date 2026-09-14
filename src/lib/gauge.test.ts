import {
  convertGauge,
  defaultWindow,
  formatGauge,
  formatGaugeIn,
  gaugeFields,
  hasRowGauge,
  isUsableGauge,
  makeGauge,
  presetIndexFor,
  rescaleStitches,
  roundToMultiple,
  rowsPerCm,
  stitchesPerCm,
  stitchesToCm,
  stitchRatio,
  toCm,
  gaugeAtNeedle,
  needleForGauge,
  nearestToolSize,
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

describe('roundToMultiple', () => {
  it('rounds normally when there is no multiple to honour', () => {
    expect(roundToMultiple(27.3)).toBe(27);
    expect(roundToMultiple(27.6)).toBe(28);
  });

  // The case that makes plain rounding useless: 27 stitches of k2/p2 rib leaves three over.
  it('keeps a k2/p2 rib knittable', () => {
    expect(roundToMultiple(27.3, { of: 4, plus: 0 })).toBe(28);
    expect(roundToMultiple(29.4, { of: 4, plus: 0 })).toBe(28);
  });

  it('honours an offset, so a lace repeat keeps its edge stitches', () => {
    // Multiple of 8 plus 2: …26, 34, 42.
    expect(roundToMultiple(31, { of: 8, plus: 2 })).toBe(34);
    expect(roundToMultiple(28, { of: 8, plus: 2 })).toBe(26);
  });

  it('normalises an offset the pattern wrote larger than the multiple', () => {
    // "Multiple of 4 plus 6" is the same requirement as "plus 2".
    expect(roundToMultiple(31, { of: 4, plus: 6 })).toBe(30);
    expect(roundToMultiple(31, { of: 4, plus: 2 })).toBe(30);
  });

  it('rounds a tie up, since a roomier garment beats a tight one', () => {
    expect(roundToMultiple(30, { of: 4, plus: 0 })).toBe(32);
  });

  it('never goes negative', () => {
    expect(roundToMultiple(1, { of: 8, plus: 2 })).toBe(2);
    expect(roundToMultiple(-5)).toBe(0);
  });

  it('ignores a meaningless multiple rather than dividing by it', () => {
    expect(roundToMultiple(27.3, { of: 1, plus: 0 })).toBe(27);
    expect(roundToMultiple(27.3, { of: 0, plus: 0 })).toBe(27);
  });
});

describe('rescaleStitches', () => {
  it('scales a cast-on to the knitter’s gauge', () => {
    // Pattern 22 sts/10cm, knitter 20 — a looser fabric needs fewer stitches for the same width.
    const ratio = stitchRatio(metric, { ...metric, stitches: 20 })!;
    expect(rescaleStitches(30, ratio).rounded).toBe(27);
  });

  it('shows the unrounded number so the rounding is never invisible', () => {
    const ratio = stitchRatio(metric, { ...metric, stitches: 20 })!;
    expect(rescaleStitches(30, ratio).exact).toBeCloseTo(27.27, 2);
  });

  it('says when the stitch multiple moved the number further than rounding would', () => {
    const ratio = stitchRatio(metric, { ...metric, stitches: 20 })!;
    const plain = rescaleStitches(30, ratio);
    const ribbed = rescaleStitches(30, ratio, { of: 4, plus: 0 });
    expect(plain.adjustedForMultiple).toBe(false);
    expect(ribbed.rounded).toBe(28);
    expect(ribbed.adjustedForMultiple).toBe(true);
  });

  it('leaves a count alone when the gauges match', () => {
    expect(rescaleStitches(88, 1).rounded).toBe(88);
  });
});

describe('formatGaugeIn', () => {
  it('shows a gauge in the unit the knitter reads in', () => {
    expect(formatGaugeIn(metric, 'inch')).toBe('22.35 × 30.48 sts/rows per 4in');
    expect(formatGaugeIn(imperial, 'cm')).toBe('21.65 × 29.53 sts/rows per 10cm');
  });

  // Restating a gauge that's already in the right unit would turn "22 per 4in" into "22.35 per
  // 4.06in" — technically the same fabric, and useless to read.
  it('leaves a gauge already in that unit exactly as written', () => {
    expect(formatGaugeIn(metric, 'cm')).toBe('22 × 30 sts/rows per 10cm');
    expect(formatGaugeIn(imperial, 'inch')).toBe('22 × 30 sts/rows per 4in');
  });

  it('converts for reading without touching what was stored', () => {
    const before = { ...metric };
    formatGaugeIn(metric, 'inch');
    expect(metric).toEqual(before);
  });

  it('is empty rather than misleading when nothing was stated', () => {
    expect(formatGaugeIn(null, 'inch')).toBe('');
  });
});

describe('defaultWindow', () => {
  it('uses each system’s own convention', () => {
    expect(defaultWindow('cm')).toEqual({ width: 10, height: 10, unit: 'cm' });
    expect(defaultWindow('inch')).toEqual({ width: 4, height: 4, unit: 'inch' });
  });
});

describe('gauge and needle size', () => {
  const g = (stitches: number, rows = 0): Gauge => ({
    stitches, rows, width: 10, height: 10, unit: 'cm',
  });

  describe('gaugeAtNeedle', () => {
    it('loosens on a bigger needle', () => {
      // 22 sts/10cm on 4mm: a 4.5mm needle makes wider stitches, so fewer fit.
      expect(gaugeAtNeedle(g(22), 4, 4.5)?.stitches).toBeCloseTo(19.6, 1);
    });

    it('tightens on a smaller needle', () => {
      expect(gaugeAtNeedle(g(22), 4, 3.5)?.stitches).toBeCloseTo(25.1, 1);
    });

    it('changes nothing when the needle is the same', () => {
      expect(gaugeAtNeedle(g(22, 30), 4, 4)).toMatchObject({ stitches: 22, rows: 30 });
    });

    // A taller stitch as well as a wider one.
    it('moves row gauge too', () => {
      expect(gaugeAtNeedle(g(22, 30), 4, 5)?.rows).toBeCloseTo(24, 1);
    });

    it('leaves row gauge at zero when there wasn’t one', () => {
      expect(gaugeAtNeedle(g(22, 0), 4, 5)?.rows).toBe(0);
    });

    it('keeps the window it was measured over', () => {
      const inches: Gauge = { stitches: 20, rows: 28, width: 4, height: 4, unit: 'inch' };
      expect(gaugeAtNeedle(inches, 4, 5)).toMatchObject({ width: 4, height: 4, unit: 'inch' });
    });

    it('refuses nonsense rather than returning it', () => {
      expect(gaugeAtNeedle(g(0), 4, 5)).toBeNull();
      expect(gaugeAtNeedle(g(22), 0, 5)).toBeNull();
      expect(gaugeAtNeedle(g(22), 4, 0)).toBeNull();
    });
  });

  describe('needleForGauge', () => {
    it('sends you smaller when you need more stitches', () => {
      // Getting 20, want 22: a finer fabric needs a finer needle.
      const mm = needleForGauge(g(20), 4.5, g(22));
      expect(mm).toBeLessThan(4.5);
      expect(mm).toBeCloseTo(4.09, 2);
    });

    it('sends you bigger when you need fewer', () => {
      expect(needleForGauge(g(24), 4, g(22))!).toBeGreaterThan(4);
    });

    it('stays put when the gauges already match', () => {
      expect(needleForGauge(g(22), 4.5, g(22))).toBeCloseTo(4.5, 5);
    });

    // The round trip has to hold, or the two halves of the panel would disagree with each other.
    it('agrees with gaugeAtNeedle in both directions', () => {
      const want = g(19.6);
      const mm = needleForGauge(g(22), 4, want)!;
      expect(gaugeAtNeedle(g(22), 4, mm)?.stitches).toBeCloseTo(19.6, 1);
    });

    // Both gauges are compared per centimetre, so a pattern written in inches and a swatch
    // measured in cm are talking about the same fabric.
    it('compares across measuring windows', () => {
      // 22 sts to 10cm is 22.35 sts to 4in — the same fabric, stated the other way. Asking for it
      // when you already have it should leave the needle where it is.
      const sameInInches: Gauge = { stitches: 22.35, rows: 0, width: 4, height: 4, unit: 'inch' };
      expect(needleForGauge(g(22), 4, sameInInches)).toBeCloseTo(4, 1);
    });

    it('reads a coarser window as a coarser fabric', () => {
      // 8.8 sts to 4in is a much looser fabric than 22 sts to 10cm, and wants a much bigger hook.
      const coarse: Gauge = { stitches: 8.8, rows: 0, width: 4, height: 4, unit: 'inch' };
      expect(needleForGauge(g(22), 4, coarse)!).toBeGreaterThan(9);
    });

    it('refuses nonsense', () => {
      expect(needleForGauge(g(0), 4, g(22))).toBeNull();
      expect(needleForGauge(g(22), 0, g(22))).toBeNull();
    });
  });

  describe('nearestToolSize', () => {
    const sizes = [3, 3.25, 3.5, 3.75, 4, 4.5, 5];

    it('snaps to a size that actually exists', () => {
      expect(nearestToolSize(4.09, sizes)).toBe(4);
      expect(nearestToolSize(4.4, sizes)).toBe(4.5);
    });

    it('picks the closer of two neighbours', () => {
      expect(nearestToolSize(3.6, sizes)).toBe(3.5);
      expect(nearestToolSize(3.7, sizes)).toBe(3.75);
    });

    it('clamps to the ends rather than inventing', () => {
      expect(nearestToolSize(0.5, sizes)).toBe(3);
      expect(nearestToolSize(40, sizes)).toBe(5);
    });

    it('has nothing to say about an empty scale', () => {
      expect(nearestToolSize(4, [])).toBeNull();
    });
  });
});
