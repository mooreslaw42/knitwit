import { StyleSheet, View } from 'react-native';

import { Card, ProgressBar } from '@/components/knitwit-ui';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { usePageTitle } from '@/lib/use-page-title';
import { Colors, Radii, Spacing } from '@/constants/theme';
import { currentStreak, knittedToday, longestStreak } from '@/lib/achievements';
import { allProgress, GROUP_LABELS, GROUP_ORDER, standing } from '@/lib/awards';
import { useKnitwitStore } from '@/store/useKnitwitStore';

function hours(seconds: number): string {
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
  return `${Math.round((seconds / 3600) * 10) / 10} hours`;
}

export default function AwardsScreen() {
  usePageTitle('Awards');
  const achievements = useKnitwitStore((state) => state.achievements);

  const progress = allProgress(achievements);
  const level = standing(achievements);
  const earned = progress.filter((p) => p.earned).length;
  const streak = currentStreak(achievements);
  const { totals } = achievements;

  return (
    <Screen kind="pushed">
          <ThemedText type="title" heading={1}>Awards</ThemedText>

          <Card style={styles.levelCard}>
            <ThemedText type="title">Level {level.level}</ThemedText>
            <ThemedText type="small" themeColor="inkSoft">
              {earned} of {progress.length} awards · {level.points} points
            </ThemedText>
            <ProgressBar pct={level.needed > 0 ? level.into / level.needed : 1} color={Colors.blushDeep} />
            <ThemedText type="small" themeColor="inkSoft">
              {level.toNext} more {level.toNext === 1 ? 'point' : 'points'} to level {level.level + 1}
            </ThemedText>
          </Card>

          <Card style={styles.levelCard}>
            <ThemedText type="smallBold">So far</ThemedText>
            <ThemedText type="small" themeColor="inkSoft">
              {streak === 0
                ? 'No streak going. Count a row today to start one.'
                : `${streak}-day streak${knittedToday(achievements) ? '' : ' — knit today to keep it'}. Longest: ${longestStreak(achievements)} ${longestStreak(achievements) === 1 ? 'day' : 'days'}.`}
            </ThemedText>
            <ThemedText type="small" themeColor="inkSoft">
              {totals.rows.toLocaleString('en-GB')} rows · {hours(totals.seconds)} ·{' '}
              {totals.projectsFinished} finished
            </ThemedText>
            {/* Said plainly rather than implied: an uncharted section with no cast-on contributes
                its rows but not its stitches, so this is a floor and not a measurement. */}
            <ThemedText type="small" themeColor="inkSoft">
              At least {totals.stitches.toLocaleString('en-GB')} stitches — exact where a section is
              charted, estimated from the cast-on where it isn&apos;t.
            </ThemedText>
          </Card>

          {GROUP_ORDER.map((group) => {
            const items = progress.filter((p) => p.award.group === group);
            if (items.length === 0) return null;
            return (
              <View key={group} style={styles.group}>
                <ThemedText type="smallBold" themeColor="inkSoft">
                  {GROUP_LABELS[group]}
                </ThemedText>
                {items.map((p) => (
                  <Card key={p.award.id} style={[styles.award, p.earned && styles.awardEarned]}>
                    <View style={styles.awardHead}>
                      <ThemedText type="smallBold" themeColor={p.earned ? 'ink' : 'inkSoft'}>
                        {p.earned ? '★ ' : ''}
                        {p.award.name}
                      </ThemedText>
                      <ThemedText type="small" themeColor="inkSoft">
                        {p.award.points} pts
                      </ThemedText>
                    </View>
                    <ThemedText type="small" themeColor="inkSoft">
                      {p.award.description}
                    </ThemedText>
                    {!p.earned && (
                      <>
                        <ProgressBar pct={p.fraction} color={Colors.sageDeep} />
                        <ThemedText type="small" themeColor="inkSoft">
                          {p.label}
                        </ThemedText>
                      </>
                    )}
                  </Card>
                ))}
              </View>
            );
          })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  levelCard: { gap: Spacing.two },
  group: { gap: Spacing.two },
  award: { gap: Spacing.one },
  awardEarned: { backgroundColor: Colors.butter, borderRadius: Radii.large },
  awardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
