import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Answer, CalcScreen, Inputs, NeedsInput } from '@/components/calc-screen';
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
      <Inputs>
        <MyGaugeField />
      </Inputs>

      <Inputs>
        <ThemedText type="smallBold">You have a count and want the measurement</ThemedText>
        <View style={styles.row}>
          <View style={styles.grow}>
            <FormField
              label="Stitches"
              value={stitches}
              onChangeText={setStitches}
              keyboardType="numeric"
              placeholder="88"
            />
          </View>
          <View style={styles.grow}>
            <FormField
              label="Rows"
              value={rows}
              onChangeText={setRows}
              keyboardType="numeric"
              placeholder="120"
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
            <ThemedText type="small" themeColor="inkSoft">
              {nStitches} sts is {round((stitchesToCm(nStitches, myGauge) ?? 0) / 2.54, 1)}in across.
            </ThemedText>
          ) : null}
          {nRows !== null && !rowsKnown ? (
            <ThemedText type="small" themeColor="coralDeep">
              No row gauge entered, so there is no length to give.
            </ThemedText>
          ) : null}
        </Answer>
      ) : (
        <NeedsInput>Your gauge, and a number of stitches or rows.</NeedsInput>
      )}

      <Inputs>
        <ThemedText type="smallBold">You have the measurement and want the count</ThemedText>
        <View style={styles.row}>
          <View style={styles.grow}>
            <FormField
              label="Centimetres across"
              value={across}
              onChangeText={setAcross}
              keyboardType="numeric"
              placeholder="44"
            />
          </View>
          <View style={styles.grow}>
            <FormField
              label="Centimetres long"
              value={along}
              onChangeText={setAlong}
              keyboardType="numeric"
              placeholder="60"
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
            <ThemedText type="small" themeColor="inkSoft">
              Exactly {round(nAcross * stitchesPerCm(myGauge))} stitches, rounded to the nearest
              one. A stitch repeat may want a different number — rescale handles that.
            </ThemedText>
          ) : null}
          {nAlong !== null && !rowsKnown ? (
            <ThemedText type="small" themeColor="coralDeep">
              No row gauge entered, so the row count can&apos;t be worked out.
            </ThemedText>
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
