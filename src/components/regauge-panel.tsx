import { Card } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radii, Spacing } from '@/constants/theme';
import { StyleSheet, View } from 'react-native';

import { formatGauge, isUsableGauge, stitchesToCm, stitchRatio } from '@/lib/gauge';
import { describeIntervals, rescaleSection } from '@/lib/regauge';
import type { Gauge, PatternRow, StitchMultiple } from '@/types/knitwit';

// What a section becomes at the knitter's gauge. Read-only, and deliberately so: this is where
// the arithmetic gets checked against a real pattern before anything is allowed to depend on it.
//
// It shows the working, not just the answer. A rescale that quietly moves a stitch count is
// indistinguishable from one that got it wrong, so every adjustment says what it did and why.
export function RegaugePanel({
  rows,
  castOn,
  patternGauge,
  swatchGauge,
  multiple,
  sizeIndex = 0,
}: {
  rows: PatternRow[];
  castOn: number;
  patternGauge: Gauge | null;
  swatchGauge: Gauge | null;
  multiple: StitchMultiple | null;
  sizeIndex?: number;
}) {
  if (!isUsableGauge(patternGauge) || !isUsableGauge(swatchGauge)) return null;

  const ratio = stitchRatio(patternGauge, swatchGauge);
  if (ratio == null) return null;

  const result = rescaleSection(rows, castOn, ratio, multiple, sizeIndex);
  const same = Math.abs(ratio - 1) < 0.0005;

  return (
    <Card style={styles.card}>
      <ThemedText type="smallBold">At your gauge</ThemedText>
      <ThemedText type="small" themeColor="inkSoft">
        {formatGauge(swatchGauge)} against the pattern&apos;s {formatGauge(patternGauge)}.
      </ThemedText>

      {same ? (
        <ThemedText type="small" themeColor="sageDeep">
          Your gauge matches the pattern — nothing needs changing.
        </ThemedText>
      ) : (
        <>
          <View style={styles.result}>
            <ThemedText type="smallBold">
              Cast on {result.castOn.to} instead of {result.castOn.from}
            </ThemedText>
            <ThemedText type="small" themeColor="inkSoft">
              {round(stitchesToCm(result.castOn.to, swatchGauge) ?? 0)}cm wide · the pattern
              intended {round(stitchesToCm(result.castOn.from, patternGauge) ?? 0)}cm
            </ThemedText>
            {result.finalStitches.to !== result.castOn.to && (
              <ThemedText type="small" themeColor="inkSoft">
                Ending on {result.finalStitches.to} sts, where the pattern ends on{' '}
                {result.finalStitches.from}.
              </ThemedText>
            )}
          </View>

          {result.runs.map((r, i) => (
            <View key={i} style={styles.result}>
              <ThemedText type="smallBold" themeColor="inkSoft">
                Rows {r.run.from + 1}–{r.run.to + 1}
              </ThemedText>
              <ThemedText type="small" themeColor="inkSoft">
                Pattern: {describeOriginal(r.run)} ({r.run.before} → {r.run.after} sts)
              </ThemedText>
              <ThemedText type="smallBold">
                Yours: {describeIntervals(r.intervals, r.run.delta)} ({r.before} → {r.after} sts)
              </ThemedText>
              {r.issues.map((issue, n) => (
                <ThemedText key={n} type="small" themeColor="coralDeep">
                  {issue}
                </ThemedText>
              ))}
            </View>
          ))}

          {multiple ? (
            <ThemedText type="small" themeColor="inkSoft">
              Counts kept to a multiple of {multiple.of}
              {multiple.plus ? ` plus ${multiple.plus}` : ''}.
            </ThemedText>
          ) : (
            <ThemedText type="small" themeColor="inkSoft">
              No stitch repeat set for this section, so counts round to the nearest stitch.
            </ThemedText>
          )}
          <ThemedText type="small" themeColor="inkSoft">
            Row counts are unchanged — work to the measurement rather than to a row count.
          </ThemedText>
        </>
      )}
    </Card>
  );
}

// How the pattern's own shaping reads, for comparison — derived from the charted rows, not stored.
//
// Deliberately not expressed as "every Nth row M times" like the rescaled version. That form has
// to account for exactly the rows in the run, and a real pattern's spacings don't decompose that
// cleanly: the gap where one block hands over to the next belongs to neither, so any split of it
// is arbitrary and the totals stop adding up. Naming the spacings and the count is true; a tidy
// decomposition would not be.
function describeOriginal(run: { shapingRows: number[]; delta: number }): string {
  const verb = run.delta > 0 ? 'increase' : 'decrease';
  const count = run.shapingRows.length;
  const gaps: number[] = [];
  for (let i = 1; i < run.shapingRows.length; i++) {
    const gap = run.shapingRows[i] - run.shapingRows[i - 1];
    if (gaps[gaps.length - 1] !== gap) gaps.push(gap);
  }
  const plural = `${count} ${verb}${count === 1 ? '' : 's'}`;
  if (gaps.length === 0) return plural;
  return `${plural}, spaced ${gaps.map((g) => `every ${g === 1 ? 'row' : `${g} rows`}`).join(' then ')}`;
}

function round(n: number): string {
  return String(Math.round(n * 10) / 10);
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two },
  result: {
    gap: Spacing.one,
    backgroundColor: Colors.cream,
    borderRadius: Radii.medium,
    padding: Spacing.three,
  },
});
