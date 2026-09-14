import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Answer, CalcCard, Inputs, NeedsInput } from '@/components/calc-card';
import { GaugeField } from '@/components/gauge-field';
import { FormField, SelectField } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  parseToolSize,
  TOOL_SIZES,
  toolSizeLabel,
  toolSizeOptions,
  type SizeScale,
} from '@/constants/catalogs';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import {
  convertGauge,
  formatGauge,
  gaugeAtNeedle,
  isUsableGauge,
  nearestToolSize,
  needleForGauge,
  rescaleStitches,
  rowsPerCm,
  rowsToCm,
  stitchesPerCm,
  stitchesToCm,
  stitchRatio,
  type StitchMultiple,
} from '@/lib/gauge';
import type { Gauge } from '@/types/knitwit';

// The gauge workbench, arranged by the question you arrive with rather than by the data it needs.
//
// It used to open with two gauge forms and then three cards that consumed them, which meant you
// had to understand the model before you could ask it anything. Each card now owns its question
// end to end: what you tell it, and what it works out.
//
// The two gauges are still shared state behind the scenes, so filling one in on the first card
// carries to the rest. That is a convenience rather than a coupling — every card that needs a
// gauge shows it, so nothing is ever read from somewhere off-screen.

const DEFAULT_PATTERN: Gauge = { stitches: 22, rows: 30, width: 10, height: 10, unit: 'cm' };
const DEFAULT_MINE: Gauge = { stitches: 20, rows: 28, width: 10, height: 10, unit: 'cm' };

