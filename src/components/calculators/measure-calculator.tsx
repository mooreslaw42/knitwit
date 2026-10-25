import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Answer, CalcScreen, Caution, Inputs, NeedsInput, Working } from '@/components/calc-screen';
import { MyGaugeField } from '@/components/calculators/scratch-gauges';
import { FormField } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { hasRowGauge, isUsableGauge, rowsPerCm, rowsToCm, stitchesPerCm, stitchesToCm } from '@/lib/gauge';
import { round } from '@/lib/numbers';
import { useCalcScratch } from '@/store/useCalcScratch';

// Stitches to centimetres and back, which used to be two cards.
//
// Stitches and rows are asked for separately here, which they were not. One card took a single
// number labelled "How many stitches / rows?" and answered both the width of that many stitches and
// the length of that many rows — but a knitter has a stitch count *or* a row count, never a number
// that is honestly both.
export function MeasureCalculator() {
  const myGauge = useCalcScratch((state) => state.myGauge);

  const [stitches, setStitches] = useState('');
  const [rows, setRows] = useState('');
  const [across, setAcross] = useState('');
  const [along, setAlong] = useState('');

  const num = (value: string) => {
    const n = parseFloat(value.replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const usable = isUsableGauge(myGauge);
  const rowsKnown = hasRowGauge(myGauge);

  const nStitches = num(stitches);
  const nRows = num(rows);
  const nAcross = num(across);
  const nAlong = num(along);

  const countAnswer = usable && (nStitches !== null || nRows !== null);
  const sizeAnswer = usable && (nAcross !== null || nAlong !== null);

  return (
    <CalcScreen
      title="Stitches and centimetres"
      question="How wide is this many stitches, and how many stitches is this wide?">
      <Inputs label="Your gauge">
        <MyGaugeField />
      </Inputs>

      <Inputs label="You have a count, you want the measurement">
        <View style={styles.row}>
          <View style={styles.grow}>
            <FormField
              label="Stitches"
              value={stitches}
              onChangeText={setStitches}
              keyboardType="numeric"
              placeholder="e.g. 88"
            />
          </View>
          <View style={styles.grow}>
            <FormField
              label="Rows"
              value={rows}
              onChangeText={setRows}
              keyboardType="numeric"
              placeholder="e.g. 120"
            />
          </View>
        </View>
      </Inputs>

      {countAnswer ? (
        <Answer
          label="That comes to"
          value={[
            nStitches !== null
              ? `${round(stitchesToCm(nStitches, myGauge) ?? 0, 1)}cm wide`
              : null,
            nRows !== null && rowsKnown
              ? `${round(rowsToCm(nRows, myGauge) ?? 0, 1)}cm long`
              : null,
          ]
            .filter(Boolean)
            .join(' · ')}>
          {nStitches !== null ? (
            <Working>
              {nStitches} sts is {round((stitchesToCm(nStitches, myGauge) ?? 0) / 2.54, 1)}in across.
            </Working>
          ) : null}
          {nRows !== null && !rowsKnown ? (
            <Caution>No row gauge entered, so there is no length to give.</Caution>
          ) : null}
        </Answer>
      ) : (
        <NeedsInput>Your gauge, and a number of stitches or rows.</NeedsInput>
      )}

      <Inputs label="You have the measurement, you want the count">
        <View style={styles.row}>
          <View style={styles.grow}>
            <FormField
              label="Centimetres across"
              value={across}
              onChangeText={setAcross}
              keyboardType="numeric"
              placeholder="e.g. 44"
            />
          </View>
          <View style={styles.grow}>
            <FormField
              label="Centimetres long"
              value={along}
              onChangeText={setAlong}
              keyboardType="numeric"
              placeholder="e.g. 60"
            />
          </View>
        </View>
      </Inputs>

      {sizeAnswer ? (
        <Answer
          label="That takes"
          value={[
            nAcross !== null ? `${Math.round(nAcross * stitchesPerCm(myGauge))} sts` : null,
            nAlong !== null && rowsKnown ? `${Math.round(nAlong * rowsPerCm(myGauge))} rows` : null,
          ]
            .filter(Boolean)
            .join(' · ')}>
          {nAcross !== null ? (
            <Working>
              Exactly {round(nAcross * stitchesPerCm(myGauge))} stitches, rounded to the nearest
              one. A stitch repeat may want a different number — rescale handles that.
            </Working>
          ) : null}
          {nAlong !== null && !rowsKnown ? (
            <Caution>No row gauge entered, so the row count can&apos;t be worked out.</Caution>
          ) : null}
        </Answer>
      ) : (
        <NeedsInput>Your gauge, and a measurement.</NeedsInput>
      )}

      <ThemedText type="small" themeColor="inkSoft">
        Row counts are worked out here but never rescaled anywhere else — row gauge is unreliable,
        so length is better worked to a measurement than to a count.
      </ThemedText>
    </CalcScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
  grow: { flex: 1 },
});
