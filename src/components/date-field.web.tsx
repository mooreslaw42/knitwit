import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Radii, Spacing } from '@/constants/theme';

// A real date input on web. React Native Web renders to the DOM, so an <input type="date"> gets
// the browser's own picker and keyboard handling — far better than anything reimplemented, and it
// speaks the knitter's locale for free while still giving back an ISO value.
export function DateField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  hint?: string;
}) {
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
      <input
        type="date"
        value={value ?? ''}
        // Clearing the field is a real answer — "I don't remember when I started this".
        onChange={(e) => onChange(e.target.value || null)}
        style={inputStyle}
      />
    </View>
  );
}

// Plain CSS rather than StyleSheet: this is a DOM node, not a React Native View.
const inputStyle: React.CSSProperties = {
  backgroundColor: Colors.white,
  borderRadius: Radii.medium,
  border: 'none',
  outline: 'none',
  padding: `${Spacing.three}px`,
  fontFamily: Fonts.bodySemibold,
  fontSize: 15,
  color: Colors.ink,
  width: '100%',
  boxSizing: 'border-box',
};

const styles = StyleSheet.create({
  field: { gap: Spacing.one },
});
