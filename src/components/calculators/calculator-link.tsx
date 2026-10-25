import type { Href } from 'expo-router';

import { CardLink } from '@/components/card-link';
import { KnitIcon } from '@/components/icons/KnitIcon';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radii, Spacing } from '@/constants/theme';
import { StyleSheet, View } from 'react-native';
import { calculatorById, type CalculatorId } from '@/lib/calculators';

// A door into a calculator from wherever the numbers already are.
//
// The prefill is only worth having if a knitter arrives with context, and arriving at the
// Calculator tab means they have none — so the calculators need links next to the data: on a
// pattern, on a section, on a yarn in the stash. This is that link, in one shape, so the three of
// them say the same kind of thing and carry context the same way.
//
// `context` becomes the query string the prefill reads. Nothing is passed by navigation state: a
// URL that carries its own context is one a knitter can bookmark, and one that still works after a
// hard refresh on the web.
export type CalculatorContext = {
  project?: string;
  pattern?: string;
  material?: string;
};

export function calculatorHref(id: CalculatorId, context: CalculatorContext = {}): Href {
  const query = Object.entries(context)
    .filter(([, value]) => !!value)
    .map(([key, value]) => `${key}=${encodeURIComponent(value as string)}`)
    .join('&');
  return (query ? `/calculator/${id}?${query}` : `/calculator/${id}`) as Href;
}

export function CalculatorLink({
  id,
  context,
  // Overridable, because the reason for coming differs with where you came from: the same rescale
  // screen is "work out your cast-on" from a pattern and "check this section" from a section.
  label,
}: {
  id: CalculatorId;
  context?: CalculatorContext;
  label?: string;
}) {
  const calc = calculatorById(id);
  if (!calc) return null;

  return (
    <CardLink
      href={calculatorHref(id, context)}
      style={styles.row}
      accessibilityLabel={label ?? calc.title}>
      <KnitIcon name={calc.icon} size={20} color={Colors.sageDeep} accent={Colors.sage} />
      <View style={styles.info}>
        <ThemedText type="smallBold" themeColor="sageDeep">
          {label ?? calc.title} →
        </ThemedText>
        <ThemedText type="small" themeColor="inkSoft">
          Opens the calculator with these numbers already filled in.
        </ThemedText>
      </View>
    </CardLink>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: Colors.cream,
    borderRadius: Radii.medium,
    padding: Spacing.three,
  },
  info: { gap: 2, flexShrink: 1 },
});
