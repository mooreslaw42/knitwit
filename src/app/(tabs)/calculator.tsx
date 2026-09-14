import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { GaugeField } from '@/components/gauge-field';
import { Card, FormField, SelectField } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import {
  convertGauge,
  formatGauge,
  gaugeAtNeedle,
  isUsableGauge,
  nearestToolSize,
  needleForGauge,
  rescaleStitches,
  rowsToCm,
  stitchesToCm,
  stitchRatio,
  type StitchMultiple,
} from '@/lib/gauge';
import {
  parseToolSize,
  TOOL_SIZES,
  toolSizeLabel,
  toolSizeOptions,
  type SizeScale,
} from '@/constants/catalogs';
import type { Gauge } from '@/types/knitwit';

// A workbench for the gauge maths, before any of it is wired into patterns. Everything here is
// read-only and stores nothing — it exists so the arithmetic can be checked against real patterns
// and a tape measure first. See ~/.claude/plans/knitwit-gauge-units-and-regauging.md.

const CRAFT_OPTIONS: { value: SizeScale; label: string }[] = [
  { value: 'knit', label: 'Knitting needles' },
  { value: 'crochet', label: 'Crochet hooks' },
];

const DEFAULT_PATTERN: Gauge = { stitches: 22, rows: 30, width: 10, height: 10, unit: 'cm' };
const DEFAULT_MINE: Gauge = { stitches: 20, rows: 28, width: 10, height: 10, unit: 'cm' };

function round(n: number, places = 2): string {
  const f = 10 ** places;
  return String(Math.round(n * f) / f);
}

