import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { LegalDocument } from '@/lib/legal';

// One renderer for all three documents, so they cannot drift apart in how they look and so the
// wording lives somewhere diffable rather than buried in markup. See src/lib/legal.ts.
//
// Headings are real headings — a screen reader user reading a privacy statement should be able to
// jump to "Your rights" rather than swipe through it. That is the least this particular set of
// pages can do, given one of them is about exactly that.
export function LegalPage({ document }: { document: LegalDocument }) {
  return (
    <Screen kind="pushed">
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two, marginTop: Spacing.four },
  item: { flexDirection: 'row', gap: Spacing.two, paddingRight: Spacing.two },
  bullet: { lineHeight: 24 },
  itemText: { flex: 1 },
});
