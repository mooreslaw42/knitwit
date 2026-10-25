import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Answer, CalcScreen, Caution, Inputs, NeedsInput, Working } from '@/components/calc-screen';
import { MyGaugeField, PatternGaugeField } from '@/components/calculators/scratch-gauges';
import { FormField } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { isUsableGauge, rescaleStitches, stitchesToCm, stitchRatio } from '@/lib/gauge';
import { round } from '@/lib/numbers';
import { useCalcScratch } from '@/store/useCalcScratch';
import type { StitchMultiple } from '@/types/knitwit';

// The central one: the pattern's stitch count, at the knitter's gauge.
export function RescaleCalculator() {
  const patternGauge = useCalcScratch((state) => state.patternGauge);
  const myGauge = useCalcScratch((state) => state.myGauge);

  // Local to this screen — no other calculator asks for a cast-on or a stitch repeat.
  const [count, setCount] = useState('');
  const [multipleOf, setMultipleOf] = useState('');
  const [multiplePlus, setMultiplePlus] = useState('');

  const ratio = stitchRatio(patternGauge, myGauge);
  const of = parseInt(multipleOf, 10);
  const plus = parseInt(multiplePlus, 10);
  const multiple: StitchMultiple | null =
    Number.isFinite(of) && of > 1 ? { of, plus: Number.isFinite(plus) ? plus : 0 } : null;
  const rawCount = parseFloat(count.replace(',', '.'));
  const hasCount = Number.isFinite(rawCount) && rawCount >= 0;
  const rescaled = ratio != null && hasCount ? rescaleStitches(rawCount, ratio, multiple) : null;

  return (
    <CalcScreen
      title="Rescale a stitch count"
      question="The pattern says cast on this many, but you don't knit at its gauge. How many should you cast on?">
      <Inputs>
        <PatternGaugeField />
        <MyGaugeField hint="Measured on a washed and blocked swatch, over the same window." />
        <FormField
          label="The pattern says to cast on"
          value={count}
          onChangeText={setCount}
          keyboardType="numeric"
          placeholder="e.g. 30"
        />
        <ThemedText type="small" themeColor="inkSoft">
          If that section has a stitch repeat, say so — otherwise rounding can break it.
        </ThemedText>
        <View style={styles.row}>
          <View style={styles.grow}>
            <FormField
              label="Multiple of"
              value={multipleOf}
              onChangeText={setMultipleOf}
              keyboardType="numeric"
              placeholder="e.g. 4"
            />
          </View>
          <View style={styles.grow}>
            <FormField
              label="Plus"
              value={multiplePlus}
              onChangeText={setMultiplePlus}
              keyboardType="numeric"
              placeholder="e.g. 2"
            />
          </View>
        </View>
      </Inputs>

      {rescaled && ratio != null && isUsableGauge(myGauge) && isUsableGauge(patternGauge) ? (
        <Answer label="Cast on" value={`${rescaled.rounded} sts`}>
          <Working>
            Exactly {round(rescaled.exact)}, rounded{' '}
            {multiple
              ? `to a multiple of ${multiple.of} plus ${multiple.plus}`
              : 'to the nearest stitch'}
            . Your fabric is{' '}
            {ratio === 1
              ? 'the same as the pattern’s'
              : ratio > 1
                ? `finer, so it takes ${round((ratio - 1) * 100, 1)}% more stitches`
                : `looser, so it takes ${round((1 - ratio) * 100, 1)}% fewer`}
            .
          </Working>
          <Working>
            {round(stitchesToCm(rescaled.rounded, myGauge) ?? 0, 1)}cm wide at your gauge · the
            pattern intended {round(stitchesToCm(rawCount, patternGauge) ?? 0, 1)}cm
          </Working>
          {rescaled.adjustedForMultiple && (
            <Caution>The repeat moved this further than plain rounding would have.</Caution>
          )}
        </Answer>
      ) : (
        <NeedsInput>
          Both gauges need a stitch count over a real width, and a number to rescale.
        </NeedsInput>
      )}
    </CalcScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
  grow: { flex: 1 },
});
