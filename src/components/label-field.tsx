import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, MaxNameLength, Radii, Spacing } from '@/constants/theme';
import { addLabel, hasLabel, labelKey, removeLabel } from '@/lib/labels';

// Free-text groupings for a project — "Christmas presents 2027", "for Mum", "stash-bust".
//
// Free text, but not a blank box. Typing a group's name out a ninth time is how "Christmas
// presents 2027" becomes "Christmas Presents 2027" and quietly splits in two, so anything already
// in use is offered as a chip to tap. The typing is still there for the first one, and for a
// group that only ever has one project in it.
export function LabelField({
  label = 'Labels',
  hint,
  value,
  suggestions,
  onChange,
}: {
  label?: string;
  hint?: string;
  value: string[];
  // Labels already used on other projects. Tapping one is how a group gets its second member.
  suggestions: string[];
  onChange: (labels: string[]) => void;
}) {
  const [draft, setDraft] = useState('');

  const commit = () => {
    const next = addLabel(value, draft);
    if (next !== value) onChange(next);
    setDraft('');
  };

  // Only what isn't already on this project, and narrowed as you type — the list is otherwise
  // just noise once a knitter has a dozen groups.
  const offer = suggestions.filter(
    (s) => !hasLabel(value, s) && (!draft.trim() || labelKey(s).includes(labelKey(draft))),
  );

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold" themeColor="inkSoft">
        {label}
      </ThemedText>
      {hint ? (
        <ThemedText type="small" themeColor="inkSoft">
          {hint}
        </ThemedText>
      ) : null}

      {value.length > 0 ? (
        <View style={styles.chipRow}>
          {value.map((l) => (
            <Pressable key={l} style={styles.chipOn} onPress={() => onChange(removeLabel(value, l))}>
              <ThemedText type="smallBold" themeColor="white" numberOfLines={1} style={styles.chipText}>
                {l} ✕
              </ThemedText>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.addRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={commit}
          // So the on-screen keyboard offers "done" rather than a newline, and Enter adds the
          // label instead of doing nothing.
          returnKeyType="done"
          maxLength={MaxNameLength}
          placeholder="e.g. Christmas presents 2027"
          placeholderTextColor={Colors.inkSoft}
          style={styles.input}
        />
        {draft.trim() ? (
          <Pressable hitSlop={6} onPress={commit} style={styles.addBtn}>
            <ThemedText type="smallBold" themeColor="sageDeep">
              Add
            </ThemedText>
          </Pressable>
        ) : null}
      </View>

      {offer.length > 0 ? (
        <View style={styles.chipRow}>
          {offer.slice(0, 12).map((s) => (
            <Pressable key={s} style={styles.chip} onPress={() => onChange(addLabel(value, s))}>
              <ThemedText type="smallBold" themeColor="inkSoft" numberOfLines={1} style={styles.chipText}>
                + {s}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.one },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    backgroundColor: Colors.creamDeep,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chipOn: {
    backgroundColor: Colors.lavenderDeep,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  // A group name can be a sentence; without a ceiling one pushes the row off the card.
  chipText: { maxWidth: 240 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  input: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: Radii.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontFamily: Fonts.bodySemibold,
    fontSize: 15,
    color: Colors.ink,
  },
  addBtn: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.two },
});
