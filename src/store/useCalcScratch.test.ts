import { useCalcScratch } from '@/store/useCalcScratch';
import type { Gauge } from '@/types/knitwit';

const metric: Gauge = { stitches: 22, rows: 30, width: 10, height: 10, unit: 'cm' };
const mine: Gauge = { stitches: 20, rows: 28, width: 10, height: 10, unit: 'cm' };

beforeEach(() => useCalcScratch.getState().clear());

describe('the calculators’ shared scratch', () => {
  // The invented defaults were the reason every card arrived already "answered", about a swatch
  // nobody knitted. Blank is the honest starting point; the old numbers are placeholders now.
  it('starts with no gauge at all', () => {
    expect(useCalcScratch.getState().patternGauge).toBeNull();
    expect(useCalcScratch.getState().myGauge).toBeNull();
  });

  it('remembers where a prefilled gauge came from', () => {
    const from = { label: 'Hazel cardigan', href: '/project/hazel' };
    useCalcScratch.getState().setPatternGauge(metric, from);
    expect(useCalcScratch.getState().patternGaugeFrom).toEqual(from);
  });

  // The rule that keeps a prefill from becoming a claim: the moment the knitter types over a
  // number, it stops saying it came from their project, because it didn't.
  it('drops the provenance when the gauge is typed over', () => {
    const from = { label: 'Hazel cardigan', href: '/project/hazel' };
    useCalcScratch.getState().setMyGauge(mine, from);
    expect(useCalcScratch.getState().myGaugeFrom).toEqual(from);

    useCalcScratch.getState().setMyGauge({ ...mine, stitches: 19 });
    expect(useCalcScratch.getState().myGauge?.stitches).toBe(19);
    expect(useCalcScratch.getState().myGaugeFrom).toBeNull();
  });

  // Each gauge carries its own mark. A project supplies both at once, but a knitter who overtypes
  // one of them must not un-mark the other.
  it('tracks each gauge’s provenance separately', () => {
    const from = { label: 'Hazel cardigan', href: '/project/hazel' };
    useCalcScratch.getState().setPatternGauge(metric, from);
    useCalcScratch.getState().setMyGauge(mine, from);

    useCalcScratch.getState().setMyGauge({ ...mine, stitches: 19 });

    expect(useCalcScratch.getState().myGaugeFrom).toBeNull();
    expect(useCalcScratch.getState().patternGaugeFrom).toEqual(from);
  });

  it('clears back to empty', () => {
    useCalcScratch.getState().setPatternGauge(metric, { label: 'x', href: '/x' });
    useCalcScratch.getState().setNeedle('5mm');
    useCalcScratch.getState().clear();

    expect(useCalcScratch.getState().patternGauge).toBeNull();
    expect(useCalcScratch.getState().patternGaugeFrom).toBeNull();
    expect(useCalcScratch.getState().needle).toBe('4mm');
  });
});
