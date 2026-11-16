import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { KnitIcon, type KnitIconName } from './icons/KnitIcon';
import { ThemedText } from './themed-text';

import { Colors, Radii, Spacing } from '@/constants/theme';

// The web's navigation, described once.
//
// The tab screens and the pushed screens each draw a bar of their own — they have to, because one
// is made of tab triggers and the other of links — and each used to keep its own copy of this
// list. They were the same six entries in two files, which is one edit away from a menu that
// changes when you open a pattern.
//
// Five, and in the order the iOS tab bar has them: the counter in the middle, under the thumb,
// with the two collections either side of it. Account is not here. It is settings, visited once a
// month, and it lives behind the avatar at the top of Home on a phone and at the far end of the
// bar on a wide window.
export const NAV_ITEMS = [
  { name: 'home', href: '/', label: 'Home', icon: 'home' },
  { name: 'projects', href: '/projects', label: 'Projects', icon: 'yarn' },
  { name: 'counter', href: '/counter', label: 'Counter', icon: 'counter' },
  { name: 'library', href: '/library', label: 'Library', icon: 'library' },
  { name: 'calculator', href: '/calculator', label: 'Calculator', icon: 'gauge' },
] as const satisfies readonly { name: string; href: string; label: string; icon: KnitIconName }[];

// Which bar a window gets.
//   - 'bottom'  a phone-sized window: icons over labels along the bottom edge.
//   - 'compact' too narrow for words beside the logo: icons only, across the top.
//   - 'full'    icons and words across the top.
export type NavLayout = 'bottom' | 'compact' | 'full';

// What one entry looks like in each of them. Only the look: the caller wraps it in whatever makes
// it navigate.
export function NavItem({
  icon,
  label,
  active,
  layout,
}: {
  icon: KnitIconName;
  label: string;
  active: boolean;
  layout: NavLayout;
}) {
  const color = active ? Colors.ink : Colors.inkSoft;
  if (layout === 'bottom') {
    return (
      <View style={styles.bottomItem}>
        <View style={[styles.bottomIcon, active && styles.activePill]}>
          <KnitIcon name={icon} size={22} color={color} accent={active ? Colors.white : undefined} />
        </View>
        <ThemedText type="small" themeColor={active ? 'ink' : 'inkSoft'} numberOfLines={1} style={styles.bottomLabel}>
          {label}
        </ThemedText>
      </View>
    );
  }
  return (
    <View style={[styles.topItem, active && styles.activePill]}>
      <KnitIcon
        name={icon}
        size={layout === 'compact' ? 22 : 18}
        color={color}
        accent={active ? Colors.white : undefined}
      />
      {layout === 'full' && (
        <ThemedText type="smallBold" themeColor={active ? 'ink' : 'inkSoft'}>
          {label}
        </ThemedText>
      )}
    </View>
  );
}

// Account, at the far end of the bar on a wide window. A link rather than a tab: it is a screen
// you visit and come back from, not a place the app lives in.
export function AccountLink({ active }: { active: boolean }) {
  return (
    <Link
      href="/account"
      aria-current={active ? 'page' : undefined}
      accessibilityLabel="Account"
      style={styles.account}>
      <NavItem icon="account" label="Account" active={active} layout="compact" />
    </Link>
  );
}

export const navStyles = StyleSheet.create({
  // The bar across the top of a wide window.
  topBar: {
    width: '100%',
    paddingVertical: Spacing.two + Spacing.one,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    backgroundColor: Colors.creamDeep,
  },
  topInner: {
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: 800,
  },
  // The links sit in their own group pushed to the right, rather than trailing the logo. It leaves
  // the middle of the bar clear, and the nav lands where a browser's own controls are.
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginLeft: 'auto',
  },
  // The bar along the bottom of a phone-sized window. Padded for the home indicator, which on the
  // web is only known to CSS.
  bottomBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    backgroundColor: Colors.cream,
    borderTopWidth: 1,
    borderTopColor: Colors.creamDeep,
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingBottom: 'max(8px, env(safe-area-inset-bottom))' as unknown as number,
  },
  bottomSlot: { flex: 1 },
  pressed: { opacity: 0.7 },
});

const styles = StyleSheet.create({
  account: { flexShrink: 0 },
  topItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + Spacing.half,
    paddingVertical: Spacing.one + Spacing.half,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.pill,
    // A nav item is its icon and its word at full size or not at all — never a squashed version of
    // either. If they ever don't fit, the layout drops the labels; it is not this row's job to
    // compress them.
    flexShrink: 0,
  },
  activePill: {
    backgroundColor: Colors.blush,
  },
  bottomItem: {
    alignItems: 'center',
    gap: Spacing.half,
  },
  bottomIcon: {
    width: 52,
    height: 30,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomLabel: {
    fontSize: 11,
    lineHeight: 14,
  },
});
