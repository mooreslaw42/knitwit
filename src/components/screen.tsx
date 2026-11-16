import { useEffect, useRef, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { KnitIcon } from '@/components/icons/KnitIcon';
import { PressableScale } from '@/components/motion/PressableScale';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  Colors,
  MaxContentWidth,
  ScreenPadding,
  Spacing,
  TabBarClearance,
} from '@/constants/theme';

// The frame every screen stands in.
//
// Each screen used to build this itself — a ThemedView, a SafeAreaView, a ScrollView, a max width
// and a set of paddings — and no two had quite the same numbers. The gutter was 24 on most, 16 on
// one and missing on another; the gap under the title depended on which file you were in. None of
// it was wrong on its own screen. Together it is what made moving between tabs feel like moving
// between apps.
//
// `kind` is the only real difference between screens:
//   - 'tab'    sits under the status bar and above the tab bar, so it pads for both.
//   - 'pushed' sits under the native stack header, which has already cleared the status bar, and
//              runs to the bottom of the screen.
//   - 'wizard' has no header of its own kind at all — it draws its top row itself (WizardHeader)
//              — so it clears the status bar and the home indicator both.
export function Screen({
  kind = 'tab',
  children,
  scroll = true,
  contentStyle,
  footer,
  scrollResetKey,
}: {
  kind?: 'tab' | 'pushed' | 'wizard';
  children: ReactNode;
  // False for a screen that lays itself out to the full height — the counter, whose big button
  // has to stay under a thumb rather than scroll away from it.
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  // Pinned beneath the scrolling content: the one action a screen exists for.
  footer?: ReactNode;
  // When this changes, the screen scrolls back to the top. A wizard passes its step: each step is
  // a new page, and pressing Next at the foot of a long one used to open the following step
  // already scrolled past its own heading.
  scrollResetKey?: string | number;
}) {
  const scroller = useRef<ScrollView>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ y: 0, animated: false });
  }, [scrollResetKey]);

  const edges: Edge[] =
    kind === 'tab'
      ? ['top', 'left', 'right']
      : kind === 'wizard'
        ? ['top', 'left', 'right', 'bottom']
        : ['left', 'right', 'bottom'];
  const content = [
    styles.content,
    kind === 'tab' ? styles.contentTab : kind === 'wizard' ? styles.contentWizard : styles.contentPushed,
    contentStyle,
  ];
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={edges}>
        {scroll ? (
          <ScrollView
            ref={scroller}
            contentContainerStyle={content}
            keyboardShouldPersistTaps="handled"
            // The field being typed in stays above the keyboard, and a drag puts the keyboard
            // away. Neither was set anywhere, so on a phone the lower half of every form —
            // including its Save button — sat underneath the keyboard with no way to reach it
            // but to dismiss the keyboard first. Owning the scroll view means fixing it once.
            automaticallyAdjustKeyboardInsets
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.fill, content]}>{children}</View>
        )}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </SafeAreaView>
    </ThemedView>
  );
}

// A tab's name, with room beside it for the one thing you can do there.
//
// One component so the title is the same size, on the same baseline, the same distance from the
// top on every tab — and so "add" is always the same round button in the same corner, rather than
// a pill reading "+ New project" on one tab and "+ New pattern" on the next.
export function ScreenHeader({
  title,
  subtitle,
  trailing,
}: {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <ThemedText type="largeTitle" heading={1} numberOfLines={2}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="body" themeColor="inkSoft">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {trailing ? <View style={styles.headerTrailing}>{trailing}</View> : null}
    </View>
  );
}

