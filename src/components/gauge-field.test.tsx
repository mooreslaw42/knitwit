import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { GaugeField } from '@/components/gauge-field';
import type { Gauge } from '@/types/knitwit';

// Only the preferred unit is read, and only to pick the window a *new* gauge starts in.
jest.mock('@/store/useKnitwitStore', () => ({
  useKnitwitStore: (select: (s: unknown) => unknown) => select({ settings: { gaugeUnit: 'cm' } }),
}));
// Reached through knitwit-ui's Photo, and it touches AsyncStorage's native module, which isn't
// there under Jest. There is no photo on a gauge.
jest.mock('@/lib/photo-store', () => ({
  getPhoto: jest.fn(),
  isInlinePhoto: () => false,
}));

const metric: Gauge = { stitches: 22, rows: 30, width: 10, height: 10, unit: 'cm' };

// Two controls over one gauge — the calculator's arrangement, where the pattern's gauge is asked
// for on three cards and the knitter's on five, all over one piece of state.
function SharedGauge() {
  const [gauge, setGauge] = useState<Gauge | null>(metric);
  return (
    <>
      <GaugeField label="First" value={gauge} onChange={setGauge} />
      <GaugeField label="Second" value={gauge} onChange={setGauge} />
    </>
  );
}

// A render test rather than a unit one because the bug was only ever visible on screen: the
// arithmetic downstream was right the whole time, and the field sitting above it was wrong.
describe('GaugeField sharing one gauge', () => {
  it('follows a change made in another control', async () => {
    await render(<SharedGauge />);
    // Two "Stitches" fields, one per control, both showing the gauge they were given.
    expect(screen.getAllByDisplayValue('22')).toHaveLength(2);

    await fireEvent.changeText(screen.getAllByDisplayValue('22')[0], '18');

    // The second used to still read 22 here, directly above an answer computed from 18.
    expect(screen.getAllByDisplayValue('18')).toHaveLength(2);
    expect(screen.queryByDisplayValue('22')).toBeNull();
  });

  it('leaves a half-typed number as it was typed', async () => {
    await render(<SharedGauge />);

    // The reason the strings are held locally at all: "21," must not come back as "21" under the
    // knitter's cursor, even though that is the gauge it parses to and the gauge the other control
    // is told about.
    await fireEvent.changeText(screen.getAllByDisplayValue('22')[0], '21,');

    expect(screen.getByDisplayValue('21,')).toBeTruthy();
    expect(screen.getByDisplayValue('21')).toBeTruthy();
  });

  it('restates both controls when one switches window', async () => {
    await render(<SharedGauge />);

    await fireEvent.press(screen.getAllByText('per 4in')[0]);

    // 22 sts per 10cm is 22.35 sts per 4in — the same fabric, said another way, in both controls.
    expect(screen.getAllByDisplayValue('22.35')).toHaveLength(2);
  });
});
