import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

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
  { href: '/materials', label: 'Materials' },
  { href: '/account', label: 'Account' },
] as const;

// A detail screen still belongs to a section of the app — keep that tab lit while you're in it.
function activeHref(pathname: string): string | null {
  if (pathname.startsWith('/pattern') || pathname.startsWith('/technique')) return '/library';
  if (pathname.startsWith('/project')) return '/projects';
  if (pathname.startsWith('/material') || pathname.startsWith('/tool')) return '/materials';
  return null;
}

export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const active = activeHref(pathname);

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <ThemedText type="smallBold" style={styles.brand}>
          🧶 Knitwit
        </ThemedText>
        {NAV.map((item) => {
          const isActive = item.href === active;
          return (
            <Pressable
              key={item.href}
              onPress={() => router.navigate(item.href)}
              style={({ pressed }) => [pressed && styles.pressed]}>
              <View style={[styles.link, isActive && styles.linkActive]}>
                <ThemedText type="smallBold" themeColor={isActive ? 'ink' : 'inkSoft'}>
                  {item.label}
                </ThemedText>
              </View>
            </Pressable>
          );
        })}
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
  brand: {
    marginRight: 'auto',
  },
  pressed: {
    opacity: 0.7,
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
