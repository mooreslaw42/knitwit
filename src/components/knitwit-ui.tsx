import { Picker } from '@react-native-picker/picker';
import { PhotoImage } from '@/components/photo';
import { useState } from 'react';
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
import { PROJECT_STATUS_LABELS } from '@/constants/catalogs';
import { Colors, Fonts, Radii, Spacing, type ThemeColor } from '@/constants/theme';
import type { ProjectStatus, SectionStatus } from '@/types/knitwit';

// The one text-input look, exported so the platform-split AutoGrowInput can wear it without
// keeping a second copy that drifts.
export const InputStyle = {
  backgroundColor: Colors.white,
  borderRadius: Radii.medium,
  paddingHorizontal: Spacing.three,
  paddingVertical: Spacing.three,
  fontFamily: Fonts.bodySemibold,
  fontSize: 15,
  color: Colors.ink,
} as const;

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

// The same badge for a whole project. Butter for work in hand, sage for done, coral for frogged
// — a frogged project isn't a failure, but it is the one that needs to look different from the
// two you'd otherwise mistake it for.
export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const bg: Record<ProjectStatus, string> = {
    active: Colors.butter,
    finished: Colors.sage,
    frogged: Colors.coral,
  };
  return (
    <View style={[styles.badge, { backgroundColor: bg[status] }]}>
      <ThemedText type="small" themeColor="ink">
        {PROJECT_STATUS_LABELS[status]}
      </ThemedText>
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
  // Nothing on the web build responded to the mouse until it was clicked, which reads as dead on
  // a desktop. Tracked here rather than per screen so every button gets it from one change.
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        styles.pill,
        variant === 'primary' ? styles.pillPrimary : styles.pillSecondary,
        // No press or hover feedback when there's nothing to press.
        hovered && !isDisabled && styles.hovered,
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

// A field's label, with room beside it for a mark saying where the value came from. Shared so the
// three field components put the badge in the same place rather than each inventing a spot.
function FieldLabel({ label, badge }: { label: string; badge?: React.ReactNode }) {
  if (!badge) {
    return (
      <ThemedText type="smallBold" themeColor="inkSoft">
        {label}
      </ThemedText>
    );
  }
  return (
    <View style={styles.labelRow}>
      <ThemedText type="smallBold" themeColor="inkSoft">
        {label}
      </ThemedText>
      {badge}
    </View>
  );
}

export function FormField({
  label,
  badge,
  style,
  ...props
}: TextInputProps & { label: string; badge?: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <FieldLabel label={label} badge={badge} />
      <TextInput
        placeholderTextColor={Colors.inkSoft}
        style={[styles.input, style]}
        {...props}
      />
    </View>
  );
}

// A value that is settled rather than waiting to be typed.
//
// Same frame and same label as the field it stands in for, so a form does not change shape around
// it, but with nothing to edit and nothing to save — a Save button beside a value that is already
// saved asks the knitter to confirm something that already happened.
//
// `action` is how it becomes a field again. Without one this is a one-way door: a name entered
// wrongly, or an old one after a change of mind, would be kept for good.
export function ReadOnlyField({
  label,
  value,
  action,
}: {
  label: string;
  value: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.field}>
      <FieldLabel label={label} />
      <View style={styles.readOnly}>
        <ThemedText numberOfLines={1} style={styles.readOnlyValue}>
          {value}
        </ThemedText>
        {action ? (
          <Pressable onPress={action.onPress} hitSlop={6}>
            <ThemedText type="smallBold" themeColor="sageDeep">
              {action.label}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function SelectField<T extends string>({
  label,
  badge,
  options,
  value,
  onChange,
}: {
  label: string;
  badge?: React.ReactNode;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.field}>
      <FieldLabel label={label} badge={badge} />
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

// The small square that stands for a thing in a list — a project, a yarn, a tool. Shows the
// photo when there is one and falls back to the item's colour, or to an icon passed as children.
//
// Shared because three lists each wrote `backgroundColor: photo ? undefined : color` and then
// never drew the photo, so anything with one showed a blank square. One place to get it right.
export function Thumb({
  photo,
  color,
  size = 44,
  children,
}: {
  photo?: string | null;
  color?: string;
  size?: number;
  children?: React.ReactNode;
}) {
  return (
    <View
      style={[
        styles.thumb,
        { width: size, height: size, backgroundColor: color ?? Colors.creamDeep },
      ]}>
      {photo ? <PhotoImage photo={photo} style={styles.thumbPhoto} /> : children}
    </View>
  );
}

// A destructive action that asks first, in place. Deliberately not a browser confirm(): those
// block the whole page, look nothing like the rest of the app, and on React Native Web they're
// only available at all by accident.
export function ConfirmButton({
  label,
  question,
  confirmLabel,
  onConfirm,
  style,
}: {
  label: string;
  question: string;
  confirmLabel: string;
  onConfirm: () => void;
  style?: ViewProps['style'];
}) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <PillButton variant="secondary" style={style} onPress={() => setAsking(true)}>
        <ThemedText type="smallBold" themeColor="coralDeep">
          {label}
        </ThemedText>
      </PillButton>
    );
  }

  return (
    <View style={[styles.confirmWrap, style]}>
      <ThemedText type="small" themeColor="ink">
        {question}
      </ThemedText>
      <View style={styles.confirmRow}>
        <PillButton
          style={styles.confirmGrow}
          onPress={() => {
            setAsking(false);
            onConfirm();
          }}>
          <ThemedText type="smallBold" themeColor="white">
            {confirmLabel}
          </ThemedText>
        </PillButton>
        <PillButton variant="secondary" style={styles.confirmGrow} onPress={() => setAsking(false)}>
          <ThemedText type="smallBold" themeColor="ink">
            Cancel
          </ThemedText>
        </PillButton>
      </View>
    </View>
  );
}

export function DeleteButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}>
      <ThemedText type="smallBold" themeColor="coralDeep">
        Delete
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    overflow: 'visible',
  },
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
  // Lighter than the press state, so the two are distinguishable: hover says "this does
  // something", press says "you did it".
  hovered: {
    opacity: 0.88,
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
  // Visible so a source badge's tooltip can hang past the bottom of the field it belongs to.
  field: {
    gap: Spacing.one,
    overflow: 'visible',
  },
  input: InputStyle,
  // The input's shape, in the cream that the rest of the app uses for something already decided,
  // so it does not invite a tap that would do nothing.
  readOnly: {
    ...InputStyle,
    backgroundColor: Colors.creamDeep,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  readOnlyValue: { flexShrink: 1 },
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
  thumb: {
    borderRadius: Radii.small,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbPhoto: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  confirmWrap: {
    gap: Spacing.two,
    backgroundColor: Colors.cream,
    borderRadius: Radii.medium,
    padding: Spacing.three,
  },
  confirmRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  confirmGrow: { flex: 1 },
  deleteBtn: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.two,
  },
});
