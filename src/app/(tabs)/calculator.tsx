import { StyleSheet, View } from 'react-native';

import { CardLink } from '@/components/card-link';
import { KnitIcon } from '@/components/icons/KnitIcon';
import { ThemedText } from '@/components/themed-text';
import { RowSurface } from '@/components/knitwit-ui';
import { Screen, ScreenHeader } from '@/components/screen';
import { Colors, Fonts, Radii, Spacing } from '@/constants/theme';
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
    // Through Screen like every other tab. This one had no safe area at all — a ScrollView straight
    // inside a View — so on a phone its title started underneath the status bar.
    <Screen>
        <ScreenHeader
          title="Calculator"
          subtitle="Pick a question. Nothing here is saved, and no pattern or project is changed."
        />

        {carryOver ? (
          <CardLink
            href={`/calculator/rescale?project=${carryOver.key}`}
            style={styles.context}
            accessibilityLabel={`Use ${carryOver.project.name}'s gauge`}>
            <View style={[styles.icon, styles.iconSage]}>
              <KnitIcon name="counter" size={22} color={Colors.sageDeep} accent={Colors.white} />
            </View>
            <View style={styles.rowInfo}>
              <ThemedText type="default" numberOfLines={1} style={styles.rowTitle}>
                {carryOver.project.name} is on the needles
              </ThemedText>
              <ThemedText type="caption" themeColor="inkSoft" numberOfLines={1}>
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
              <ThemedText type="overline" themeColor="inkSoft" style={styles.groupLabel}>
                {group.label}
              </ThemedText>
              {items.map((calc) => (
                <CardLink key={calc.id} href={`/calculator/${calc.id}`} style={styles.row}>
                  <View style={styles.icon}>
                    <KnitIcon
                      name={calc.icon}
                      size={22}
                      color={Colors.coralDeep}
                      accent={Colors.coral}
                    />
                  </View>
                  <View style={styles.rowInfo}>
                    <ThemedText type="default" style={styles.rowTitle}>
                      {calc.title}
                    </ThemedText>
                    <ThemedText type="caption" themeColor="inkSoft">
                      {calc.question}
                    </ThemedText>
                  </View>
                  <KnitIcon name="forward" size={16} color={Colors.inkSoft} />
                </CardLink>
              ))}
            </View>
          );
        })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.two },
  groupLabel: { marginTop: Spacing.two, marginLeft: Spacing.one },
  row: {
    ...RowSurface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  // The icon in a disc of its own, the same size as a list thumbnail, so a calculator row and a
  // project row line up. Bare, at 22 points, the icons were a speck beside two lines of text.
  icon: {
    width: 44,
    height: 44,
    borderRadius: Radii.pill,
    backgroundColor: Colors.creamDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSage: { backgroundColor: Colors.sage },
  context: {
    ...RowSurface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderLeftWidth: 4,
    borderLeftColor: Colors.sageDeep,
  },
  rowInfo: { gap: 2, flex: 1 },
  rowTitle: { fontFamily: Fonts.bodyExtrabold },
});
