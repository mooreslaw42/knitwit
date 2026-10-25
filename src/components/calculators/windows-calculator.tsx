import { Answer, CalcScreen, Inputs, NeedsInput } from '@/components/calc-screen';
import { PatternGaugeField } from '@/components/calculators/scratch-gauges';
import { ThemedText } from '@/components/themed-text';
import { convertGauge, formatGauge, isUsableGauge } from '@/lib/gauge';
import { useCalcScratch } from '@/store/useCalcScratch';

// The sanity check the other three rest on.
//
// Kept as a calculator of its own rather than folded away, even though the window chips on a gauge
// field already restate a gauge when you tap one. Tapping a chip shows you one window at a time;
// what settles "are these the same fabric?" is seeing all three at once, against the pattern in
// your hands.
const WINDOWS = [
  { width: 10, height: 10, unit: 'cm' as const },
  { width: 4, height: 4, unit: 'inch' as const },
  { width: 1, height: 1, unit: 'inch' as const },
];

export function WindowsCalculator() {
  const gauge = useCalcScratch((state) => state.patternGauge);

  return (
    <CalcScreen
      title="The same gauge, every window"
      question="A pattern gives its gauge per 4in and yours is per 10cm. Are they the same fabric?">
      <Inputs>
        <PatternGaugeField label="The gauge to restate" />
      </Inputs>

      {isUsableGauge(gauge) ? (
        <Answer
          label="The same fabric, three windows"
          value={formatGauge(convertGauge(gauge, WINDOWS[0]))}>
          {WINDOWS.slice(1).map((w) => (
            <ThemedText key={`${w.width}${w.unit}`} type="small" themeColor="inkSoft">
              {formatGauge(convertGauge(gauge, w))}
            </ThemedText>
          ))}
          <ThemedText type="small" themeColor="inkSoft">
            Nothing has been re-gauged here. If these don&apos;t match the pattern in your hands,
            none of the other calculators can be trusted either.
          </ThemedText>
        </Answer>
      ) : (
        <NeedsInput>A gauge with a stitch count over a real width.</NeedsInput>
      )}
    </CalcScreen>
  );
}
