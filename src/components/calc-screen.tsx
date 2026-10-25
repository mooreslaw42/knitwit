import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KnitIcon } from '@/components/icons/KnitIcon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';

// One calculator, on a screen of its own, with the two halves told apart by more than a shade.
//
// The old grammar was "inputs on the white card, the answer in a tinted well", and on paper it was
// right. On screen it did not exist. The card is white and so is a text input, with no border
// between them, so a field was marked only by the text already in it and an empty one read as a gap
// in the layout — a placeholder "22" looked exactly like a 22 somebody had typed. And the tinted
// well was `cream` on a `cream` page: a 2% difference, which is to say none.
//
// What tells them apart now:
//
//   · Each half is announced. "You fill in" and "Knitwit works out" sit above their blocks, so the
//     direction of the screen is stated rather than implied.
//   · Fields have an edge (see InputStyle), so an empty one still looks like somewhere to type.
//   · Placeholders say "e.g." and are lighter than any real value, so an example cannot be read as
//     an answer.
//   · The answer is a solid sageDeep block in white text. Nothing else in Knitwit looks like that,
//     it cannot be mistaken for something you could edit, and white on sageDeep clears AA.
//   · The answer block is there before there is an answer, outlined and empty, saying what it still
//     needs — so you can see where the number will land while you are filling the form in.
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

// Says which half of the screen you are looking at. Repeated per group rather than once at the top,
// because a screen with two questions on it alternates between them.
function HalfLabel({ kind, children }: { kind: 'in' | 'out'; children: React.ReactNode }) {
  const out = kind === 'out';
  return (
    <View style={styles.halfLabel}>
      <KnitIcon
        name={out ? 'sparkle' : 'edit'}
        size={14}
        color={out ? Colors.sageDeep : Colors.inkSoft}
        accent={out ? Colors.sage : Colors.creamDeep}
      />
      <ThemedText type="smallBold" themeColor={out ? 'sageDeep' : 'inkSoft'} style={styles.caps}>
        {children}
      </ThemedText>
    </View>
  );
}

// The fields you fill in, grouped so a screen with several reads as one question rather than four.
export function Inputs({
  // A screen with more than one group says what each is for; a screen with one just says "You fill
  // in", which is the default.
  label = 'You fill in',
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.group}>
      <HalfLabel kind="in">{label}</HalfLabel>
      <View style={styles.inputs}>{children}</View>
    </View>
  );
}

// The answer. `value` is the number you came for; everything else is the working.
export function Answer({
  label,
  value,
  // Drops the "Knitwit works out" heading, for an answer already under an `Aside` that titles it.
  // Two headings stacked on one block reads as a mistake.
  bare = false,
  children,
}: {
  label: string;
  value: string;
  bare?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.group}>
      {bare ? null : <HalfLabel kind="out">Knitwit works out</HalfLabel>}
      <View style={styles.answer}>
        <ThemedText type="small" themeColor="white" style={styles.answerLabel}>
          {label}
        </ThemedText>
        <ThemedText type="title" themeColor="white">
          {value}
        </ThemedText>
        {children ? <View style={styles.working}>{children}</View> : null}
      </View>
    </View>
  );
}

// Shown in the answer's place when there isn't one yet.
//
// Same position, same heading, same shape — outlined instead of filled, so the screen does not jump
// about as it becomes answerable and you can see where the number is going to appear before you
// have finished typing.
export function NeedsInput({ bare = false, children }: { bare?: boolean; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      {bare ? null : <HalfLabel kind="out">Knitwit works out</HalfLabel>}
      <View style={styles.pending}>
        <ThemedText type="small" themeColor="inkSoft">
          Your answer appears here, once Knitwit has:
        </ThemedText>
        <ThemedText type="smallBold" themeColor="inkSoft">
          {children}
        </ThemedText>
      </View>
    </View>
  );
}

// A second question on a screen that honestly has two — the needle calculator reads its model both
// ways round, and the yarn one works out the shopping after the yarn.
export function Aside({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.aside}>
      <ThemedText type="smallBold">{title}</ThemedText>
      {children}
    </View>
  );
}

// Text inside an `Answer`, which sits on sageDeep rather than on the page. Anything written in
// `inkSoft` there is unreadable, so the working gets white at reduced opacity instead.
export function Working({ children }: { children: React.ReactNode }) {
  return (
    <ThemedText type="small" themeColor="white" style={styles.answerLabel}>
      {children}
    </ThemedText>
  );
}

// A caveat inside an answer — the repeat moved the number further than rounding would have, the
// second dye lot will not match. `coralDeep` is the app's warning colour everywhere else and is
// unreadable on sageDeep, so in here it becomes butter, which carries the same "look at this" without
// disappearing into the block.
export function Caution({ children }: { children: React.ReactNode }) {
  return (
    <ThemedText type="smallBold" themeColor="butter">
      {children}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  content: {
    padding: Spacing.four,
    paddingBottom: Spacing.six * 2,
    gap: Spacing.four,
  },
  heading: { gap: Spacing.one },
  group: { gap: Spacing.two },
  halfLabel: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  caps: { letterSpacing: 0.8, textTransform: 'uppercase', fontSize: 11 },
  inputs: {
    gap: Spacing.three,
    backgroundColor: Colors.white,
    borderRadius: Radii.large,
    padding: Spacing.four,
  },
  answer: {
    gap: 2,
    backgroundColor: Colors.sageDeep,
    borderRadius: Radii.large,
    padding: Spacing.four,
  },
  // White at full strength is the answer itself; the working sits under it without competing.
  answerLabel: { opacity: 0.85 },
  working: { gap: 2, marginTop: Spacing.two },
  pending: {
    gap: 2,
    borderRadius: Radii.large,
    borderWidth: 2,
    borderStyle: 'dashed',
    // Sage, not cream: the empty slot has to read as the same slot that fills with sageDeep, and a
    // creamDeep dash on a cream page was close enough to invisible to be no promise at all.
    borderColor: Colors.sage,
    padding: Spacing.four,
  },
  aside: { gap: Spacing.two },
});
