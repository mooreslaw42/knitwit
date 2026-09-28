import { Pressable, StyleSheet, View } from 'react-native';

import { CareSymbol } from '@/components/care-symbol';
import { ThemedText } from '@/components/themed-text';
import { careSymbolGroups, toggleCareSymbol } from '@/constants/catalogs';
import { Colors, Radii, Spacing } from '@/constants/theme';

// The care symbols on the ball band, ticked off against the band.
//
// Sits under the Washing field rather than replacing it: that one says what the knitter has decided
// to do with this yarn, in words, and is answered once. A band says five things at once — wash,
// bleach, dry, iron, professional care — and a knitter transcribing it should not have to pick
// which of them to keep. So this is a list, nothing is required, and an empty one is an ordinary
// answer rather than an unfinished form.
//
// Grouped in the order the families are printed, so ticking them off is a matter of reading along.
export function CareSymbolsField({
  label = 'Care symbols',
  hint = 'Optional. Tick whatever the ball band shows.',
  value,
  onChange,
}: {
  label?: string;
  hint?: string;
  value: string[] | undefined;
  onChange: (next: string[]) => void;
}) {
  const chosen = value ?? [];

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold" themeColor="inkSoft">
        {label}
      </ThemedText>
      <ThemedText type="small" themeColor="inkSoft">
        {hint}
      </ThemedText>

      {careSymbolGroups().map(({ group, symbols }) => (
        <View key={group} style={styles.group}>
          <ThemedText type="small" themeColor="inkSoft">
            {group}
          </ThemedText>
          <View style={styles.row}>
            {symbols.map((symbol) => {
              const on = chosen.includes(symbol.id);
              return (
                <Pressable
                  key={symbol.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={symbol.label}
                  onPress={() => onChange(toggleCareSymbol(chosen, symbol.id))}
                  style={({ pressed }) => [styles.tile, on && styles.tileOn, pressed && styles.pressed]}>
                  {/* White on the filled tile, so a ticked symbol reads the same way a ticked chip
                      does everywhere else in the app. */}
                  <CareSymbol id={symbol.id} colour={on ? Colors.white : Colors.ink} />
                  <ThemedText
                    type="small"
                    style={styles.tileLabel}
                    themeColor={on ? 'white' : 'inkSoft'}>
                    {symbol.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

// The ticked symbols on their own, for the places that show a yarn rather than edit it. Silent when
// there are none — a yarn whose band was never transcribed should look like a yarn, not like a gap.
export function CareSymbolRow({ value, size = 22 }: { value: string[] | undefined; size?: number }) {
  if (!value || value.length === 0) return null;
  return (
    <View style={styles.summary}>
      {value.map((id) => (
        <CareSymbol key={id} id={id} size={size} colour={Colors.inkSoft} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.two, overflow: 'visible' },
  group: { gap: Spacing.one },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  // Wide enough for two lines of the longest label ("Do not tumble dry") at the smallest text size,
  // so the tiles in a row stay the same height whatever is written under them.
  tile: {
    width: 88,
    alignItems: 'center',
    gap: Spacing.half,
    backgroundColor: Colors.creamDeep,
    borderRadius: Radii.medium,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  tileOn: { backgroundColor: Colors.blushDeep },
  tileLabel: { textAlign: 'center' },
  pressed: { opacity: 0.7 },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, alignItems: 'center' },
});
