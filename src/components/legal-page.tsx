import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import type { LegalDocument } from '@/lib/legal';

// One renderer for all three documents, so they cannot drift apart in how they look and so the
// wording lives somewhere diffable rather than buried in markup. See src/lib/legal.ts.
//
// Headings are real headings — a screen reader user reading a privacy statement should be able to
// jump to "Your rights" rather than swipe through it. That is the least this particular set of
// pages can do, given one of them is about exactly that.
export function LegalPage({ document }: { document: LegalDocument }) {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="title" heading={1}>
            {document.title}
          </ThemedText>
          <ThemedText type="small" themeColor="inkSoft">
            Last updated {document.updated}
          </ThemedText>

          {document.intro.map((line) => (
            <ThemedText key={line} type="default">
              {line}
            </ThemedText>
          ))}

          {document.sections.map((section) => (
            <View key={section.heading} style={styles.section}>
              <ThemedText type="subtitle" heading={2}>
                {section.heading}
              </ThemedText>
              {section.body?.map((line) => (
                <ThemedText key={line} type="default">
                  {line}
                </ThemedText>
              ))}
              {section.list?.map((item) => (
                <View key={item} style={styles.item}>
                  <ThemedText type="default" style={styles.bullet}>
                    •
                  </ThemedText>
                  <ThemedText type="default" style={styles.itemText}>
                    {item}
                  </ThemedText>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  scroll: { padding: Spacing.four, paddingBottom: Spacing.six * 2, gap: Spacing.two },
  section: { gap: Spacing.two, marginTop: Spacing.four },
  item: { flexDirection: 'row', gap: Spacing.two, paddingRight: Spacing.two },
  bullet: { lineHeight: 24 },
  itemText: { flex: 1 },
});