const CRAFT_OPTIONS: { value: SizeScale; label: string }[] = [
  { value: 'knit', label: 'Knitting needles' },
  { value: 'crochet', label: 'Crochet hooks' },
];

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
  const [wantCm, setWantCm] = useState('44');
  const [sizeCraft, setSizeCraft] = useState<SizeScale>('knit');
  const [myNeedle, setMyNeedle] = useState('4mm');
  const [tryNeedle, setTryNeedle] = useState('4.5mm');

  const bothGauges = isUsableGauge(patternGauge) && isUsableGauge(myGauge);

  // ---- Rescale a stitch count ----
  const ratio = bothGauges ? stitchRatio(patternGauge, myGauge) : null;
  const of = parseInt(multipleOf, 10);
  const plus = parseInt(multiplePlus, 10);
  const multiple: StitchMultiple | null =
    Number.isFinite(of) && of > 1 ? { of, plus: Number.isFinite(plus) ? plus : 0 } : null;
  const rawCount = parseFloat(count.replace(',', '.'));
  const hasCount = Number.isFinite(rawCount) && rawCount >= 0;
  const rescaled = ratio != null && hasCount ? rescaleStitches(rawCount, ratio, multiple) : null;

  // ---- Which tool ----
  const myNeedleMm = parseToolSize(myNeedle);
  const tryNeedleMm = parseToolSize(tryNeedle);
  const suggestion = (() => {
    if (myNeedleMm === null || !bothGauges) return null;
    const exact = needleForGauge(myGauge, myNeedleMm, patternGauge);
    if (exact === null) return null;
    const nearest = nearestToolSize(exact, TOOL_SIZES);
    if (nearest === null) return null;
    return { exact, nearest, predicted: gaugeAtNeedle(myGauge, myNeedleMm, nearest) };
  })();

  // ---- What gauge on a different tool ----
  const predicted =
    myNeedleMm !== null && tryNeedleMm !== null && isUsableGauge(myGauge)
      ? gaugeAtNeedle(myGauge, myNeedleMm, tryNeedleMm)
      : null;

  // ---- Counts to measurements, and back ----
  const rawMeasure = parseFloat(measure.replace(',', '.'));
  const hasMeasure = Number.isFinite(rawMeasure) && rawMeasure >= 0;
  const rawWant = parseFloat(wantCm.replace(',', '.'));
  const hasWant = Number.isFinite(rawWant) && rawWant > 0;

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title">Calculator</ThemedText>
        <ThemedText type="small" themeColor="inkSoft">
          Each card answers one question. What you fill in sits on the white; what it works out
          sits in the tinted box. Nothing here is saved — it changes no pattern and no project.
        </ThemedText>

        <CalcCard
          title="Rescale a stitch count"
          question="The pattern says cast on this many, but you don't knit at its gauge. How many should you cast on?">
          <Inputs>
            <GaugeField
              label="The pattern's gauge"
              value={patternGauge}
              onChange={setPatternGauge}
            />
            <GaugeField
              label="Your gauge"
              hint="Measured on a washed and blocked swatch, over the same window."
              value={myGauge}
              onChange={setMyGauge}
            />
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
          </Inputs>

          {rescaled && ratio != null && isUsableGauge(myGauge) && isUsableGauge(patternGauge) ? (
            <Answer label="Cast on" value={`${rescaled.rounded} sts`}>
              <ThemedText type="small" themeColor="inkSoft">
                Exactly {round(rescaled.exact)} — rounded{' '}
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
              </ThemedText>
              {rescaled.adjustedForMultiple && (
                <ThemedText type="small" themeColor="coralDeep">
                  The repeat moved this further than plain rounding would have.
                </ThemedText>
              )}
              <ThemedText type="small" themeColor="sageDeep">
                {round(stitchesToCm(rescaled.rounded, myGauge) ?? 0, 1)}cm wide at your gauge · the
                pattern intended {round(stitchesToCm(rawCount, patternGauge) ?? 0, 1)}cm
              </ThemedText>
            </Answer>
          ) : (
            <NeedsInput>
              Both gauges need a stitch count over a real width, and a number to rescale.
            </NeedsInput>
          )}
        </CalcCard>

        <CalcCard
          title="Which needle or hook?"
          question="Your swatch didn't match. What size should you try next to hit the pattern's gauge?">
          <Inputs>
            <GaugeField
              label="The pattern's gauge"
              value={patternGauge}
              onChange={setPatternGauge}
            />
            <GaugeField label="Your gauge" value={myGauge} onChange={setMyGauge} />
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
          </Inputs>

          {suggestion === null || myNeedleMm === null ? (
            <NeedsInput>Both gauges, and the size you swatched on.</NeedsInput>
          ) : suggestion.nearest === myNeedleMm ? (
            <Answer label="Stay on" value={toolSizeLabel(myNeedleMm, sizeCraft)}>
              <ThemedText type="small" themeColor="inkSoft">
                You&apos;re already on the closest size there is. Rescaling the stitch counts is
                the way to fix what&apos;s left.
              </ThemedText>
            </Answer>
          ) : (
            <Answer label="Try" value={toolSizeLabel(suggestion.nearest, sizeCraft)}>
              <ThemedText type="small" themeColor="inkSoft">
                {suggestion.nearest < myNeedleMm ? 'Smaller' : 'Bigger'} than the{' '}
                {toolSizeLabel(myNeedleMm, sizeCraft)} you used — you need{' '}
                {suggestion.nearest < myNeedleMm ? 'more' : 'fewer'} stitches to the centimetre.
                Exactly {round(suggestion.exact, 2)}mm, snapped to a size that exists.
              </ThemedText>
              {suggestion.predicted ? (
                <ThemedText type="small" themeColor="sageDeep">
                  You&apos;d expect about {formatGauge(suggestion.predicted)} — the pattern wants{' '}
                  {formatGauge(patternGauge)}.
                </ThemedText>
              ) : null}
            </Answer>
          )}
          <ThemedText type="small" themeColor="inkSoft">
            A stitch comes out about as wide as the tool that made it, so gauge moves roughly with
            1/size. Enough to tell you what to swatch on next — not enough to skip the swatch.
          </ThemedText>
        </CalcCard>

        <CalcCard
          title="What gauge on a different tool?"
          question="You have one swatch and want to know what the same yarn would do on another size.">
          <Inputs>
            <GaugeField label="Your gauge" value={myGauge} onChange={setMyGauge} />
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
            <SelectField
              label="What if you used"
              options={toolSizeOptions(tryNeedle, sizeCraft)}
              value={tryNeedle}
              onChange={setTryNeedle}
            />
          </Inputs>

          {predicted && tryNeedleMm !== null && myNeedleMm !== null ? (
            <Answer
              label={`On ${toolSizeLabel(tryNeedleMm, sizeCraft)} you'd expect`}
              value={formatGauge(predicted)}>
              <ThemedText type="small" themeColor="inkSoft">
                Against {formatGauge(myGauge)} on the {toolSizeLabel(myNeedleMm, sizeCraft)} you
                used. An estimate — swatch it before you trust it.
              </ThemedText>
            </Answer>
          ) : (
            <NeedsInput>Your gauge, and both sizes.</NeedsInput>
          )}
        </CalcCard>

        <CalcCard
          title="How wide is this many stitches?"
          question="You know the stitch or row count and want the measurement it comes to.">
          <Inputs>
            <GaugeField label="Your gauge" value={myGauge} onChange={setMyGauge} />
            <FormField
              label="How many stitches / rows?"
              value={measure}
              onChangeText={setMeasure}
              keyboardType="numeric"
              placeholder="88"
            />
          </Inputs>

          {hasMeasure && isUsableGauge(myGauge) ? (
            <Answer
              label={`${rawMeasure} stitches come to`}
              value={`${round(stitchesToCm(rawMeasure, myGauge) ?? 0, 1)}cm`}>
              <ThemedText type="small" themeColor="inkSoft">
                {round((stitchesToCm(rawMeasure, myGauge) ?? 0) / 2.54, 1)}in wide.{' '}
                {rowsToCm(rawMeasure, myGauge) != null
                  ? `The same number of rows comes to ${round(rowsToCm(rawMeasure, myGauge) ?? 0, 1)}cm long.`
                  : 'No row gauge, so there is no length to give.'}
              </ThemedText>
              <ThemedText type="small" themeColor="inkSoft">
                Row counts are worked out but never rescaled — row gauge is unreliable, so length
                is better worked to a measurement than to a count.
              </ThemedText>
            </Answer>
          ) : (
            <NeedsInput>Your gauge, and a number of stitches or rows.</NeedsInput>
          )}
        </CalcCard>

        <CalcCard
          title="How many stitches is this wide?"
          question="You know the measurement you want and need the count to cast on.">
          <Inputs>
            <GaugeField label="Your gauge" value={myGauge} onChange={setMyGauge} />
            <FormField
              label="How many centimetres?"
              value={wantCm}
              onChangeText={setWantCm}
              keyboardType="numeric"
              placeholder="44"
            />
          </Inputs>

          {hasWant && isUsableGauge(myGauge) ? (
            <Answer
              label={`${rawWant}cm across takes`}
              value={`${Math.round(rawWant * stitchesPerCm(myGauge))} sts`}>
              <ThemedText type="small" themeColor="inkSoft">
                Exactly {round(rawWant * stitchesPerCm(myGauge))} — rounded to the nearest stitch.
                {rowsPerCm(myGauge) > 0
                  ? ` ${rawWant}cm of length takes about ${Math.round(rawWant * rowsPerCm(myGauge))} rows.`
                  : ''}
              </ThemedText>
            </Answer>
          ) : (
            <NeedsInput>Your gauge, and a measurement.</NeedsInput>
          )}
        </CalcCard>

        <CalcCard
          title="Say a gauge another way"
          question="A pattern gives its gauge per 4in and yours is per 10cm. Are they the same fabric?">
          <Inputs>
            <GaugeField
              label="The gauge to restate"
              value={patternGauge}
              onChange={setPatternGauge}
            />
          </Inputs>

          {isUsableGauge(patternGauge) ? (
            <Answer
              label="The same fabric, three windows"
              value={formatGauge(
                convertGauge(patternGauge, { width: 10, height: 10, unit: 'cm' }),
              )}>
              {[
                { width: 4, height: 4, unit: 'inch' as const },
                { width: 1, height: 1, unit: 'inch' as const },
              ].map((w) => (
                <ThemedText key={`${w.width}${w.unit}`} type="small" themeColor="inkSoft">
                  {formatGauge(convertGauge(patternGauge, w))}
                </ThemedText>
              ))}
              <ThemedText type="small" themeColor="inkSoft">
                Nothing has been re-gauged here. If these don&apos;t match the pattern in your
                hands, none of the other cards can be trusted either.
              </ThemedText>
            </Answer>
          ) : (
            <NeedsInput>A gauge with a stitch count over a real width.</NeedsInput>
          )}
        </CalcCard>
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
  row: { flexDirection: 'row', gap: Spacing.two },
  grow: { flex: 1 },
});
