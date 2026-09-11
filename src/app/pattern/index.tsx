import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

// `/pattern` on its own isn't a screen — a pattern is always `/pattern/<id>`. Without this route
// the router falls through to its unmatched-route page, which reads as a crash.
//
// The redirect happens in an effect rather than via <Redirect>, which renders to nothing during
// the Node pass expo-router uses to build web routes and fails the export with "Got unexpected
// undefined". This renders a real screen on the server and moves on once there's a router.
export default function PatternIndexScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/library');
  }, [router]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ThemedText type="small" themeColor="inkSoft">
          Taking you to the library…
        </ThemedText>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth, padding: Spacing.four },
});
