import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
  type ViewProps,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Radii, Spacing } from '@/constants/theme';
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

export function PillButton({
  style,
  children,
  variant = 'primary',
  ...props
}: PressableProps & { children: React.ReactNode; variant?: 'primary' | 'secondary' }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.pill,
        variant === 'primary' ? styles.pillPrimary : styles.pillSecondary,
        pressed && styles.pressed,
        typeof style === 'function' ? undefined : style,
      ]}
      {...props}>
      {children}
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

export function ChipPicker<T extends string>({
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chipRow}>
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => onChange(opt.value)}
                style={[styles.chip, active && styles.chipActive]}>
                <ThemedText type="smallBold" themeColor={active ? 'white' : 'inkSoft'}>
                  {opt.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
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
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  chip: {
    backgroundColor: Colors.white,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chipActive: {
    backgroundColor: Colors.blushDeep,
  },
  deleteBtn: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.two,
  },
});
