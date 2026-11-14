import { Link, usePathname } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Brand } from './brand';
import { AccountLink, NAV_ITEMS, NavItem, navStyles, type NavLayout } from './web-nav';

import { useNavLayout } from '@/lib/use-nav-layout';

// The same navigation the tab screens get, for screens pushed onto the root stack (pattern and
// project detail, the wizards, the section/row editors). Those sit outside the (tabs) group, so
// without this they'd strand the user with only a back arrow.
//
// Two halves because the bar is in two places: across the top of a wide window, along the bottom
// of a phone-sized one. Each half draws itself only when it is the one in use, so the root layout
// can mount both without asking how wide the window is.

// A detail screen still belongs to a section of the app — keep that tab lit while you're in it.
function activeHref(pathname: string): string | null {
  if (pathname.startsWith('/pattern') || pathname.startsWith('/technique')) return '/library';
  if (pathname.startsWith('/project')) return '/projects';
  // Yarn and tools live under the Library, so their detail screens light it up too.
  if (pathname.startsWith('/material') || pathname.startsWith('/tool')) return '/library';
  if (pathname.startsWith('/calculator')) return '/calculator';
  return null;
}

function NavLinks({ layout }: { layout: NavLayout }) {
  const active = activeHref(usePathname());
  return (
    <>
      {NAV_ITEMS.map((item) => {
        const isActive = item.href === active;
        return (
          // A real anchor rather than a Pressable that calls navigate: this is the site's main
          // navigation, and it should be openable in a new tab and copyable like any other link.
          <Link
            key={item.href}
            href={item.href}
            // Announces "you are here" to a screen reader, which the pink pill only says visually.
            aria-current={isActive ? 'page' : undefined}
            accessibilityLabel={layout === 'compact' ? item.label : undefined}
            style={layout === 'bottom' ? styles.bottomLink : styles.topLink}>
            <NavItem icon={item.icon} label={item.label} active={isActive} layout={layout} />
          </Link>
        );
      })}
    </>
  );
}

export default function AppHeader() {
  const layout = useNavLayout();
  const pathname = usePathname();
  if (layout === 'bottom') return null;
  return (
    <View style={navStyles.topBar}>
      <View style={navStyles.topInner}>
        <Brand compact={layout === 'compact'} />
        <View style={navStyles.topNav}>
          <NavLinks layout={layout} />
          <AccountLink active={pathname.startsWith('/account')} />
        </View>
      </View>
    </View>
  );
}

export function AppFooter() {
  const layout = useNavLayout();
  if (layout !== 'bottom') return null;
  return (
    <View style={navStyles.bottomBar}>
      <NavLinks layout="bottom" />
    </View>
  );
}

const styles = StyleSheet.create({
  topLink: { flexShrink: 0 },
  // An anchor is inline by default, which would leave each link as wide as its label and bunch
  // the five of them up at one end of the bar.
  bottomLink: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' },
});
