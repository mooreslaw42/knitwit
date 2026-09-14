import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';

// The logo, which is a link home.
//
// It was a plain label. Clicking the logo to get home is the one convention every website shares,
// and it is the first thing anyone reaches for when they are lost — which is exactly when it
// matters that it does nothing.
//
// A real <Link>, so on web it is an anchor: ⌘-click opens a new tab, the status bar previews the
// URL, and it can be copied like any other link.
export function Brand({ style }: { style?: React.ComponentProps<typeof ThemedText>['style'] }) {
  return (
    <Link href="/" accessibilityLabel="Knitwit — go to the home page" style={styles.link}>
      <ThemedText type="smallBold" style={style}>
        🧶 Knitwit
      </ThemedText>
    </Link>
  );
}

const styles = StyleSheet.create({
  // Keeps the tap target off the text's baseline without moving the logo.
  link: { paddingVertical: 2 },
});
