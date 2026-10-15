import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PillButton } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { yarnSwatchColor } from '@/components/illustrations/yarn-colors';
import { colourMessage, dataUrlToBytes, imageColours } from '@/lib/image-colours';
import { getPhoto } from '@/lib/photo-store';
import { Colors, Radii, Spacing } from '@/constants/theme';

// A yarn's actual colour.
//
// A ball band prints a name, and a name is not something the app can compare or draw with — three
// yarns in one stash can all be called some kind of rose and be three different pinks. So the
// knitter sets a real colour, and the quickest way to get one right is to take it off the photo of
// the ball they already took.

// How many colours to pull off a photo. A ball of yarn photographed on a table is mostly yarn, a
// bit of shadow and a bit of table; six gives the real colour room to appear without burying it in
// near-identical neighbours.
const PHOTO_COLOURS = 6;

// Somewhere to start when there is no photo. Deliberately not a full colour picker: this wants to
// be two taps on the way past, and a knitter who needs an exact shade has the photo route.
const PRESETS = [
  '#4A4447', '#8E8A8C', '#F3ECE2', '#E9D9C1',
  '#9A6B50', '#C2505E', Colors.coralDeep, Colors.butterDeep,
  Colors.sageDeep, '#3F8F8C', '#6E93C9', Colors.lavenderDeep,
  Colors.blushDeep,
];

type Props = {
  value: string | null | undefined;
  colorName: string;
  /** The material's photo id, if it has one — the source for "take it from the photo". */
  photo: string | null;
  onChange: (swatch: string | null) => void;
};

export function SwatchField({ value, colorName, photo, onChange }: Props) {
  const [fromPhoto, setFromPhoto] = useState<string[] | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Shown when nothing is set: the guess from the name, which is what the rest of the app has been
  // drawing all along. Labelled as a guess rather than presented as the yarn's colour.
  const guessed = yarnSwatchColor(colorName, null);

  const readPhoto = async () => {
    setError(null);
    setReading(true);
    try {
      const dataUrl = await getPhoto(photo);
      if (!dataUrl) {
        setError('That photo could not be opened.');
        return;
      }
      const bytes = dataUrlToBytes(dataUrl);
      if (!bytes) {
        setError('That photo could not be read.');
        return;
      }
      const result = await imageColours(bytes, { colours: PHOTO_COLOURS });
      if (!result.colours.length) {
        setError('No colours came back from that photo.');
        return;
      }
      setFromPhoto(result.colours);
    } catch (e) {
      setError(colourMessage(e));
    } finally {
      setReading(false);
    }
  };

  const swatches = fromPhoto ?? PRESETS;

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold" themeColor="inkSoft">
        Colour
      </ThemedText>

      <View style={styles.current}>
        <View style={[styles.chip, { backgroundColor: value || guessed }]} />
        <ThemedText type="small" themeColor="inkSoft" style={styles.currentText}>
          {value ? value : `Guessed from the name — pick one to set it properly.`}
        </ThemedText>
        {value && (
          <Pressable onPress={() => onChange(null)} hitSlop={8} accessibilityRole="button">
            <ThemedText type="small" themeColor="coralDeep">
              Clear
            </ThemedText>
          </Pressable>
        )}
      </View>

      {photo && (
        <PillButton variant="secondary" loading={reading} onPress={readPhoto}>
          <ThemedText type="smallBold" themeColor="ink">
            {fromPhoto ? 'Read the photo again' : 'Take it from the photo'}
          </ThemedText>
        </PillButton>
      )}

      {fromPhoto && (
        <ThemedText type="small" themeColor="inkSoft">
          The colours in that photo. Pick the one that is the yarn rather than the table.
        </ThemedText>
      )}

      <View style={styles.swatches}>
        {swatches.map((hex) => (
          <Pressable
            key={hex}
            onPress={() => onChange(hex)}
            accessibilityRole="button"
            accessibilityLabel={`Use ${hex}`}
            style={[styles.chip, { backgroundColor: hex }, value === hex && styles.chosen]}
          />
        ))}
      </View>

      {error && (
        <ThemedText type="small" themeColor="coralDeep">
          {error}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.two,
  },
  current: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  currentText: {
    flex: 1,
  },
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    width: 32,
    height: 32,
    borderRadius: Radii.small,
    borderWidth: 1,
    borderColor: Colors.creamDeep,
  },
  chosen: {
    borderWidth: 3,
    borderColor: Colors.ink,
  },
});
