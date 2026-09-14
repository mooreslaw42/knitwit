import { Link, usePathname } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Brand } from './brand';
import { ThemedText } from './themed-text';

import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';

// The same navigation the tab screens get, for screens pushed onto the root stack (pattern and
// project detail, the wizards, the section/row editors). Those sit outside the (tabs) group, so
// without this they'd strand the user with only a back arrow.
const NAV = [
  { href: '/', label: 'Home' },
  { href: '/projects', label: 'Projects' },
  { href: '/library', label: 'Library' },
  { href: '/counter', label: 'Counter' },
  { href: '/calculator', label: 'Calculator' },
  { href: '/account', label: 'Account' },
] as const;

// A detail screen still belongs to a section of the app — keep that tab lit while you're in it.
function activeHref(pathname: string): string | null {
  if (pathname.startsWith('/pattern') || pathname.startsWith('/technique')) return '/library';
  if (pathname.startsWith('/project')) return '/projects';
  // Yarn and tools live under the Library now, so their detail screens light it up too.
  if (pathname.startsWith('/material') || pathname.startsWith('/tool')) return '/library';
  return null;
}

export default function AppHeader() {
  const pathname = usePathname();
  const active = activeHref(pathname);

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <Brand />
        {/* The links sit in their own group pushed to the right, rather than trailing the logo.
            It leaves the middle of the bar clear, and the nav lands where a browser's own
            controls are — which is where the eye goes looking for it. */}
        <View style={styles.nav}>
          {NAV.map((item) => {
          const isActive = item.href === active;
          return (
            // A real anchor rather than a Pressable that calls navigate: this is the site's main
            // navigation, and it should be openable in a new tab and copyable like any other link.
            <Link
              key={item.href}
              href={item.href}
              // Announces "you are here" to a screen reader, which the pink pill only says
              // visually.
              aria-current={isActive ? 'page' : undefined}
              style={[styles.link, isActive && styles.linkActive]}>
              <ThemedText type="smallBold" themeColor={isActive ? 'ink' : 'inkSoft'}>
                {item.label}
              </ThemedText>
              </Link>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    backgroundColor: Colors.creamDeep,
  },
  inner: {
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
  link: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  linkActive: {
    backgroundColor: Colors.blush,
  },
});
