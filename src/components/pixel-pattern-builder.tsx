import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, PillButton } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Radii, Spacing } from '@/constants/theme';
import { pickImageMessage, pickPixelImage } from '@/lib/pixel-image';
import {
  buildPixelPattern,
  gridHeight,
  PIXEL_COLORS,
  PIXEL_WIDTH,
  quantize,
  rgbToHex,
  type LoadedImage,
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

  const grid = useMemo(
    () => (image ? quantize(image.sample, width, colors) : null),
    [image, width, colors],
  );

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
    const { materials, section } = buildPixelPattern(grid, craft);
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
          <GridPreview grid={grid} />

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
            unit={`${grid.palette.length} in the photo`}
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
