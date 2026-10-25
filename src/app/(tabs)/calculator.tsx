import { ScrollView, StyleSheet, View } from 'react-native';

import { CardLink } from '@/components/card-link';
import { KnitIcon } from '@/components/icons/KnitIcon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { CALCULATOR_GROUPS, calculatorsInGroup } from '@/lib/calculators';
import { formatGaugeIn } from '@/lib/gauge';
import { usePageTitle } from '@/lib/use-page-title';
import { useKnitwitStore } from '@/store/useKnitwitStore';

// What do you want to work out?
//
// This screen used to be the calculators themselves — six of them stacked, 21 input fields and some
// 3,700px of scroll, where you could not see a card's inputs and its answer together past the
// first. It is an index now, and each calculator has a screen of its own.
//
// The rows lead with the question rather than the title, because the question is what somebody is
// actually choosing between: "which needle or hook?" means nothing next to "your swatch didn't
// match — what should you try next?".
export default function CalculatorScreen() {
  usePageTitle('Calculator');
  const unit = useKnitwitStore((state) => state.settings.gaugeUnit);
  // The project the knitter is counting on, which is the one context worth offering unprompted.
  const activeKey = useKnitwitStore((state) => state.activeProjectKey);
  const activeProject = useKnitwitStore((state) =>
    activeKey ? state.projects[activeKey] : undefined,
  );
  // Only worth offering when there is something to carry over. A project worked at the pattern's
  // own gauge has none, and a row saying so would be a door into an empty room.
  const carryOver = activeKey && activeProject?.gauge ? { key: activeKey, project: activeProject } : null;

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title" heading={1}>
          Calculator
        </ThemedText>
        <ThemedText type="small" themeColor="inkSoft">
          Pick the question and Knitwit works it out on a screen of its own. What you fill in sits on
          the white; what it works out sits in the tinted box. Nothing is saved — it changes no
          pattern and no project.
        </ThemedText>

        {carryOver ? (
          <CardLink
            href={`/calculator/rescale?project=${carryOver.key}`}
            style={styles.context}
            accessibilityLabel={`Use ${carryOver.project.name}'s gauge`}>
            <KnitIcon name="counter" size={22} color={Colors.sageDeep} accent={Colors.sage} />
            <View style={styles.rowInfo}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {carryOver.project.name} is on the needles
              </ThemedText>
              <ThemedText type="small" themeColor="inkSoft" numberOfLines={1}>
                Start with its gauge — {formatGaugeIn(carryOver.project.gauge?.mine, unit)}
              </ThemedText>
            </View>
          </CardLink>
        ) : null}

        {CALCULATOR_GROUPS.map((group) => {
          const items = calculatorsInGroup(group.id);
          // Phases 2 and 3 fill the other two groups. Until then they stay out of sight rather than
          // sitting there empty, promising calculators that don't exist.
          if (items.length === 0) return null;
          return (
            <View key={group.id} style={styles.group}>
              <ThemedText type="smallBold" themeColor="inkSoft">
                {group.label}
              </ThemedText>
              {items.map((calc) => (
                <CardLink key={calc.id} href={`/calculator/${calc.id}`} style={styles.row}>
                  <KnitIcon
                    name={calc.icon}
                    size={22}
                    color={Colors.coralDeep}
                    accent={Colors.coral}
                  />
                  <View style={styles.rowInfo}>
                    <ThemedText type="smallBold">{calc.title}</ThemedText>
                    <ThemedText type="small" themeColor="inkSoft">
                      {calc.question}
                    </ThemedText>
                  </View>
                </CardLink>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  content: {
    padding: Spacing.four,
    paddingBottom: Spacing.six + BottomTabInset,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  group: { gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    backgroundColor: Colors.white,
    borderRadius: Radii.medium,
    padding: Spacing.three,
  },
  context: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: Colors.cream,
    borderRadius: Radii.medium,
    borderLeftWidth: 4,
    borderLeftColor: Colors.sageDeep,
    padding: Spacing.three,
  },
  rowInfo: { gap: 2, flexShrink: 1 },
});
