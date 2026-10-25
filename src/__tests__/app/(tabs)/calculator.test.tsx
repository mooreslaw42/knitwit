import { render, screen } from '@testing-library/react-native';

import CalculatorScreen from '@/app/(tabs)/calculator';
import { CALCULATORS } from '@/lib/calculators';
import type { Gauge } from '@/types/knitwit';

// The hub is a list of links and nothing else, so what is worth asserting is what it offers — a row
// per calculator, and the project row only when there is really a gauge to carry over. A registry
// entry that never reaches the screen is exactly the kind of mistake that looks right in the diff.

jest.mock('@/lib/use-page-title', () => ({ usePageTitle: jest.fn() }));
jest.mock('expo-router', () => {
  const { View } = jest.requireActual('react-native');
  return {
    Link: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  };
});

const metric: Gauge = { stitches: 22, rows: 30, width: 10, height: 10, unit: 'cm' };
const mine: Gauge = { stitches: 20, rows: 28, width: 10, height: 10, unit: 'cm' };

type StoreState = {
  settings: { gaugeUnit: 'cm' };
  activeProjectKey: string | null;
  projects: Record<string, unknown>;
};

// Named `mockState` because jest.mock's factory may only reach variables prefixed that way.
let mockState: StoreState;

jest.mock('@/store/useKnitwitStore', () => ({
  useKnitwitStore: (select: (s: unknown) => unknown) => select(mockState),
}));

beforeEach(() => {
  mockState = { settings: { gaugeUnit: 'cm' }, activeProjectKey: null, projects: {} };
});

describe('the calculator hub', () => {
  it('offers every calculator in the registry', async () => {
    await render(<CalculatorScreen />);

    CALCULATORS.forEach((calc) => {
      expect(screen.getByText(calc.title)).toBeTruthy();
      expect(screen.getByText(calc.question)).toBeTruthy();
    });
  });

  it('says nothing about a project when none is on the needles', async () => {
    await render(<CalculatorScreen />);
    expect(screen.queryByText(/is on the needles/)).toBeNull();
  });

  it('offers the gauge of the project being counted', async () => {
    mockState.activeProjectKey = 'hazel';
    mockState.projects = { hazel: { name: 'Hazel cardigan', gauge: { pattern: metric, mine } } };

    await render(<CalculatorScreen />);

    expect(screen.getByText('Hazel cardigan is on the needles')).toBeTruthy();
    expect(screen.getByText(/20 × 28 sts\/rows per 10cm/)).toBeTruthy();
  });

  // A project knitted at the pattern's own gauge stores none, so there is nothing to carry over and
  // the row would be a door into an empty room.
  it('stays quiet about a project with no gauge of its own', async () => {
    mockState.activeProjectKey = 'hazel';
    mockState.projects = { hazel: { name: 'Hazel cardigan', gauge: null } };

    await render(<CalculatorScreen />);

    expect(screen.queryByText(/is on the needles/)).toBeNull();
  });
});
