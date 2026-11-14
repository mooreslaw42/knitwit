import { memo, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';

import { Card, PillButton } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Radii, Spacing } from '@/constants/theme';
import { pickImageMessage, pickPixelImage } from '@/lib/pixel-image';
import {
  buildPixelPattern,
  cellsBetween,
  colorTag,
  compactPalette,
  gridHeight,
  paintCell,
  PIXEL_COLORS,
  PIXEL_WIDTH,
  quantize,
  rgbToHex,
  type LoadedImage,
  type QuantizedGrid,
} from '@/lib/pixel-pattern';
import type { PatternMaterial, PatternSection } from '@/types/knitwit';

// What the builder hands back when the knitter accepts: the pieces of a Pattern the wizard merges
// into its form, plus the photo to keep and the chosen craft.
export type PixelPatternResult = {
  craft: 'knit' | 'crochet';
  materials: PatternMaterial[];
  section: PatternSection;
  photoDataUrl: string;
};

// Build a colourwork chart from a photo: pick an image, set how many stitches wide and how many
// colours, and knit or crochet. Height follows the photo's shape so the picture is never squashed,
// and the preview updates on every change so the knitter dials it in by eye — the way pixelstitch's
// converter works, which this is modelled on.
export function PixelPatternBuilder({
  initialCraft,
  onUse,
  onCancel,
}: {
  initialCraft: 'knit' | 'crochet';
  onUse: (result: PixelPatternResult) => void;
  onCancel: () => void;
}) {
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [width, setWidth] = useState<number>(PIXEL_WIDTH.default);
  const [colors, setColors] = useState<number>(PIXEL_COLORS.default);
  const [craft, setCraft] = useState<'knit' | 'crochet'>(initialCraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quantized = useMemo(
    () => (image ? quantize(image.sample, width, colors) : null),
    [image, width, colors],
  );

  // Hand edits sit on top of the grid the photo produced. They belong to that grid: change the
  // width, the colour count or the photo and the photo's grid is a different one, the stitch
  // numbers no longer line up, and the edits are dropped rather than smeared across it.
  const [edits, setEdits] = useState<{ from: QuantizedGrid; grid: QuantizedGrid; undo: QuantizedGrid[] } | null>(null);
  const live = edits && edits.from === quantized ? edits : null;
  const grid = live ? live.grid : quantized;
  const [editing, setEditing] = useState(false);
  const [brushChoice, setBrush] = useState(0);
  // Fewer colours than before leaves the old choice pointing past the end of the palette.
  const brush = grid && brushChoice < grid.palette.length ? brushChoice : 0;

  // One undo step per stroke, not per stitch: a drag across ten stitches is one thing to take back.
  const startStroke = () => {
    if (!quantized || !grid) return;
    setEdits({ from: quantized, grid, undo: [...(live?.undo ?? []), grid].slice(-UNDO_LIMIT) });
  };
  const paint = (index: number) => {
    setEdits((e) => {
      if (!e) return e;
      const next = paintCell(e.grid, index, brush);
      return next === e.grid ? e : { ...e, grid: next };
    });
  };
  const undo = () => {
    if (!live?.undo.length) return;
    const undoStack = live.undo.slice(0, -1);
    setEdits({ ...live, grid: live.undo[live.undo.length - 1], undo: undoStack });
  };
  const edited = !!live && live.grid !== quantized;

  const pick = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await pickPixelImage();
      if (result.status === 'picked') setImage(result.image);
      else setError(pickImageMessage(result.status));
    } finally {
      setBusy(false);
    }
  };

  const use = () => {
    if (!grid || !image) return;
    // Compacted first: a colour painted out entirely would otherwise still become a yarn.
    const { materials, section } = buildPixelPattern(compactPalette(grid), craft);
    onUse({ craft, materials, section, photoDataUrl: image.photoDataUrl });
  };

  return (
    <Card style={styles.card}>
      <ThemedText type="smallBold">Pixel pattern from a photo</ThemedText>
      <ThemedText type="small" themeColor="inkSoft">
        A photo becomes a colourwork chart — one cell is one stitch, one colour is one yarn. Best
        with a bold, simple picture.
      </ThemedText>

      <Pressable style={styles.pickBtn} onPress={pick} disabled={busy}>
        <ThemedText type="smallBold" themeColor="inkSoft">
          {busy ? 'Reading the photo…' : image ? 'Choose a different photo' : '+ Choose a photo'}
        </ThemedText>
      </Pressable>
      {error && (
        <ThemedText type="small" themeColor="coralDeep">
          {error}
        </ThemedText>
      )}

      {grid && (
        <>
          {editing ? (
            <>
              <ThemedText type="small" themeColor="inkSoft">
                Pick a colour, then tap or drag across stitches to paint them.
              </ThemedText>
              <View style={styles.palette}>
                {grid.palette.map((rgb, i) => (
                  <Pressable
                    key={i}
                    accessibilityRole="button"
                    accessibilityLabel={`Paint with colour ${colorTag(i)}`}
                    accessibilityState={{ selected: brush === i }}
                    onPress={() => setBrush(i)}
                    style={[styles.swatch, brush === i && styles.swatchOn]}>
                    <View style={[styles.swatchFill, { backgroundColor: rgbToHex(rgb) }]} />
                    <ThemedText type="smallBold" themeColor={brush === i ? 'ink' : 'inkSoft'}>
                      {colorTag(i)}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
              <GridPainter grid={grid} onStrokeStart={startStroke} onPaint={paint} />
              <View style={styles.editActions}>
                <PillButton
                  variant="secondary"
                  style={styles.grow}
                  disabled={!live?.undo.length}
                  onPress={undo}>
                  <ThemedText type="smallBold" themeColor="ink">
                    Undo
                  </ThemedText>
                </PillButton>
                <PillButton
                  variant="secondary"
                  style={styles.grow}
                  disabled={!edited}
                  onPress={() => setEdits(null)}>
                  <ThemedText type="smallBold" themeColor="ink">
                    Back to the photo
                  </ThemedText>
                </PillButton>
                <PillButton style={styles.grow} onPress={() => setEditing(false)}>
                  <ThemedText type="smallBold" themeColor="white">
                    Done editing
                  </ThemedText>
                </PillButton>
              </View>
            </>
          ) : (
            <>
              <GridPreview grid={grid} />
              <Pressable style={styles.pickBtn} onPress={() => setEditing(true)}>
                <ThemedText type="smallBold" themeColor="inkSoft">
                  ✎ Edit stitches by hand
                </ThemedText>
              </Pressable>
            </>
          )}
          {edited && (
            <ThemedText type="small" themeColor="inkSoft">
              Your hand edits are kept. Changing the width, colours or photo redraws the chart from
              the photo and drops them.
            </ThemedText>
          )}

          <Stepper
            label="Width"
            value={width}
            unit={`${width} × ${gridHeight(image!.sample, Math.min(width, PIXEL_WIDTH.max))} stitches`}
            min={PIXEL_WIDTH.min}
            max={PIXEL_WIDTH.max}
            step={2}
            onChange={setWidth}
          />
          <Stepper
            label="Colours"
            value={colors}
            unit={`${quantized!.palette.length} in the photo`}
            min={PIXEL_COLORS.min}
            max={PIXEL_COLORS.max}
            step={1}
            onChange={setColors}
          />

          <View style={styles.field}>
            <ThemedText type="smallBold" themeColor="inkSoft">
              Craft
            </ThemedText>
            <View style={styles.craftRow}>
              {(['knit', 'crochet'] as const).map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setCraft(c)}
                  style={[styles.craftChip, craft === c && styles.craftChipActive]}>
                  <ThemedText type="smallBold" themeColor={craft === c ? 'white' : 'inkSoft'}>
                    {c === 'knit' ? 'Knit' : 'Crochet'}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        </>
      )}

      <View style={styles.actions}>
        <PillButton style={styles.grow} disabled={!grid} onPress={use}>
          <ThemedText type="smallBold" themeColor="white">
            Use this pattern
          </ThemedText>
        </PillButton>
        <PillButton variant="secondary" style={styles.grow} onPress={onCancel}>
          <ThemedText type="smallBold" themeColor="ink">
            Cancel
          </ThemedText>
        </PillButton>
      </View>
    </Card>
  );
}

// The quantised grid drawn as coloured squares, in the photo's own orientation (top-left first) —
// a sanity check before committing, not the chart itself. Sized so the whole picture fits the
// card without scrolling.
const PREVIEW_MAX = 260;
function GridPreview({ grid }: { grid: ReturnType<typeof quantize> }) {
  const cell = Math.max(2, Math.floor(PREVIEW_MAX / Math.max(grid.width, grid.height)));
  const hexes = grid.palette.map(rgbToHex);
  return (
    <View style={styles.preview}>
      {Array.from({ length: grid.height }, (_, y) => (
        <View key={y} style={styles.previewRow}>
          {Array.from({ length: grid.width }, (_, x) => (
            <View
              key={x}
              style={{
                width: cell,
                height: cell,
                backgroundColor: hexes[grid.cells[y * grid.width + x]],
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

// The grid at a size a finger can hit, painted by touching it. One responder on the whole grid
// rather than a Pressable per stitch: a drag has to keep painting as it crosses from one stitch to
// the next, which separate buttons can't do, and 2,000-odd Pressables would be slow besides. The
// stitches ignore the pointer so the event's location is always measured against the grid itself.
const UNDO_LIMIT = 40;
const PAINT_CELL = { min: 5, max: 18 } as const;
function GridPainter({
  grid,
  onStrokeStart,
  onPaint,
}: {
  grid: QuantizedGrid;
  onStrokeStart: () => void;
  onPaint: (index: number) => void;
}) {
  const [avail, setAvail] = useState(0);
  const cell = Math.max(
    PAINT_CELL.min,
    Math.min(PAINT_CELL.max, Math.floor((avail || 300) / grid.width)),
  );
  const hexes = useMemo(() => grid.palette.map(rgbToHex), [grid.palette]);
  // The stitch the stroke last reached, so the next report can be joined to it with a line.
  const last = useRef<{ x: number; y: number } | null>(null);

  const paintAt = (e: GestureResponderEvent) => {
    // Clamped rather than dropped: a stroke that strays off the edge keeps painting along it.
    const x = Math.max(0, Math.min(grid.width - 1, Math.floor(e.nativeEvent.locationX / cell)));
    const y = Math.max(0, Math.min(grid.height - 1, Math.floor(e.nativeEvent.locationY / cell)));
    const prev = last.current;
    if (prev && prev.x === x && prev.y === y) return;
    for (const c of prev ? cellsBetween(prev, { x, y }) : [{ x, y }]) {
      onPaint(c.y * grid.width + c.x);
    }
    last.current = { x, y };
  };

  return (
    <View style={styles.painterWrap} onLayout={(e) => setAvail(e.nativeEvent.layout.width)}>
      <View
        style={[styles.preview, { width: cell * grid.width + 2 }]}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        // Painting, not scrolling: a drag that started on the grid stays with the grid.
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => {
          last.current = null;
          onStrokeStart();
          paintAt(e);
        }}
        onResponderMove={paintAt}>
        <View style={styles.noPointer}>
          {Array.from({ length: grid.height }, (_, y) => (
            <PaintRow
              key={y}
              hexes={hexes}
              cell={cell}
              // A string, so an untouched row compares equal and skips its re-render.
              row={grid.cells.slice(y * grid.width, (y + 1) * grid.width).join(',')}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const PaintRow = memo(function PaintRow({
  hexes,
  cell,
  row,
}: {
  hexes: string[];
  cell: number;
  row: string;
}) {
  return (
    <View style={styles.previewRow}>
      {row.split(',').map((c, x) => (
        <View
          key={x}
          style={{ width: cell, height: cell, backgroundColor: hexes[Number(c)] }}
        />
      ))}
    </View>
  );
});

function Stepper({
  label,
  value,
  unit,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold" themeColor="inkSoft">
        {label}
      </ThemedText>
      <View style={styles.stepperRow}>
        <Pressable
          style={[styles.stepBtn, value <= min && styles.stepBtnOff]}
          disabled={value <= min}
          onPress={() => onChange(clamp(value - step))}
          hitSlop={6}>
          <ThemedText style={styles.stepGlyph}>−</ThemedText>
        </Pressable>
        <ThemedText type="smallBold" style={styles.stepValue}>
          {value}
        </ThemedText>
        <Pressable
          style={[styles.stepBtn, value >= max && styles.stepBtnOff]}
          disabled={value >= max}
          onPress={() => onChange(clamp(value + step))}
          hitSlop={6}>
          <ThemedText style={styles.stepGlyph}>+</ThemedText>
        </Pressable>
        <ThemedText type="small" themeColor="inkSoft" style={styles.stepUnit}>
          {unit}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.three },
  pickBtn: {
    backgroundColor: Colors.white,
    borderRadius: Radii.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  field: { gap: Spacing.one },
  preview: {
    alignSelf: 'center',
    // A thin frame so a photo with pale edges still reads as a bounded picture.
    borderWidth: 1,
    borderColor: Colors.inkSoft,
  },
  previewRow: { flexDirection: 'row' },
  painterWrap: { alignSelf: 'stretch', alignItems: 'center' },
  noPointer: { pointerEvents: 'none' },
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  swatch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    backgroundColor: Colors.white,
    borderRadius: Radii.pill,
    paddingLeft: 4,
    paddingRight: Spacing.two,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchOn: { borderColor: Colors.ink },
  swatchFill: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(74, 59, 56, 0.2)',
  },
  editActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: Radii.pill,
    backgroundColor: Colors.creamDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnOff: { opacity: 0.4 },
  stepGlyph: {
    fontFamily: Fonts.bodyBold,
    fontSize: 20,
    lineHeight: 22,
    color: Colors.ink,
  },
  stepValue: {
    minWidth: 28,
    textAlign: 'center',
  },
  stepUnit: { flexShrink: 1 },
  craftRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  craftChip: {
    backgroundColor: Colors.creamDeep,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  craftChipActive: { backgroundColor: Colors.blushDeep },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  grow: { flex: 1 },
});
