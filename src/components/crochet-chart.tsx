import { ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Text as SvgText } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { STITCHES } from '@/constants/catalogs';
import { Colors, Spacing } from '@/constants/theme';
import { resolveRowGroups, sectionRowCounts } from '@/lib/knitwit-helpers';
import type { PatternRow } from '@/types/knitwit';

// A crochet chart, drawn the way crocheters read one — which is not the way knitters do.
//
// A knitting chart is a grid: every stitch is one square, every row the same height. Crochet is a
// diagram: a stitch is a little drawing of itself, its height is the height of the stitch, and it
// sits above the stitch it was worked into. A double crochet is three times the height of a
// single because it is three times the height of a single in the fabric. Forcing crochet into the
// knitters' grid loses the one thing the chart is for.
//
// Rows alternate direction, because the work is turned: a right-side row reads right-to-left, the
// wrong-side row above it reads left-to-right. Drawn bottom-up, as worked.

// Width of one stitch column, and the height of a single crochet. Everything else is a multiple.
const COL = 18;
const UNIT = 14;

// Stitch heights, in units of a single crochet. This is the whole reason for the component: it is
// what makes a chart of trebles look like trebles.
const HEIGHTS: Record<string, number> = {
  ch: 0.7,
  slst: 0.5,
  sc: 1,
  scinc: 1,
  sc2tog: 1,
  hdc: 1.6,
  dc: 2.4,
  dcinc: 2.4,
  dc2tog: 2.4,
  shell: 2.4,
  tr: 3.2,
  co: 0.7,
  bo: 0.6,
  pm: 1,
};

const MAX_STITCHES = 40;
const MAX_ROWS = 30;

const heightOf = (type: string) => (HEIGHTS[type] ?? 1) * UNIT;

