import { StyleSheet } from 'react-native';

import { AutoGrowInput } from '@/components/auto-grow-input';
import { Card } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';

// Free-text notes on a pattern, a project, or one of their sections.
//
// Saved as you type. There is no Save button and deliberately so: a notes box you can lose by
// navigating away is worse than no notes box, and this is the field most likely to be filled in
// mid-row with a needle in one hand. Every keystroke goes through the store, which is what the
// row counter already does.
export function NotesCard({
  value,
  onChange,
  label = 'Notes',
  hint,
  placeholder = 'Anything worth remembering…',
}: {
  value: string;
  onChange: (notes: string) => void;
  label?: string;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <Card style={styles.card}>
      <ThemedText type="small" themeColor="inkSoft">
        {label}
      </ThemedText>
      {hint ? (
        <ThemedText type="small" themeColor="inkSoft">
          {hint}
        </ThemedText>
      ) : null}
      <AutoGrowInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        minHeight={64}
        style={styles.input}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.one },
  // Cream against the card's white, so the writable area is obvious without a border.
  input: { backgroundColor: Colors.cream },
});
