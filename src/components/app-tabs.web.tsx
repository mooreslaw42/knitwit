import { Tabs, TabList, TabTrigger, TabSlot, TabTriggerSlotProps, TabListProps } from 'expo-router/ui';
import { Pressable, StyleSheet, View } from 'react-native';

import { Brand } from './brand';
import { AccountLink, NAV_ITEMS, NavItem, navStyles, type NavLayout } from './web-nav';

import type { KnitIconName } from './icons/KnitIcon';
import { useNavLayout } from '@/lib/use-nav-layout';

export default function AppTabs() {
  const layout = useNavLayout();
  const triggers = NAV_ITEMS.map((tab) => (
    <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
      <TabButton icon={tab.icon} label={tab.label} layout={layout} />
    </TabTrigger>
  ));

  // On a phone-sized window the bar goes along the bottom, where it is on iOS and where a thumb
  // can reach it. Six icons and a logo across the top of a 375px screen did not fit: the logo was
  // cut off on one side and Account on the other, and the whole page scrolled sideways to show it.
  if (layout === 'bottom') {
    return (
      <Tabs style={styles.tabs}>
        <TabSlot style={styles.slot} />
        <TabList asChild>
          <View style={navStyles.bottomBar}>{triggers}</View>
        </TabList>
      </Tabs>
    );
  }

  return (
    <Tabs style={styles.tabs}>
      <TabList asChild>
        <TopBar compact={layout === 'compact'}>{triggers}</TopBar>
      </TabList>
      <TabSlot style={styles.slot} />
    </Tabs>
  );
}

// The bar across the top, as a component that is handed the triggers as its own children.
//
// It has to be shaped this way. The router works out which screens exist by reading the triggers
// directly under the TabList's child; bury them a few Views down, where the layout actually wants
// them, and it finds none and the whole tab navigator fails to mount. So the triggers arrive here
// as children and this is what puts them inside the logo-and-nav arrangement.
function TopBar({ compact, children, ...props }: TabListProps & { compact: boolean }) {
  return (
    <View {...props} style={navStyles.topBar}>
      <View style={navStyles.topInner}>
        <Brand compact={compact} />
        <View style={navStyles.topNav}>
          {children}
          <AccountLink active={false} />
        </View>
      </View>
    </View>
  );
}

function TabButton({
  isFocused,
  icon,
  label,
  layout,
  ...props
}: TabTriggerSlotProps & { icon: KnitIconName; label: string; layout: NavLayout }) {
  return (
    <Pressable
      {...props}
      // Icons-only still has to say what it is.
      accessibilityLabel={layout === 'compact' ? label : undefined}
      style={({ pressed }) => [layout === 'bottom' && navStyles.bottomSlot, pressed && navStyles.pressed]}>
      <NavItem icon={icon} label={label} active={!!isFocused} layout={layout} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabs: { flex: 1 },
  slot: { flex: 1 },
});
