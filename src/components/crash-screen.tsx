import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PillButton } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { readRawStore, rescueFilename } from '@/lib/backup';
import { saveTextFile } from '@/lib/save-file';

// What a knitter meets when something has gone properly wrong.
//
// The point of this screen is not the apology. It is that a knitter looking at a broken app will
// reasonably try to fix it, and the fix everyone reaches for — clear the site data and reload — is
// the one action that destroys a year of work, because there is no account and no copy anywhere
// else. So the first thing offered here is a way to get the data off the device, and the first
// thing said is that it is still there.
export function CrashScreen({
  title,
  detail,
  onRetry,
}: {
  title: string;
  // The error itself, kept verbatim so it can be copied into a message to whoever can fix it.
  detail: string;
  onRetry?: () => void;
}) {
  const [saved, setSaved] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const rescue = async () => {
    const raw = await readRawStore();
    if (!raw) {
      setSaved('There was nothing saved on this device to rescue.');
      return;
    }
    // Deliberately not the ordinary backup path: that one parses the store, which is exactly what
    // cannot be trusted here. These are the bytes, whatever they are.
    const ok = await saveTextFile(rescueFilename(), raw);
    if (ok) setSaved(`Saved ${Math.round(raw.length / 1024)} KB. Keep it somewhere safe.`);
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title" heading={1}>
          {title}
        </ThemedText>

        <ThemedText type="default">
          Your projects, patterns and counts are still on this device. Nothing has been deleted.
        </ThemedText>
        <ThemedText type="small" themeColor="coralDeep">
          Please don&apos;t clear your browser data to try to fix this — that is the one thing that
          would actually lose your work. Save a copy first.
        </ThemedText>

        <PillButton onPress={() => void rescue()} style={styles.btn}>
          <ThemedText type="smallBold" themeColor="white">
            Save a copy of my data
          </ThemedText>
        </PillButton>

        {saved ? (
          <ThemedText type="small" themeColor="sageDeep">
            {saved}
          </ThemedText>
        ) : null}

        {onRetry ? (
          <PillButton variant="secondary" onPress={onRetry} style={styles.btn}>
            <ThemedText type="smallBold" themeColor="ink">
              Try again
            </ThemedText>
          </PillButton>
        ) : null}

        {/* Folded away by default. A knitter does not need to read a stack trace, but the one
            person who can fix it does, and asking them to reproduce it is worse than showing it. */}
        <Pressable onPress={() => setShowDetail((v) => !v)} hitSlop={6} style={styles.detailToggle}>
          <ThemedText type="smallBold" themeColor="sageDeep">
            {showDetail ? 'Hide the details' : 'Show the details to send on'}
          </ThemedText>
        </Pressable>

        {showDetail ? (
          <View style={styles.detailBox}>
            <ThemedText type="small" themeColor="inkSoft" selectable>
              {detail}
            </ThemedText>
          </View>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    padding: Spacing.four,
    paddingTop: Spacing.six,
    gap: Spacing.three,
  },
  btn: { alignSelf: 'flex-start' },
  detailToggle: { alignSelf: 'flex-start', paddingVertical: Spacing.one },
  detailBox: {
    backgroundColor: Colors.white,
    borderRadius: Radii.medium,
    padding: Spacing.three,
  },
});
