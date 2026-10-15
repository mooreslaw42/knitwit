import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { CrochetChart, CrochetRowStrip } from '@/components/crochet-chart';
import { ThemedText } from '@/components/themed-text';
import { STITCHES } from '@/constants/catalogs';
import { Colors, Fonts, Radii, Spacing } from '@/constants/theme';
import { chartLimitNote, KNIT_CHART_LIMITS, rowsWithinBudget } from '@/lib/chart-limits';
import { resolveRowGroups, rowStitchesAfter, sectionRowCounts } from '@/lib/knitwit-helpers';
import type { PatternMaterial, PatternRow, TechniqueCraft } from '@/types/knitwit';

// A knitting chart, drawn the way knitters read one: bottom row first, stitches right-to-left,
// one cell per stitch worked, row numbers down the right edge. Wrong-side rows are shaded so the
// RS/WS alternation is visible at a glance.
const CELL = 22;
// Charts are a glance-able overview, not a canvas — cap the grid so a 200-stitch row or a
// 400-row section can't spray thousands of views onto the screen.
// Shared with the crochet chart. The old ceiling of 40 cells a row was narrower than an ordinary
// sweater body, and a row that ran past it said so only with a small ellipsis cell.
const LIMITS = KNIT_CHART_LIMITS;

// A cell remembers which stitch group produced it, so tapping any cell of a run ("k to last 1"
// draws 18 cells but is one editable group) selects that group. `color` is set only for colourwork
// — a cell worked in a slot that carries a hex colour — and turns the cell into a painted square.
type Cell = { type: string; symbol: string; groupIndex: number; color?: string };

export type ChartSelection = { rowIndex: number; groupIndex: number };

// Slot id → hex colour, for the colourwork cells. Empty for an ordinary pattern, whose chart stays
// monochrome symbols.
function slotColorMap(materials?: PatternMaterial[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of materials ?? []) if (m.color) map.set(m.id, m.color);
  return map;
}

function rowCells(
  row: PatternRow,
  stitchesBefore: number,
  sizeIndex = 0,
  slotColor?: Map<string, string>,
): { cells: Cell[]; clipped: boolean } {
  const cells: Cell[] = [];
  const resolved = resolveRowGroups(row, stitchesBefore, sizeIndex);
  for (let groupIndex = 0; groupIndex < resolved.length; groupIndex++) {
    const group = resolved[groupIndex].group;
    const def = STITCHES[group.type];
    const color = group.materialSlot ? slotColor?.get(group.materialSlot) : undefined;
    for (let i = 0; i < resolved[groupIndex].units; i++) {
      if (cells.length >= LIMITS.maxStitchesPerRow) return { cells, clipped: true };
      cells.push({ type: group.type, symbol: def ? def.symbol : '?', groupIndex, color });
    }
  }
  return { cells, clipped: false };
}

// One row of the chart on its own — the "you are here" strip the counter shows above the row
// number, using the same cells and symbols as the full chart.
export function StitchRowStrip({
  rows,
  castOn,
  rowIndex,
  craft = 'knit',
  showStitchCount = false,
  sizeIndex = 0,
  materials,
}: {
  rows: PatternRow[];
  castOn: number;
  rowIndex: number;
  craft?: TechniqueCraft;
  sizeIndex?: number;
  // The live running stitch count after this row — what you should have on the needle.
  showStitchCount?: boolean;
  // The pattern's material slots, so a colourwork slot's colour can paint its cells. See
  // slotColorMap.
  materials?: PatternMaterial[];
}) {
  const row = rows[rowIndex];
  if (!row) return null;

  const before = sectionRowCounts(rows, castOn, sizeIndex);
  const slotColor = slotColorMap(materials);
  const { cells, clipped } = rowCells(row, before[rowIndex], sizeIndex, slotColor);
  const ws = row.side === 'WS';
  const after = rowStitchesAfter(row, before[rowIndex], sizeIndex);

  // Colourwork is drawn as the grid whichever craft it is — a tapestry-crochet graph is a grid of
  // colours, not the stitch-height diagram the crochet chart draws. So the diagram is only used
  // when there are no colours to show.
  const colorwork = cells.some((c) => c.color);
  const crochet = craft === 'crochet' && !colorwork;

  return (
    <View style={styles.stripWrap}>
      <ThemedText type="small" themeColor="inkSoft">
        Row {rowIndex + 1} · {row.side}
        {row.marker ? ' · 📍' : ''}
        {showStitchCount ? ` · ${after} sts` : ''}
      </ThemedText>
      {crochet ? (
        <CrochetRowStrip row={row} before={before[rowIndex]} sizeIndex={sizeIndex} />
      ) : (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.strip}>
          {clipped && (
            <View style={[styles.cell, ws && styles.cellWs, styles.clipCell]}>
              <ThemedText style={styles.symbol}>…</ThemedText>
            </View>
          )}
          {cells.map((c, i) => (
            <View
              key={i}
              style={[styles.cell, ws && styles.cellWs, c.color ? { backgroundColor: c.color } : null]}>
              {c.color ? null : <ThemedText style={styles.symbol}>{c.symbol}</ThemedText>}
            </View>
          ))}
        </View>
      </ScrollView>
      )}
    </View>
  );
}

