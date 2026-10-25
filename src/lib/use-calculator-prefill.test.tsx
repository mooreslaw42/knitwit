import { render } from '@testing-library/react-native';

import { useCalculatorPrefill } from '@/lib/use-calculator-prefill';
import { useCalcScratch } from '@/store/useCalcScratch';
import type { Gauge } from '@/types/knitwit';

// The contract for arriving from a project: the gauges are filled in, marked with where they came
// from, and then left alone. Tested at the hook rather than through a screen because what matters
// is what lands in the scratch — every calculator reads it the same way.

const metric: Gauge = { stitches: 22, rows: 30, width: 10, height: 10, unit: 'cm' };
const mine: Gauge = { stitches: 20, rows: 28, width: 10, height: 10, unit: 'cm' };

let mockParams: { project?: string };
let mockProjects: Record<string, unknown>;

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/store/useKnitwitStore', () => ({
  useKnitwitStore: (select: (s: unknown) => unknown) => select({ projects: mockProjects }),
}));

function Probe() {
  useCalculatorPrefill();
  return null;
}

beforeEach(() => {
  mockParams = {};
  mockProjects = {
    hazel: { name: 'Hazel cardigan', gauge: { pattern: metric, mine } },
    plain: { name: 'Plain socks', gauge: null },
  };
  useCalcScratch.getState().clear();
});

describe('arriving at a calculator from a project', () => {
  it('leaves the scratch alone with no project in the url', async () => {
    await render(<Probe />);
    expect(useCalcScratch.getState().patternGauge).toBeNull();
    expect(useCalcScratch.getState().myGauge).toBeNull();
  });

  it('fills both gauges in and says where they came from', async () => {
    mockParams = { project: 'hazel' };

    await render(<Probe />);

    expect(useCalcScratch.getState().patternGauge).toEqual(metric);
    expect(useCalcScratch.getState().myGauge).toEqual(mine);
    expect(useCalcScratch.getState().patternGaugeFrom).toEqual({
      label: 'Hazel cardigan',
      href: '/project/hazel',
    });
  });

  // A project worked at the pattern's own gauge stores none — nothing was re-scaled, so there is
  // nothing to carry over, and inventing one would be worse than leaving the fields empty.
  it('fills nothing in from a project with no gauge of its own', async () => {
    mockParams = { project: 'plain' };

    await render(<Probe />);

    expect(useCalcScratch.getState().patternGauge).toBeNull();
    expect(useCalcScratch.getState().patternGaugeFrom).toBeNull();
  });

  it('shrugs at a project key that is not there', async () => {
    mockParams = { project: 'deleted-last-week' };

    await render(<Probe />);

    expect(useCalcScratch.getState().patternGauge).toBeNull();
  });

  // The rule that makes this a prefill rather than a mode: once applied, it is the knitter's number
  // to change.
  //
  // The project object is what makes this worth asserting. It comes out of the store fresh whenever
  // anything about that project changes — counting a row is enough — so the effect runs again, and
  // without the guard it would quietly put the project's gauge back over whatever had been typed.
  // Hence the new object with the same contents below, which is exactly what the store hands over
  // after an unrelated edit.
  it('does not put the project’s gauge back over one the knitter typed', async () => {
    mockParams = { project: 'hazel' };
    const { rerender } = await render(<Probe />);

    useCalcScratch.getState().setMyGauge({ ...mine, stitches: 19 });
    mockProjects = {
      ...mockProjects,
      hazel: { name: 'Hazel cardigan', gauge: { pattern: metric, mine } },
    };
    await rerender(<Probe />);

    expect(useCalcScratch.getState().myGauge?.stitches).toBe(19);
    expect(useCalcScratch.getState().myGaugeFrom).toBeNull();
  });

  // And it does follow a different project, because that is a different question.
  it('fills in again when the url names another project', async () => {
    mockParams = { project: 'hazel' };
    const { rerender } = await render(<Probe />);
    expect(useCalcScratch.getState().myGauge).toEqual(mine);

    mockParams = { project: 'plain' };
    await rerender(<Probe />);

    expect(useCalcScratch.getState().patternGaugeFrom).toEqual({
      label: 'Hazel cardigan',
      href: '/project/hazel',
    });
  });
});
