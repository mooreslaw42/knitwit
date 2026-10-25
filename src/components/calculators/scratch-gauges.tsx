import { GaugeField } from '@/components/gauge-field';
import { SourceLink } from '@/components/source-badge';
import { useCalcScratch } from '@/store/useCalcScratch';

// The two gauges, wired to the scratch the calculators share, each wearing the mark of wherever it
// came from.
//
// Written once rather than in each calculator because the wiring is the part worth getting
// identical: the same gauge, in the same place at the top of the screen, cleared of its provenance
// by the same keystroke. `onChange` passes no source on purpose — see useCalcScratch.

export function PatternGaugeField({ label = "The pattern's gauge" }: { label?: string }) {
  const gauge = useCalcScratch((state) => state.patternGauge);
  const from = useCalcScratch((state) => state.patternGaugeFrom);
  const setPatternGauge = useCalcScratch((state) => state.setPatternGauge);

  return (
    <GaugeField
      label={label}
      badge={from ? <SourceLink label={from.label} href={from.href} /> : undefined}
      value={gauge}
      onChange={(next) => setPatternGauge(next)}
    />
  );
}

export function MyGaugeField({
  label = 'Your gauge',
  hint,
}: {
  label?: string;
  hint?: string;
}) {
  const gauge = useCalcScratch((state) => state.myGauge);
  const from = useCalcScratch((state) => state.myGaugeFrom);
  const setMyGauge = useCalcScratch((state) => state.setMyGauge);

  return (
    <GaugeField
      label={label}
      hint={hint}
      badge={from ? <SourceLink label={from.label} href={from.href} /> : undefined}
      value={gauge}
      onChange={(next) => setMyGauge(next)}
    />
  );
}