// One stitch, drawn at the origin with its base at y=0 and growing upward. The caller translates
// it into place, so every symbol here is written once in its own little coordinate space.
function StitchSymbol({ type, colour }: { type: string; colour: string }) {
  const h = heightOf(type);
  const stroke = colour;
  const w = 1.6;

  // The post every tall stitch is built on, plus the bar across its top.
  const post = <Line x1={0} y1={0} x2={0} y2={-h} stroke={stroke} strokeWidth={w} strokeLinecap="round" />;
  const topBar = (
    <Line x1={-5} y1={-h} x2={5} y2={-h} stroke={stroke} strokeWidth={w} strokeLinecap="round" />
  );
  // The diagonals through the post that say how many yarn-overs the stitch has: one for a double,
  // two for a treble. This is the part a crocheter actually counts.
  const slash = (at: number) => (
    <Line
      key={at}
      x1={-4}
      y1={-h * at + 3}
      x2={4}
      y2={-h * at - 3}
      stroke={stroke}
      strokeWidth={w}
      strokeLinecap="round"
    />
  );

  switch (type) {
    case 'ch':
      // An open oval. A chain is a loop, and it is drawn as one.
      return <Ellipse cx={0} cy={-h / 2} rx={5} ry={h / 2} stroke={stroke} strokeWidth={w} fill="none" />;
    case 'slst':
      return <Circle cx={0} cy={-h / 2} r={2.6} fill={stroke} />;
    case 'sc':
      // A cross.
      return (
        <G>
          <Line x1={-4.5} y1={-h} x2={4.5} y2={0} stroke={stroke} strokeWidth={w} strokeLinecap="round" />
          <Line x1={4.5} y1={-h} x2={-4.5} y2={0} stroke={stroke} strokeWidth={w} strokeLinecap="round" />
        </G>
      );
    case 'hdc':
      return (
        <G>
          {post}
          {topBar}
        </G>
      );
    case 'dc':
      return (
        <G>
          {post}
          {topBar}
          {slash(0.5)}
        </G>
      );
    case 'tr':
      return (
        <G>
          {post}
          {topBar}
          {slash(0.38)}
          {slash(0.62)}
        </G>
      );
    // An increase is two stitches sharing one base: the V is the point of the symbol.
    case 'scinc':
      return (
        <G>
          <Path d={`M -5 ${-h} L 0 0 L 5 ${-h}`} stroke={stroke} strokeWidth={w} fill="none" strokeLinejoin="round" />
          <Line x1={-7} y1={-h} x2={-3} y2={-h} stroke={stroke} strokeWidth={w} strokeLinecap="round" />
          <Line x1={3} y1={-h} x2={7} y2={-h} stroke={stroke} strokeWidth={w} strokeLinecap="round" />
        </G>
      );
    case 'dcinc':
      return (
        <G>
          <Path d={`M -6 ${-h} L 0 0 L 6 ${-h}`} stroke={stroke} strokeWidth={w} fill="none" strokeLinejoin="round" />
          <Line x1={-9} y1={-h} x2={-3} y2={-h} stroke={stroke} strokeWidth={w} strokeLinecap="round" />
          <Line x1={3} y1={-h} x2={9} y2={-h} stroke={stroke} strokeWidth={w} strokeLinecap="round" />
          <Line x1={-4.5} y1={-h * 0.55} x2={-1.5} y2={-h * 0.45} stroke={stroke} strokeWidth={w} />
          <Line x1={4.5} y1={-h * 0.55} x2={1.5} y2={-h * 0.45} stroke={stroke} strokeWidth={w} />
        </G>
      );
    // A decrease is the increase upside down: two bases converging on one top.
    case 'sc2tog':
      return (
        <G>
          <Path d={`M -5 0 L 0 ${-h} L 5 0`} stroke={stroke} strokeWidth={w} fill="none" strokeLinejoin="round" />
          <Line x1={-6} y1={-h} x2={6} y2={-h} stroke={stroke} strokeWidth={w} strokeLinecap="round" />
        </G>
      );
    case 'dc2tog':
      return (
        <G>
          <Path d={`M -6 0 L 0 ${-h} L 6 0`} stroke={stroke} strokeWidth={w} fill="none" strokeLinejoin="round" />
          <Line x1={-7} y1={-h} x2={7} y2={-h} stroke={stroke} strokeWidth={w} strokeLinecap="round" />
          <Line x1={-4} y1={-h * 0.6} x2={-1} y2={-h * 0.5} stroke={stroke} strokeWidth={w} />
          <Line x1={4} y1={-h * 0.6} x2={1} y2={-h * 0.5} stroke={stroke} strokeWidth={w} />
        </G>
      );
    // Five doubles fanning out of a single stitch below.
    case 'shell':
      return (
        <G>
          {/* `transform` rather than the rotation/origin props: those are React Native only, and
              react-native-svg passes them straight through to the DOM on web, where they are not
              valid attributes and the fan simply doesn't fan. */}
          {[-24, -12, 0, 12, 24].map((deg) => (
            <G key={deg} transform={`rotate(${deg} 0 0)`}>
              <Line x1={0} y1={0} x2={0} y2={-h} stroke={stroke} strokeWidth={w} strokeLinecap="round" />
              <Line x1={-3.5} y1={-h} x2={3.5} y2={-h} stroke={stroke} strokeWidth={w} strokeLinecap="round" />
            </G>
          ))}
        </G>
      );
    case 'pm':
      return <Circle cx={0} cy={-h / 2} r={3.5} stroke={stroke} strokeWidth={w} fill="none" />;
    default:
      // Anything without a drawing falls back to its letter rather than to nothing, so a stitch
      // the chart doesn't know is visible as a gap in knowledge rather than a gap in the fabric.
      return (
        <SvgText x={0} y={-h / 3} fontSize={11} fill={stroke} textAnchor="middle">
          {STITCHES[type]?.abbr ?? '?'}
        </SvgText>
      );
  }
}

type Placed = { type: string; groupIndex: number };

function rowStitches(row: PatternRow, before: number, sizeIndex: number): Placed[] {
  const out: Placed[] = [];
  for (const [groupIndex, r] of resolveRowGroups(row, before, sizeIndex).entries()) {
    for (let i = 0; i < r.units && out.length < MAX_STITCHES; i++) {
      out.push({ type: r.group.type, groupIndex });
    }
  }
  return out;
}

