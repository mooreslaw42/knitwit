import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Radii, Spacing } from '@/constants/theme';

// Choosing one of a list, on a phone.
//
// The obvious implementation — @react-native-picker/picker inline — is what this replaces. On the
// web it renders a <select>, which is compact, familiar and better for a screen reader than
// anything hand-built. On iOS the same component renders a UIPickerView: a spinning wheel roughly
// 216pt tall, in the page, whatever styling it is given. A form with three of them is mostly
// wheels, each showing five options a knitter did not ask to see, with the chosen one the only
// legible line.
//
// So on a phone it is a field that says what is chosen and a sheet that opens when you press it.
// That also fixes the part the wheel is worst at: needle sizes run to two dozen entries, which a
// wheel shows five of, and a list shows properly.
//
// The look is copied from InputStyle rather than imported, which is a small duplication taken on
// purpose: knitwit-ui imports this file, and importing back would be a cycle for the sake of four
// style properties.

const FIELD = {
  backgroundColor: Colors.white,
  borderRadius: Radii.medium,
  paddingHorizontal: Spacing.three,
  paddingVertical: Spacing.three,
} as const;

export function SelectControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  // What the sheet calls itself, so somebody who has opened it knows what they are choosing.
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const chosen = options.find((option) => option.value === value);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={styles.field}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${chosen?.label ?? 'choose'}`}>
        <ThemedText style={styles.value} numberOfLines={1}>
          {chosen?.label ?? '—'}
        </ThemedText>
        <ThemedText type="smallBold" themeColor="inkSoft">
          ⌄
        </ThemedText>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          {/* Swallows taps inside the sheet, which the backdrop above would otherwise close. */}
          <Pressable style={styles.sheet} onPress={() => {}}>
            <ThemedText type="smallBold" themeColor="inkSoft" style={styles.sheetLabel}>
              {label}
            </ThemedText>
            <ScrollView contentContainerStyle={styles.list}>
              {options.map((option) => {
                const selected = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    style={[styles.option, selected && styles.optionOn]}
                    accessibilityRole="button"
                    accessibilityLabel={option.label}>
                    <ThemedText type={selected ? 'smallBold' : 'default'}>{option.label}</ThemedText>
                    {selected ? (
                      <ThemedText type="smallBold" themeColor="blushDeep">
                        ✓
                      </ThemedText>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    ...FIELD,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  value: { flexShrink: 1, fontFamily: Fonts.bodySemibold, fontSize: 15, color: Colors.ink },
  backdrop: { flex: 1, backgroundColor: 'rgba(74,59,56,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.cream,
    borderTopLeftRadius: Radii.large,
    borderTopRightRadius: Radii.large,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    // A long list scrolls rather than growing past the top of the screen; a short one stays short.
    maxHeight: '70%',
  },
  sheetLabel: { paddingHorizontal: Spacing.five, paddingBottom: Spacing.two },
  list: { paddingHorizontal: Spacing.four, gap: Spacing.one },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Radii.medium,
  },
  optionOn: { backgroundColor: Colors.creamDeep },
});