// The top of a wizard: the way back, where you are, and what this step is called.
//
// The three wizards — new project, new pattern, new yarn — each had their own copy of this, down
// to the 20-point spacer that balanced a text arrow. The arrow was the character "←" set in body
// type, which is a small, thin target for the one control that gets you out.
//
// `onBack` steps back through the wizard and only leaves it from the first step; that is the
// caller's to decide, which is why these screens draw this instead of taking the native header.
export function WizardHeader({
  step,
  total,
  label,
  onBack,
}: {
  // Zero-based.
  step: number;
  total: number;
  label: string;
  onBack: () => void;
}) {
  return (
    <View style={styles.wizard}>
      <View style={styles.wizardBar}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          haptic="none"
          onPress={onBack}
          style={styles.wizardBack}>
          <KnitIcon name="back" size={20} color={Colors.ink} />
        </PressableScale>
        <View
          style={styles.wizardDots}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={`Step ${step + 1} of ${total}`}>
          {Array.from({ length: total }, (_, i) => (
            <View
              key={i}
              style={[
                styles.wizardDot,
                i < step && styles.wizardDotDone,
                i === step && styles.wizardDotActive,
              ]}
            />
          ))}
        </View>
        {/* Balances the back button so the dots sit in the true centre. */}
        <View style={styles.wizardBack} />
      </View>
      <ThemedText type="small" themeColor="inkSoft" style={styles.wizardCaption}>
        Step {step + 1} of {total} · {label}
      </ThemedText>
    </View>
  );
}

// The heading over a group of things, with an optional quiet action at its other end.
//
// The action is text, never a filled button. A filled button says "this is what to do next", and
// a screen with one in every section heading has no next thing at all.
export function SectionHeader({
  title,
  actionLabel,
  onAction,
  actionIcon = 'forward',
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  // 'forward' goes somewhere (the default); 'plus' makes something.
  actionIcon?: 'forward' | 'plus';
}) {
  return (
    <View style={styles.sectionHeader}>
      <ThemedText type="subtitle" heading={2} style={styles.sectionTitle}>
        {title}
      </ThemedText>
      {actionLabel && onAction ? (
        <PressableScale
          accessibilityRole="button"
          hitSlop={10}
          scaleTo={0.96}
          haptic="none"
          onPress={onAction}
          style={styles.sectionAction}>
          {actionIcon === 'plus' ? <KnitIcon name="plus" size={14} color={Colors.sageDeep} /> : null}
          <ThemedText type="smallBold" themeColor="sageDeep">
            {actionLabel}
          </ThemedText>
          {actionIcon === 'forward' ? (
            <KnitIcon name="forward" size={14} color={Colors.sageDeep} />
          ) : null}
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  fill: { flex: 1 },
  content: {
    paddingHorizontal: ScreenPadding,
    gap: Spacing.three,
  },
  contentTab: {
    // On a phone the safe area has already put the status bar above this. In a browser there is
    // nothing above it at all, so the title needs the room itself.
    paddingTop: Platform.OS === 'web' ? Spacing.four : Spacing.two,
    paddingBottom: TabBarClearance,
  },
  contentPushed: {
    paddingTop: Spacing.two,
    paddingBottom: Spacing.five,
  },
  contentWizard: {
    paddingTop: Spacing.two,
    paddingBottom: Spacing.six,
  },
  wizard: { gap: Spacing.two },
  wizardBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wizardBack: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    // Pulled out by the icon's own inset so the arrow, not the invisible square around it, lines
    // up with the page gutter.
    marginLeft: -12,
    marginRight: -12,
  },
  wizardDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + Spacing.half,
  },
  wizardDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.creamDeep,
  },
  wizardDotDone: { backgroundColor: Colors.sage },
  // The step you are on is a bar, not a dot, so it reads at a glance without relying on colour.
  wizardDotActive: { width: 20, backgroundColor: Colors.blushDeep },
  wizardCaption: { textAlign: 'center' },
  footer: {
    paddingHorizontal: ScreenPadding,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    backgroundColor: Colors.cream,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 48,
  },
  headerText: {
    flex: 1,
    gap: Spacing.half,
  },
  headerTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  sectionTitle: { flexShrink: 1 },
  sectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
  },
});
