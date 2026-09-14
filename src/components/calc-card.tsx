import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radii, Spacing } from '@/constants/theme';

// One job on the calculator, with the same shape every time: a question, the things you tell it,
// and the answer.
//
// The visual grammar matters more here than anywhere else in the app. Everything on this screen
// is a number, and a knitter arriving mid-project needs to know at a glance which numbers they
// typed and which the app worked out. Inputs sit on the white card; the answer sits in a tinted
// well with a sage edge and reads at title size. Nothing else in the app uses that combination.
export function CalcCard({
  title,
  question,
  children,
}: {
  title: string;
  // The use case in the knitter's words — what you'd have come to this card to find out.
  question: string;
  children: React.ReactNode;
}) {
  return (
    <Card style={styles.card}>
      <ThemedText type="subtitle">{title}</ThemedText>
      <ThemedText type="small" themeColor="inkSoft">
        {question}
      </ThemedText>
      {children}
    </Card>
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

// Shown in the answer's place when there isn't one yet — same position, same size, so the card
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

// Groups the fields you fill in, so a card with several reads as one question rather than four.
export function Inputs({ children }: { children: React.ReactNode }) {
  return <View style={styles.inputs}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two },
  inputs: { gap: Spacing.two },
  answer: {
    gap: 2,
    backgroundColor: Colors.cream,
    borderRadius: Radii.medium,
    borderLeftWidth: 4,
    borderLeftColor: Colors.sageDeep,
    padding: Spacing.three,
    marginTop: Spacing.one,
  },
  pending: {
    backgroundColor: Colors.cream,
    borderRadius: Radii.medium,
    borderLeftWidth: 4,
    borderLeftColor: Colors.creamDeep,
    padding: Spacing.three,
    marginTop: Spacing.one,
  },
});