// One row of the diagram, for the counter's "you are here" strip. Same symbols at the same
// heights, so the strip and the full chart are recognisably the same drawing.
export function CrochetRowStrip({
  row,
  before,
  sizeIndex = 0,
}: {
  row: PatternRow;
  before: number;
  sizeIndex?: number;
}) {
  const stitches = rowStitches(row, before, sizeIndex);
  if (stitches.length === 0) return null;

  const reversed = row.side === 'WS';
  const tall = Math.max(...stitches.map((s) => heightOf(s.type)), UNIT);
  const width = stitches.length * COL + 12;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <Svg width={width} height={tall + 8}>
        {stitches.map((s, j) => {
          const slot = reversed ? j : stitches.length - 1 - j;
          return (
            <G key={j} x={6 + slot * COL + COL / 2} y={tall + 4}>
              <StitchSymbol type={s.type} colour={Colors.ink} />
            </G>
          );
        })}
      </Svg>
    </ScrollView>
  );
}

export function CrochetChart({
  rows,
  castOn,
  sizeIndex = 0,
  worked,
}: {
  rows: PatternRow[];
  castOn: number;
  sizeIndex?: number;
  // As in the knitting chart: how many rows are finished, so they can fade back. Undefined means
  // the diagram is not being read beside a counter and every row is drawn alike.
  worked?: number;
}) {
  if (rows.length === 0) return null;

  const before = sectionRowCounts(rows, castOn, sizeIndex);
  const drawn = rows.slice(0, MAX_ROWS).map((row, index) => ({
    row,
    index,
    stitches: rowStitches(row, before[index], sizeIndex),
  }));

  const widest = Math.max(1, ...drawn.map((d) => d.stitches.length));
  // Each row is as tall as its tallest stitch, so a row of chains takes the space of chains.
  const rowHeights = drawn.map((d) => Math.max(...d.stitches.map((s) => heightOf(s.type)), UNIT) + 6);
  const chartHeight = rowHeights.reduce((a, b) => a + b, 0) + 14;
  const chartWidth = widest * COL + 34;

  // Baseline of each row, measured from the bottom of the drawing — row 0 sits lowest, as worked.
  const baselines: number[] = [];
  let y = chartHeight - 4;
  for (const h of rowHeights) {
    y -= h;
    baselines.push(y + h);
  }

  const usedTypes = Array.from(new Set(drawn.flatMap((d) => d.stitches.map((s) => s.type))));

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Svg width={chartWidth} height={chartHeight}>
          {drawn.map((d, i) => {
            // The work is turned every row, so a wrong-side row is read the other way. Drawing it
            // reversed is what makes the diagram match the fabric rather than the instructions.
            const reversed = d.row.side === 'WS';
            const count = d.stitches.length;
            const done = worked != null && d.index < worked;
            return (
              <G key={d.row.id} opacity={done ? 0.3 : 1}>
                <SvgText
                  x={chartWidth - 6}
                  y={baselines[i] - 3}
                  fontSize={10}
                  fill={Colors.inkSoft}
                  textAnchor="end">
                  {d.index + 1}
                </SvgText>
                {d.stitches.map((s, j) => {
                  // Right-to-left on a right-side row, left-to-right on a wrong-side one.
                  const slot = reversed ? j : count - 1 - j;
                  const x = 14 + slot * COL + COL / 2;
                  return (
                    <G key={j} x={x} y={baselines[i]}>
                      <StitchSymbol type={s.type} colour={Colors.ink} />
                    </G>
                  );
                })}
              </G>
            );
          })}
        </Svg>
      </ScrollView>

      {rows.length > MAX_ROWS ? (
        <ThemedText type="small" themeColor="inkSoft">
          Showing the first {MAX_ROWS} rows.
        </ThemedText>
      ) : null}

      <ThemedText type="small" themeColor="inkSoft">
        Read bottom-up. Right-side rows run right-to-left, wrong-side rows the other way, as the
        work is turned. A stitch&apos;s height is its height in the fabric.
      </ThemedText>

      <View style={styles.legend}>
        {usedTypes.map((t) => {
          const def = STITCHES[t];
          if (!def) return null;
          const h = heightOf(t);
          return (
            <View key={t} style={styles.legendItem}>
              <Svg width={20} height={h + 6}>
                <G x={10} y={h + 2}>
                  <StitchSymbol type={t} colour={Colors.ink} />
                </G>
              </Svg>
              <ThemedText type="small" themeColor="inkSoft">
                {def.abbr} · {def.label}
              </ThemedText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: Spacing.three,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.one,
  },
});