export default function CalculatorScreen() {
  const [patternGauge, setPatternGauge] = useState<Gauge | null>(DEFAULT_PATTERN);
  const [myGauge, setMyGauge] = useState<Gauge | null>(DEFAULT_MINE);
  const [count, setCount] = useState('30');
  const [multipleOf, setMultipleOf] = useState('');
  const [multiplePlus, setMultiplePlus] = useState('');
  const [measure, setMeasure] = useState('88');
  const [myNeedle, setMyNeedle] = useState('4mm');
  const [sizeCraft, setSizeCraft] = useState<SizeScale>('knit');

  const ratio = stitchRatio(patternGauge ?? DEFAULT_PATTERN, myGauge ?? DEFAULT_MINE);
  const of = parseInt(multipleOf, 10);
  const plus = parseInt(multiplePlus, 10);
  const multiple: StitchMultiple | null =
    Number.isFinite(of) && of > 1 ? { of, plus: Number.isFinite(plus) ? plus : 0 } : null;

  const rawCount = parseFloat(count.replace(',', '.'));
  const hasCount = Number.isFinite(rawCount) && rawCount >= 0;
  const rescaled = ratio != null && hasCount ? rescaleStitches(rawCount, ratio, multiple) : null;

  const rawMeasure = parseFloat(measure.replace(',', '.'));
  const hasMeasure = Number.isFinite(rawMeasure) && rawMeasure >= 0;

  // What to swatch on next, and what that would get you. Computed together so the two halves of
  // the answer can never disagree — the predicted gauge is the one for the size being suggested,
  // not for the unrounded number behind it.
  const myNeedleMm = parseToolSize(myNeedle);
  const suggestion = (() => {
    if (myNeedleMm === null || !isUsableGauge(myGauge) || !isUsableGauge(patternGauge)) return null;
    const exact = needleForGauge(myGauge, myNeedleMm, patternGauge);
    if (exact === null) return null;
    const nearest = nearestToolSize(exact, TOOL_SIZES);
    if (nearest === null) return null;
    return { exact, nearest, predicted: gaugeAtNeedle(myGauge, myNeedleMm, nearest) };
  })();

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title">Calculator</ThemedText>
        <ThemedText type="small" themeColor="inkSoft">
          Work out what a pattern&apos;s numbers become at your gauge. Nothing here is saved — it
          changes no pattern and no project.
        </ThemedText>

        <Card style={styles.card}>
          <ThemedText type="smallBold">The pattern&apos;s gauge</ThemedText>
          <GaugeField label="" value={patternGauge} onChange={setPatternGauge} />
        </Card>

        <Card style={styles.card}>
          <ThemedText type="smallBold">Your gauge</ThemedText>
          <ThemedText type="small" themeColor="inkSoft">
            Measured on a washed and blocked swatch, over the same window.
          </ThemedText>
          <GaugeField label="" value={myGauge} onChange={setMyGauge} />
        </Card>

        {/* Restating the same fabric three ways. If these don't agree with the pattern in your
            hands, the numbers below can't be trusted either. */}
        {isUsableGauge(patternGauge) && (
          <Card style={styles.card}>
            <ThemedText type="smallBold">The same gauge, restated</ThemedText>
            <ThemedText type="small" themeColor="inkSoft">
              Identical fabric, three windows. Nothing has been re-gauged here.
            </ThemedText>
            {[
              { width: 10, height: 10, unit: 'cm' as const },
              { width: 4, height: 4, unit: 'inch' as const },
              { width: 1, height: 1, unit: 'inch' as const },
            ].map((w) => (
              <ThemedText key={`${w.width}${w.unit}`} type="small">
                {formatGauge(convertGauge(patternGauge, w))}
              </ThemedText>
            ))}
          </Card>
        )}

        <Card style={styles.card}>
          <ThemedText type="smallBold">Rescale a stitch count</ThemedText>
          {ratio == null ? (
            <ThemedText type="small" themeColor="coralDeep">
              Both gauges need a stitch count over a real width.
            </ThemedText>
          ) : (
            <>
              <ThemedText type="small" themeColor="inkSoft">
                Your fabric is{' '}
                {ratio === 1
                  ? 'the same as the pattern’s'
                  : ratio > 1
                    ? `finer — you need ${round((ratio - 1) * 100, 1)}% more stitches for the same width`
                    : `looser — you need ${round((1 - ratio) * 100, 1)}% fewer stitches for the same width`}
                . Factor ×{round(ratio, 4)}.
              </ThemedText>

              <FormField
                label="The pattern says to cast on"
                value={count}
                onChangeText={setCount}
                keyboardType="numeric"
                placeholder="30"
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
                    placeholder="4"
                  />
                </View>
                <View style={styles.grow}>
                  <FormField
                    label="Plus"
                    value={multiplePlus}
                    onChangeText={setMultiplePlus}
                    keyboardType="numeric"
                    placeholder="2"
                  />
                </View>
              </View>

              {rescaled && (
                <View style={styles.result}>
                  <ThemedText type="title">{rescaled.rounded} sts</ThemedText>
                  <ThemedText type="small" themeColor="inkSoft">
                    Exactly {round(rescaled.exact)} — rounded{' '}
                    {multiple ? `to a multiple of ${multiple.of} plus ${multiple.plus}` : 'to the nearest stitch'}
                    .
                  </ThemedText>
                  {rescaled.adjustedForMultiple && (
                    <ThemedText type="small" themeColor="coralDeep">
                      The repeat moved this further than plain rounding would have.
                    </ThemedText>
                  )}
                  {isUsableGauge(myGauge) && isUsableGauge(patternGauge) ? (
                    <ThemedText type="small" themeColor="sageDeep">
                      {round(stitchesToCm(rescaled.rounded, myGauge) ?? 0, 1)}cm wide at your gauge
                      · the pattern intended{' '}
                      {round(stitchesToCm(rawCount, patternGauge) ?? 0, 1)}cm
                    </ThemedText>
                  ) : null}
                </View>
              )}
            </>
          )}
        </Card>

        {/* The other way a knitter fixes a gauge that doesn't match: change the needle rather
            than the numbers. Sits after the rescale because it is the alternative to it — if you
            can get to the pattern's gauge, none of the arithmetic above is needed. */}
        <Card style={styles.card}>
          <ThemedText type="smallBold">Which needle or hook?</ThemedText>
          <ThemedText type="small" themeColor="inkSoft">
            A stitch comes out about as wide as the tool that made it, so gauge moves roughly with
            1/size. Enough to tell you what to swatch on next — not enough to skip the swatch.
          </ThemedText>

          <SelectField
            label="Craft"
            options={CRAFT_OPTIONS}
            value={sizeCraft}
            onChange={setSizeCraft}
          />
          <SelectField
            label="You swatched on"
            options={toolSizeOptions(myNeedle, sizeCraft)}
            value={myNeedle}
            onChange={setMyNeedle}
          />

          {myNeedleMm === null ? (
            <ThemedText type="small" themeColor="coralDeep">
              Pick the size you swatched on.
            </ThemedText>
          ) : suggestion == null ? (
            <ThemedText type="small" themeColor="coralDeep">
              Both gauges need a stitch count over a real width.
            </ThemedText>
          ) : (
            <View style={styles.result}>
              {suggestion.nearest === myNeedleMm ? (
                <>
                  <ThemedText type="title">{toolSizeLabel(myNeedleMm, sizeCraft)}</ThemedText>
                  <ThemedText type="small" themeColor="sageDeep">
                    You&apos;re already on the closest size there is. Rescaling the stitch counts
                    above is the way to fix the difference.
                  </ThemedText>
                </>
              ) : (
                <>
                  <ThemedText type="title">
                    Try {toolSizeLabel(suggestion.nearest, sizeCraft)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="inkSoft">
                    {suggestion.nearest < myNeedleMm ? 'Smaller' : 'Bigger'} than the{' '}
                    {toolSizeLabel(myNeedleMm, sizeCraft)} you used — you need{' '}
                    {suggestion.nearest < myNeedleMm ? 'more' : 'fewer'} stitches to the
                    centimetre. Exactly {round(suggestion.exact, 2)}mm, snapped to a size that
                    exists.
                  </ThemedText>
                </>
              )}
              {suggestion.predicted ? (
                <ThemedText type="small" themeColor="inkSoft">
                  On {toolSizeLabel(suggestion.nearest, sizeCraft)} you&apos;d expect about{' '}
                  {formatGauge(suggestion.predicted)} — the pattern wants{' '}
                  {formatGauge(patternGauge)}.
                </ThemedText>
              ) : null}
            </View>
          )}
        </Card>

        <Card style={styles.card}>
          <ThemedText type="smallBold">Stitches and rows to measurements</ThemedText>
          <ThemedText type="small" themeColor="inkSoft">
            At your gauge. Row counts are worked out but not rescaled — row gauge is unreliable, so
            length is better worked to a measurement.
          </ThemedText>
          <FormField
            label="How many stitches / rows?"
            value={measure}
            onChangeText={setMeasure}
            keyboardType="numeric"
            placeholder="88"
          />
          {isUsableGauge(myGauge) && hasMeasure ? (
            <View style={styles.result}>
              <ThemedText type="small">
                {measure} sts = {round(stitchesToCm(rawMeasure, myGauge) ?? 0, 1)}cm (
                {round((stitchesToCm(rawMeasure, myGauge) ?? 0) / 2.54, 1)}in)
              </ThemedText>
              <ThemedText type="small">
                {rowsToCm(rawMeasure, myGauge) != null
                  ? `${measure} rows = ${round(rowsToCm(rawMeasure, myGauge) ?? 0, 1)}cm (${round(
                      (rowsToCm(rawMeasure, myGauge) ?? 0) / 2.54,
                      1,
                    )}in)`
                  : 'No row gauge entered, so rows can’t be measured.'}
              </ThemedText>
            </View>
          ) : null}
        </Card>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  content: {
    padding: Spacing.four,
    paddingBottom: Spacing.six + BottomTabInset,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  card: { gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two },
  grow: { flex: 1 },
  result: {
    gap: Spacing.one,
    backgroundColor: Colors.cream,
    borderRadius: 16,
    padding: Spacing.three,
  },
});
