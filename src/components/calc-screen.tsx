import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';

// One calculator, on a screen of its own.
//
// This used to be CalcCard, and six of them were stacked on one route — which meant that past the
// first, you could never see a card's inputs and its answer at the same time. That is the one thing
// the layout below exists to give you, so the card became a screen: a question, the things you tell
// it, and the answer, with nothing else competing.
//
// The visual grammar is unchanged and matters more here than anywhere else in the app. Everything
// on screen is a number, and a knitter arriving mid-project needs to know at a glance which numbers
// they typed and which the app worked out. Inputs sit on the white card; the answer sits in a
// tinted well with a sage edge and reads at title size. Nothing else in the app uses that
// combination.
export function CalcScreen({
  title,
  // The use case in the knitter's words — what you'd have come here to find out.
  question,
  // Off for a screen that isn't a calculator — the not-found one has nothing it could have saved,
  // and reassuring somebody about a screen with no inputs on it reads as a non-sequitur.
  saveNote = true,
  children,
}: {
  title: string;
  question: string;
  saveNote?: boolean;
  children: React.ReactNode;
}) {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.heading}>
            <ThemedText type="title" heading={1}>
              {title}
            </ThemedText>
            <ThemedText type="small" themeColor="inkSoft">
              {question}
            </ThemedText>
          </View>
          {children}
          {/* Said once, at the bottom, rather than on each of six cards. */}
          {saveNote ? (
            <ThemedText type="small" themeColor="inkSoft">
              Nothing here is saved — it changes no pattern and no project.
            </ThemedText>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

// The answer. `value` is the number you came for; everything else is the working.
export function Answer({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.answer}>
      <ThemedText type="small" themeColor="sageDeep">
        {label}
      </ThemedText>
      <ThemedText type="title">{value}</ThemedText>
      {children}
    </View>
  );
}

// Shown in the answer's place when there isn't one yet — same position, same size, so the screen
// doesn't jump about as it becomes answerable.
export function NeedsInput({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.pending}>
      <ThemedText type="small" themeColor="inkSoft">
        {children}
      </ThemedText>
    </View>
  );
}

// Groups the fields you fill in, so a screen with several reads as one question rather than four.
export function Inputs({ children }: { children: React.ReactNode }) {
  return <Card style={styles.inputs}>{children}</Card>;
}

// A second answer on a screen that honestly has two — the needle calculator reads its model both
// ways round. Quieter than `Answer` so the one you came for still leads.
export function Aside({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.aside}>
      <ThemedText type="smallBold" themeColor="inkSoft">
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  content: {
    padding: Spacing.four,
    paddingBottom: Spacing.six * 2,
    gap: Spacing.three,
  },
  heading: { gap: Spacing.one },
  inputs: { gap: Spacing.two },
  aside: { gap: Spacing.two },
  answer: {
    gap: 2,
    backgroundColor: Colors.cream,
    borderRadius: Radii.medium,
    borderLeftWidth: 4,
    borderLeftColor: Colors.sageDeep,
    padding: Spacing.three,
  },
  pending: {
    backgroundColor: Colors.cream,
    borderRadius: Radii.medium,
    borderLeftWidth: 4,
    borderLeftColor: Colors.creamDeep,
    padding: Spacing.three,
  },
});
