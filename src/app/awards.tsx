import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, ProgressBar } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { currentStreak, knittedToday, longestStreak } from '@/lib/achievements';
import { allProgress, GROUP_LABELS, standing, type AwardGroup } from '@/lib/awards';
import { goBackOr } from '@/lib/navigation';
import { useKnitwitStore } from '@/store/useKnitwitStore';

const GROUP_ORDER: AwardGroup[] = [
  'streak',
  'finishing',
  'volume',
  'time',
  'range',
  'devotion',
  'making',
  'frogging',
];

function hours(seconds: number): string {
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
  return `${Math.round((seconds / 3600) * 10) / 10} hours`;
}

export default function AwardsScreen() {
  const router = useRouter();
  const achievements = useKnitwitStore((state) => state.achievements);

  const progress = allProgress(achievements);
  const level = standing(achievements);
  const earned = progress.filter((p) => p.earned).length;
  const streak = currentStreak(achievements);
  const { totals } = achievements;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="title">Awards</ThemedText>

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

          <ThemedText
            type="smallBold"
            themeColor="blushDeep"
            style={styles.back}
            onPress={() => goBackOr(router, '/')}>
            ← Back
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
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
  back: { marginTop: Spacing.two },
});
