import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { STITCHES } from '@/constants/catalogs';
import { Colors, Fonts, Radii, Spacing } from '@/constants/theme';
import { resolveRowGroups, rowStitchesAfter, sectionRowCounts } from '@/lib/knitwit-helpers';
import type { PatternRow } from '@/types/knitwit';

// A knitting chart, drawn the way knitters read one: bottom row first, stitches right-to-left,
// one cell per stitch worked, row numbers down the right edge. Wrong-side rows are shaded so the
// RS/WS alternation is visible at a glance.
const CELL = 22;
// Charts are a glance-able overview, not a canvas — cap the grid so a 200-stitch row or a
// 400-row section can't spray thousands of views onto the screen.
const MAX_CELLS = 40;
const MAX_ROWS = 60;

// A cell remembers which stitch group produced it, so tapping any cell of a run ("k to last 1"
// draws 18 cells but is one editable group) selects that group.
type Cell = { type: string; symbol: string; groupIndex: number };

export type ChartSelection = { rowIndex: number; groupIndex: number };

function rowCells(row: PatternRow, stitchesBefore: number): { cells: Cell[]; clipped: boolean } {
  const cells: Cell[] = [];
  const resolved = resolveRowGroups(row, stitchesBefore);
  for (let groupIndex = 0; groupIndex < resolved.length; groupIndex++) {
    const def = STITCHES[resolved[groupIndex].group.type];
    for (let i = 0; i < resolved[groupIndex].units; i++) {
      if (cells.length >= MAX_CELLS) return { cells, clipped: true };
      cells.push({ type: resolved[groupIndex].group.type, symbol: def ? def.symbol : '?', groupIndex });
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
  showStitchCount = false,
}: {
  rows: PatternRow[];
  castOn: number;
  rowIndex: number;
  // The live running stitch count after this row — what you should have on the needle.
  showStitchCount?: boolean;
}) {
  const row = rows[rowIndex];
  if (!row) return null;

  const before = sectionRowCounts(rows, castOn);
  const { cells, clipped } = rowCells(row, before[rowIndex]);
  const ws = row.side === 'WS';
  const after = rowStitchesAfter(row, before[rowIndex]);

  return (
    <View style={styles.stripWrap}>
      <ThemedText type="small" themeColor="inkSoft">
        Row {rowIndex + 1} · {row.side}
        {row.marker ? ' · 📍' : ''}
        {showStitchCount ? ` · ${after} sts` : ''}
      </ThemedText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.strip}>
          {clipped && (
            <View style={[styles.cell, ws && styles.cellWs, styles.clipCell]}>
              <ThemedText style={styles.symbol}>…</ThemedText>
            </View>
          )}
          {cells.map((c, i) => (
            <View key={i} style={[styles.cell, ws && styles.cellWs]}>
              <ThemedText style={styles.symbol}>{c.symbol}</ThemedText>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

export function StitchChart({
  rows,
  castOn,
  selected,
  onSelectStitch,
}: {
  rows: PatternRow[];
  castOn: number;
  selected?: ChartSelection | null;
  onSelectStitch?: (selection: ChartSelection) => void;
}) {
  if (rows.length === 0) return null;

  const before = sectionRowCounts(rows, castOn);
  const drawn = rows.slice(0, MAX_ROWS).map((row, index) => ({
    row,
    index,
    ...rowCells(row, before[index]),
  }));
  const width = Math.max(1, ...drawn.map((d) => d.cells.length));
  const gridWidth = width * CELL;

  // Which symbols actually appear, for the legend.
  const usedTypes = Array.from(new Set(drawn.flatMap((d) => d.cells.map((c) => c.type))));

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
            return (
              <View key={d.row.id} style={styles.line}>
                <View style={[styles.grid, { width: gridWidth }]}>
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
                      isSelected && styles.cellSelected,
                    ];
                    const glyph = <ThemedText style={styles.symbol}>{c.symbol}</ThemedText>;
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
                  <ThemedText style={styles.rowNumText}>
                    {d.index + 1}
                    {d.row.marker ? ' 📍' : ''}
                  </ThemedText>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {rows.length > MAX_ROWS && (
        <ThemedText type="small" themeColor="inkSoft">
          Showing the first {MAX_ROWS} rows.
        </ThemedText>
      )}

      <View style={styles.legend}>
        {usedTypes.map((t) => {
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
  wrap: {
    gap: Spacing.two,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
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
