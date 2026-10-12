import { Tabs, TabList, TabTrigger, TabSlot, TabTriggerSlotProps, TabListProps } from 'expo-router/ui';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Brand } from './brand';
import { KnitIcon, type KnitIconName } from './icons/KnitIcon';
import { ThemedText } from './themed-text';

import { Colors, CompactNavBelow, MaxContentWidth, Spacing } from '@/constants/theme';

const TABS = [
  { name: 'home', href: '/', label: 'Home', icon: 'home' },
  { name: 'projects', href: '/projects', label: 'Projects', icon: 'yarn' },
  { name: 'library', href: '/library', label: 'Library', icon: 'library' },
  { name: 'counter', href: '/counter', label: 'Counter', icon: 'counter' },
  { name: 'calculator', href: '/calculator', label: 'Calculator', icon: 'gauge' },
  { name: 'account', href: '/account', label: 'Account', icon: 'account' },
] as const satisfies readonly { name: string; href: string; label: string; icon: KnitIconName }[];

export default function AppTabs() {
  const compact = useWindowDimensions().width < CompactNavBelow;
  return (
    <Tabs style={styles.tabs}>
      <TabList asChild>
        <CustomTabList compact={compact}>
          {TABS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TabButton icon={tab.icon} compact={compact}>
                {tab.label}
              </TabButton>
            </TabTrigger>
          ))}
        </CustomTabList>
      </TabList>
      <TabSlot style={styles.slot} />
    </Tabs>
  );
}

export function TabButton({
  children,
  isFocused,
  icon,
  compact,
  ...props
}: TabTriggerSlotProps & { icon?: KnitIconName; compact?: boolean }) {
  return (
    <Pressable
      {...props}
      accessibilityLabel={compact && typeof children === 'string' ? children : undefined}
      style={({ pressed }) => pressed && styles.pressed}>
      <View style={[styles.tabButtonView, isFocused && styles.tabButtonViewSelected]}>
        {icon && (
          <KnitIcon
            name={icon}
            size={compact ? 22 : 18}
            color={isFocused ? Colors.ink : Colors.inkSoft}
            accent={isFocused ? Colors.white : undefined}
          />
        )}
        {!compact && (
          <ThemedText type="smallBold" themeColor={isFocused ? 'ink' : 'inkSoft'}>
            {children}
          </ThemedText>
        )}
      </View>
    </Pressable>
  );
}

export function CustomTabList({ compact, ...props }: TabListProps & { compact?: boolean }) {
  return (
    <View {...props} style={styles.tabListContainer}>
      <View style={styles.innerContainer}>
        <Brand compact={compact} />
        {/* The tabs sit in their own group pushed to the right, rather than trailing the logo.
            Same reasoning as the header on the pushed screens, and the two have to agree —
            navigating between them shouldn't move the menu. */}
        <View style={styles.nav}>{props.children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flex: 1,
  },
  slot: {
    flex: 1,
  },
  tabListContainer: {
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    backgroundColor: Colors.creamDeep,
  },
  innerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginLeft: 'auto',
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + Spacing.half,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  tabButtonViewSelected: {
    backgroundColor: Colors.blush,
  },
});
