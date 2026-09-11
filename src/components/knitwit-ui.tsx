import { Picker } from '@react-native-picker/picker';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
  type ViewProps,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Radii, Spacing, type ThemeColor } from '@/constants/theme';
import type { SectionStatus } from '@/types/knitwit';

export function Card({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
}

export function ProgressBar({ pct, color }: { pct: number; color: string }) {
  const clamped = Math.max(0, Math.min(1, pct));
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${clamped * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

export function StatusBadge({ status }: { status: SectionStatus }) {
  const labels: Record<SectionStatus, string> = {
    'not-started': 'Not started',
    'in-progress': 'In progress',
    complete: 'Complete',
  };
  const bg: Record<SectionStatus, string> = {
    'not-started': Colors.creamDeep,
    'in-progress': Colors.butter,
    complete: Colors.sage,
  };
  return (
    <View style={[styles.badge, { backgroundColor: bg[status] }]}>
      <ThemedText type="small" themeColor="ink">
        {labels[status]}
      </ThemedText>
    </View>
  );
}

// The app's one waiting indicator. Anything that makes the user wait should use this rather than
// rolling its own, so a pause always looks the same wherever it happens.
export function Spinner({
  color = 'ink',
  size = 'small',
}: {
  color?: ThemeColor;
  size?: 'small' | 'large';
}) {
  return <ActivityIndicator size={size} color={Colors[color]} />;
}

export function PillButton({
  style,
  children,
  variant = 'primary',
  loading = false,
  disabled,
  ...props
}: PressableProps & {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  // Shows the spinner and disables the button — a button that's working shouldn't be pressable
  // twice, and the two states should never drift apart.
  loading?: boolean;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.pill,
        variant === 'primary' ? styles.pillPrimary : styles.pillSecondary,
        // No press feedback when there's nothing to press.
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.pillDisabled,
        typeof style === 'function' ? undefined : style,
      ]}
      {...props}
      disabled={isDisabled}>
      {loading ? (
        <View style={styles.pillLoading}>
          <Spinner color={variant === 'primary' ? 'white' : 'ink'} />
          {children}
        </View>
      ) : (
        children
      )}
    </Pressable>
  );
}

export function FormField({
  label,
  style,
  ...props
}: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold" themeColor="inkSoft">
        {label}
      </ThemedText>
      <TextInput
        placeholderTextColor={Colors.inkSoft}
        style={[styles.input, style]}
        {...props}
      />
    </View>
  );
}

export function SelectField<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold" themeColor="inkSoft">
        {label}
      </ThemedText>
      <View style={styles.selectBox}>
        <Picker<T>
          selectedValue={value}
          onValueChange={onChange}
          style={styles.select}
          itemStyle={styles.selectItem}>
          {options.map((opt) => (
            <Picker.Item key={opt.value} label={opt.label} value={opt.value} />
          ))}
        </Picker>
      </View>
    </View>
  );
}

export function DeleteButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}>
      <ThemedText type="smallBold" themeColor="coralDeep">
        Delete
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radii.large,
    padding: Spacing.four,
  },
  progressTrack: {
    backgroundColor: Colors.creamDeep,
    borderRadius: Radii.pill,
    height: 6,
    width: '100%',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Radii.pill,
  },
  badge: {
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  pill: {
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillPrimary: {
    backgroundColor: Colors.blushDeep,
  },
  pillSecondary: {
    backgroundColor: Colors.creamDeep,
  },
  pressed: {
    opacity: 0.7,
  },
  // Greyed rather than recoloured: the palette has no disabled tone, and fading keeps the button
  // recognisable as the same control that will come back.
  pillDisabled: {
    opacity: 0.45,
  },
  pillLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  field: {
    gap: Spacing.one,
  },
  input: {
    backgroundColor: Colors.white,
    borderRadius: Radii.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontFamily: Fonts.bodySemibold,
    fontSize: 15,
    color: Colors.ink,
  },
  selectBox: {
    backgroundColor: Colors.white,
    borderRadius: Radii.medium,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  select: {
    backgroundColor: Colors.white,
    color: Colors.ink,
    fontFamily: Fonts.bodySemibold,
    fontSize: 15,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderWidth: 0,
  },
  selectItem: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 15,
    color: Colors.ink,
  },
  deleteBtn: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.two,
  },
});