export function StitchChart({
  rows,
  castOn,
  craft = 'knit',
  selected,
  onSelectStitch,
  sizeIndex = 0,
  worked,
  onRowLayout,
  materials,
}: {
  rows: PatternRow[];
  castOn: number;
  // Crochet gets its own diagram rather than this grid. The two aren't variants of one drawing:
  // a knitting chart is one square per stitch, a crochet chart is a picture of the stitches at
  // their real heights. See crochet-chart.tsx. The exception is colourwork (below): a colourwork
  // crochet graph is a grid of colours, so it uses this chart whatever the craft.
  craft?: TechniqueCraft;
  sizeIndex?: number;
  selected?: ChartSelection | null;
  onSelectStitch?: (selection: ChartSelection) => void;
  // How many rows are finished, when the chart is being read next to a counter. Those rows fade
  // back and the one being worked is outlined. Undefined means "not counting" — the editor and
  // the pattern screens draw the chart plain, where no row is further along than any other.
  worked?: number;
  // Where each row line sits, so a caller owning the scroller can keep the current row in view.
  onRowLayout?: (index: number, y: number) => void;
  // The pattern's material slots, so colourwork cells can be painted their slot's colour and the
  // legend can name each colour. See slotColorMap.
  materials?: PatternMaterial[];
}) {
  if (rows.length === 0) return null;
  const slotColor = slotColorMap(materials);
  const colorwork =
    slotColor.size > 0 &&
    rows.some((row) => row.stitches.some((g) => g.materialSlot && slotColor.has(g.materialSlot)));
  if (craft === 'crochet' && !colorwork) {
    return <CrochetChart rows={rows} castOn={castOn} sizeIndex={sizeIndex} worked={worked} />;
  }

  const before = sectionRowCounts(rows, castOn, sizeIndex);
  // Measured before it is cut, because how many rows fit depends on how wide they are.
  const all = rows.map((row, index) => ({
    row,
    index,
    ...rowCells(row, before[index], sizeIndex, slotColor),
  }));
  const rowsShown = rowsWithinBudget(
    all.map((d) => d.cells.length),
    LIMITS,
  );
  const drawn = all.slice(0, rowsShown);
  const note = chartLimitNote({
    rowsShown,
    rowsTotal: rows.length,
    clippedRows: drawn.filter((d) => d.clipped).length,
    maxStitchesPerRow: LIMITS.maxStitchesPerRow,
  });
  const width = Math.max(1, ...drawn.map((d) => d.cells.length));
  const gridWidth = width * CELL;

  // Which symbols actually appear, for the legend.
  const usedTypes = Array.from(new Set(drawn.flatMap((d) => d.cells.map((c) => c.type))));
  // Which colour slots actually appear, so the colour key lists only colours the chart shows.
  const usedSlots = new Set(
    drawn.flatMap((d) => d.row.stitches.map((g) => g.materialSlot).filter((s): s is string => !!s)),
  );

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* Stitch numbers, right-to-left like the chart below them. */}
          <View style={styles.line}>
            <View style={[styles.grid, { width: gridWidth }]}>
              {Array.from({ length: width }, (_, i) => (
                <View key={i} style={styles.headCell}>
                  <ThemedText style={styles.headText}>{i + 1}</ThemedText>
                </View>
              ))}
            </View>
            <View style={styles.rowNum} />
          </View>

          {/* Rows, bottom-up: the last worked row is drawn at the top. */}
          {[...drawn].reverse().map((d) => {
            const ws = d.row.side === 'WS';
            const done = worked != null && d.index < worked;
            const current = worked != null && d.index === worked;
            return (
              <View
                key={d.row.id}
                onLayout={
                  onRowLayout ? (e) => onRowLayout(d.index, e.nativeEvent.layout.y) : undefined
                }
                style={[styles.line, done && styles.lineDone, current && styles.lineCurrent]}>
                <View style={[styles.grid, { width: gridWidth }]}>
                  {/* A row the parser could not chart is still a row. Blank, with a number beside
                      it and nothing else, it reads as a gap in the fabric rather than a gap in
                      what the app understood. */}
                  {d.cells.length === 0 && (
                    <ThemedText type="small" themeColor="inkSoft" style={styles.uncharted}>
                      not charted
                    </ThemedText>
                  )}
                  {d.clipped && (
                    <View style={[styles.cell, ws && styles.cellWs, styles.clipCell]}>
                      <ThemedText style={styles.symbol}>…</ThemedText>
                    </View>
                  )}
                  {d.cells.map((c, i) => {
                    const isSelected =
                      !!selected &&
                      selected.rowIndex === d.index &&
                      selected.groupIndex === c.groupIndex;
                    const style = [
                      styles.cell,
                      ws && styles.cellWs,
                      c.color ? { backgroundColor: c.color } : null,
                      isSelected && styles.cellSelected,
                    ];
                    const glyph = c.color ? null : (
                      <ThemedText style={styles.symbol}>{c.symbol}</ThemedText>
                    );
                    return onSelectStitch ? (
                      <Pressable
                        key={i}
                        style={style}
                        onPress={() =>
                          onSelectStitch({ rowIndex: d.index, groupIndex: c.groupIndex })
                        }>
                        {glyph}
                      </Pressable>
                    ) : (
                      <View key={i} style={style}>
                        {glyph}
                      </View>
                    );
                  })}
                </View>
                <View style={styles.rowNum}>
                  <ThemedText style={[styles.rowNumText, current && styles.rowNumCurrent]}>
                    {d.index + 1}
                    {d.row.marker ? ' 📍' : ''}
                  </ThemedText>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {note ? (
        <ThemedText type="small" themeColor="coralDeep">
          {note}
        </ThemedText>
      ) : null}

      <View style={styles.legend}>
        {colorwork
          ? // A colour key: which swatch is which yarn. The stitch is the same in every cell, so the
            // symbol legend would say nothing — the colours are the whole chart.
            (materials ?? [])
              .filter((m) => m.color && usedSlots.has(m.id))
              .map((m) => (
                <View key={m.id} style={styles.legendItem}>
                  <View style={[styles.legendCell, { backgroundColor: m.color }]} />
                  <ThemedText type="small" themeColor="inkSoft">
                    {m.short} · {m.label}
                  </ThemedText>
                </View>
              ))
          : usedTypes.map((t) => {
              const def = STITCHES[t];
              if (!def) return null;
              return (
                <View key={t} style={styles.legendItem}>
                  <View style={styles.legendCell}>
                    <ThemedText style={styles.symbol}>{def.symbol}</ThemedText>
                  </View>
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
  uncharted: { paddingLeft: Spacing.two, alignSelf: 'center' },
  // Worked rows recede rather than vanish: the chart is still the map of the whole piece, and the
  // boundary between faded and solid is what shows at a glance how far up it you are.
  lineDone: { opacity: 0.3 },
  // The cells carry their own backgrounds, so tinting the line behind them shows only in the
  // margins. The edge marker is what actually reads.
  lineCurrent: {
    borderLeftColor: Colors.blushDeep,
  },
  // The edge marker alone is easy to miss on a wide chart; the row number is the other end of the
  // same line, so marking both means one of them is always near where you are looking.
  rowNumCurrent: {
    color: Colors.blushDeep,
    fontFamily: Fonts.bodySemibold,
  },
  wrap: {
    gap: Spacing.two,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    // Reserved on every row so marking the current one does not shift the grid sideways.
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  // row-reverse puts stitch 1 on the right, the way a chart is read; centring makes narrower
  // rows taper symmetrically inside the widest row.
  grid: {
    flexDirection: 'row-reverse',
    justifyContent: 'center',
  },
  cell: {
    width: CELL,
    height: CELL,
    borderWidth: 1,
    borderColor: Colors.inkSoft,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellWs: {
    backgroundColor: Colors.creamDeep,
  },
  // Every cell of the selected group lights up, so it's clear a whole run is being edited.
  cellSelected: {
    backgroundColor: Colors.blush,
    borderColor: Colors.ink,
  },
  clipCell: {
    borderStyle: 'dashed',
  },
  symbol: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    lineHeight: 16,
    color: Colors.ink,
  },
  headCell: {
    width: CELL,
    height: CELL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headText: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 10,
    lineHeight: 12,
    color: Colors.inkSoft,
  },
  rowNum: {
    width: 44,
    paddingLeft: Spacing.two,
    justifyContent: 'center',
  },
  rowNumText: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 11,
    lineHeight: 14,
    color: Colors.inkSoft,
  },
  stripWrap: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  // Same right-to-left reading order as the chart.
  strip: {
    flexDirection: 'row-reverse',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  legendCell: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: Colors.inkSoft,
    backgroundColor: Colors.white,
    borderRadius: Radii.small / 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
