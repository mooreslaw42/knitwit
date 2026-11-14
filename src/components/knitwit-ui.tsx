import { KnitIcon, type KnitIconName } from '@/components/icons/KnitIcon';
import { AnimatedProgressBar } from '@/components/motion/AnimatedProgressBar';
import { PressableScale } from '@/components/motion/PressableScale';
import { PhotoImage } from '@/components/photo';
import { SelectControl } from '@/components/select-control';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { PROJECT_STATUS_LABELS } from '@/constants/catalogs';
import {
  Colors,
  Fonts,
  Radii,
  ScreenPadding,
  Shadows,
  Spacing,
  type ThemeColor,
} from '@/constants/theme';
import type { ProjectStatus, SectionStatus } from '@/types/knitwit';

// The one text-input look, exported so the platform-split AutoGrowInput can wear it without
// keeping a second copy that drifts.
//
// The border is not decoration. A white input with no edge is invisible the moment it sits on
// anything white — which is every form inside a Card, Cards being white too — so the only thing
// marking a field was the text already in it, and an empty one looked like a gap in the layout.
// The calculator showed it worst, where a placeholder "22" was indistinguishable from a 22 somebody
// had typed, but it was true of every form in the app.
export const InputStyle = {
  backgroundColor: Colors.white,
  borderWidth: 1,
  borderColor: Colors.creamDeep,
  borderRadius: Radii.medium,
  paddingHorizontal: Spacing.three,
  paddingVertical: Spacing.three,
  fontFamily: Fonts.bodySemibold,
  fontSize: 15,
  color: Colors.ink,
} as const;

// Placeholders are examples, not values, and have to read as examples at a glance. Lighter than
// `inkSoft` on purpose: the label above carries the meaning, so this text is allowed to sit below
// body-copy contrast — and needs to, because at `inkSoft` it looked like an answer.
export const PlaceholderColor = '#B9ABA6';

export function Card({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
}

// What a tappable row in a list looks like: the same white, the same corner and the same lift as
// a Card, at the tighter padding a row wants. Exported as a style because the rows are CardLinks
// and each lays its own contents out — but the surface they sit on should not be theirs to choose.
export const RowSurface = {
  backgroundColor: Colors.white,
  borderRadius: Radii.medium,
  padding: Spacing.three,
  ...Shadows.card,
} as const;

// A filter, not an action.
//
// The selected chip used to be filled in the primary button's pink — and on Projects, in lavender
// on the second row and coral on the third. Three accents to say "selected" meant a knitter had to
// learn the screen before they could read it, and the pink ones competed with the real button
// above them. Selected is ink now, on every row of every screen: unmistakably on, and nothing like
// a call to action.
export function Chip({
  label,
  selected = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      // The chip is 36 tall, which is as tall as a row of them can be without crowding; the slop
      // makes up the difference to a full-size touch target.
      hitSlop={{ top: 4, bottom: 4 }}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}>
      <ThemedText
        type="smallBold"
        numberOfLines={1}
        themeColor={selected ? 'white' : 'ink'}
        style={styles.chipText}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

// A row of chips that scrolls sideways and runs off the edge of the screen.
//
// Running off the edge is the point: a half-visible chip is how a row says there is more of it.
// The rows on Projects were plain Views, so a fourth filter simply was not there on a phone — it
// was cut off at the margin with nothing to suggest it existed.
export function ChipRow({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.chipRow, style]}
      contentContainerStyle={styles.chipRowContent}>
      {children}
    </ScrollView>
  );
}

// A round button that is only an icon. `label` is not optional: with no words on it, the label is
// the only thing a screen reader has to say.
export function IconButton({
  icon,
  label,
  onPress,
  variant = 'surface',
  size = 44,
}: {
  icon: KnitIconName;
  label: string;
  onPress: () => void;
  // 'primary' is the one thing to do on this screen; 'surface' is everything else.
  variant?: 'primary' | 'surface';
  size?: number;
}) {
  const primary = variant === 'primary';
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      onPress={onPress}
      style={[
        styles.iconButton,
        { width: size, height: size },
        primary ? styles.iconButtonPrimary : styles.iconButtonSurface,
      ]}>
      <KnitIcon
        name={icon}
        size={Math.round(size * 0.5)}
        color={primary ? Colors.white : Colors.ink}
        accent={primary ? Colors.white : undefined}
      />
    </PressableScale>
  );
}

// The one search box. It was a bare TextInput restyled on each screen that had one.
export function SearchField({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.search}>
      <KnitIcon name="search" size={18} color={Colors.inkSoft} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.inkSoft}
        accessibilityLabel={placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
        style={styles.searchInput}
      />
    </View>
  );
}

// The knitter, as a circle with their initial in it. Where there is no name yet it shows the
// account icon instead — a blank disc, or a "?" would read as something having gone wrong.
export function Avatar({ name, size = 44 }: { name?: string; size?: number }) {
  const initial = name?.trim().charAt(0).toUpperCase();
  return (
    <View style={[styles.avatar, { width: size, height: size }]}>
      {initial ? (
        <ThemedText type="subtitle" themeColor="ink">
          {initial}
        </ThemedText>
      ) : (
        <KnitIcon name="account" size={Math.round(size * 0.5)} color={Colors.ink} accent={Colors.white} />
      )}
    </View>
  );
}

// Fills up smoothly when the value changes, and honours Reduce Motion — see
// components/motion/AnimatedProgressBar.tsx. Same props as before, so no call site changes.
export const ProgressBar = AnimatedProgressBar;

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
        placeholderTextColor={PlaceholderColor}
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
      {/* Platform-split: a <select> on the web, a sheet on a phone. See select-control.tsx. */}
      <SelectControl label={label} options={options} value={value} onChange={onChange} />
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
    ...Shadows.card,
  },
  chip: {
    height: 36,
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.creamDeep,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
  },
  chipSelected: {
    backgroundColor: Colors.ink,
    borderColor: Colors.ink,
  },
  chipText: { maxWidth: 200 },
  // Bleeds through the page gutter and pads itself back in, so the first chip lines up with
  // everything else on the screen and the last one can scroll right to the edge.
  chipRow: {
    flexGrow: 0,
    marginHorizontal: -ScreenPadding,
  },
  chipRowContent: {
    paddingHorizontal: ScreenPadding,
    gap: Spacing.two,
  },
  iconButton: {
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPrimary: {
    backgroundColor: Colors.blushDeep,
    ...Shadows.card,
  },
  iconButtonSurface: {
    backgroundColor: Colors.white,
    ...Shadows.card,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.creamDeep,
    borderRadius: Radii.medium,
    paddingHorizontal: Spacing.three,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 13,
    fontFamily: Fonts.bodySemibold,
    fontSize: 15,
    color: Colors.ink,
  },
  avatar: {
    borderRadius: Radii.pill,
    backgroundColor: Colors.blush,
    alignItems: 'center',
    justifyContent: 'center',
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
});
