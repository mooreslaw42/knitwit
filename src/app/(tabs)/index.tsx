import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, PillButton, ProgressBar, Thumb } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { currentStreak, knittedToday } from '@/lib/achievements';
import { nextAward } from '@/lib/awards';
import { currentSectionIndexOf, projectProgress } from '@/lib/knitwit-helpers';
import { useKnitwitStore } from '@/store/useKnitwitStore';

export default function HomeScreen() {
  const router = useRouter();
  const projects = useKnitwitStore((state) => state.projects);
  const activeProjectKey = useKnitwitStore((state) => state.activeProjectKey);
  const activeSectionIndex = useKnitwitStore((state) => state.activeSectionIndex);
  const setActiveSection = useKnitwitStore((state) => state.setActiveSection);
  const achievements = useKnitwitStore((state) => state.achievements);

  const streak = currentStreak(achievements);
  const todayCounted = knittedToday(achievements);
  const next = nextAward(achievements);

  const entries = Object.entries(projects);
  // Home is a "what's on the needles" view — only projects still in progress. The full list,
  // including finished and frogged ones, lives on the Projects tab.
  const incomplete = entries.filter(
    ([, p]) => p.status === 'active' && projectProgress(p).pct < 1,
  );
  const activeCount = incomplete.length;

  // Where "Continue" picks up: the section last counted, or — if that project has since been
  // deleted — the current section of the first project still on the needles.
  const lastProject = projects[activeProjectKey];
  const lastSection = lastProject?.sections[activeSectionIndex];
  const resume = (() => {
    if (lastProject && lastSection) {
      return {
        key: activeProjectKey,
        index: activeSectionIndex,
        project: lastProject,
        section: lastSection,
      };
    }
    const fallback = incomplete[0];
    if (!fallback) return null;
    const [key, project] = fallback;
    const index = currentSectionIndexOf(project);
    const section = project.sections[index];
    return section ? { key, index, project, section } : null;
  })();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <ThemedText type="title">Good evening, Pim 🧶</ThemedText>
          </View>

          <View style={styles.stats}>
            <MiniStat num={activeCount} label="WIP" />
            <MiniStat
              num={streak}
              label={streak === 0 ? 'Start a streak' : todayCounted ? 'Day streak' : 'Knit today'}
            />
            {/* Captioned and shown as a fraction, so it reads as something being worked towards
                rather than as a third count of things you already have. */}
            <Pressable style={styles.grow} onPress={() => router.push('/awards')}>
              <Card style={styles.miniStat}>
                <ThemedText type="small" themeColor="inkSoft">
                  Next award
                </ThemedText>
                <ThemedText type="title" style={styles.miniNum} numberOfLines={1}>
                  {next ? next.fractionLabel : 'All'}
                </ThemedText>
                <ThemedText
                  type="small"
                  themeColor="inkSoft"
                  numberOfLines={2}
                  style={styles.nextName}>
                  {next ? next.award.name : 'Every award earned'}
                </ThemedText>
                {next && <ProgressBar pct={next.fraction} color={Colors.blushDeep} />}
              </Card>
            </Pressable>
          </View>

          {resume && (
            <PillButton
              onPress={() => {
                // Only re-point the counter when resuming somewhere else — re-selecting the
                // current section would also clear a marker the knitter already dismissed.
                if (resume.key !== activeProjectKey || resume.index !== activeSectionIndex) {
                  setActiveSection(resume.key, resume.index);
                }
                router.push('/counter');
              }}>
              <ThemedText type="smallBold" themeColor="white">
                Continue where you left off →
              </ThemedText>
              <ThemedText type="small" themeColor="white" numberOfLines={1}>
                {resume.project.name} · {resume.section.name} · row {resume.section.row} of{' '}
                {resume.section.totalRows}
              </ThemedText>
            </PillButton>
          )}

          <View style={styles.sectionHeader}>
            <ThemedText type="subtitle">Your WIP</ThemedText>
            <PillButton style={styles.newBtn} onPress={() => router.push('/project/new')}>
              <ThemedText type="smallBold" themeColor="white">
                + New project
              </ThemedText>
            </PillButton>
          </View>

          {incomplete.length === 0 && (
            <Card style={styles.emptyCard}>
              <ThemedText type="smallBold">
                {entries.length === 0 ? 'No projects yet' : 'Nothing on the needles'}
              </ThemedText>
              <ThemedText type="small" themeColor="inkSoft">
                {entries.length === 0
                  ? 'Tap “+ New project” to cast on your first one.'
                  : 'Every project is finished — start a new one, or see them all on the Projects tab.'}
              </ThemedText>
            </Card>
          )}

          <View style={styles.projList}>
            {incomplete.map(([key, p]) => {
              const pct = projectProgress(p).pct;
              const cur = p.sections[currentSectionIndexOf(p)];
              return (
                <Pressable
                  key={key}
                  style={styles.projRow}
                  onPress={() => router.push(`/project/${key}`)}>
                  <Thumb photo={p.photo} color={p.color} />
                  <View style={styles.projInfo}>
                    <ThemedText type="smallBold">{p.name}</ThemedText>
                    <ThemedText type="small" themeColor="inkSoft">
                      {cur.name} · row {cur.row} of {cur.totalRows}
                    </ThemedText>
                    <View style={{ marginTop: Spacing.one }}>
                      <ProgressBar pct={pct} color={p.colorDeep} />
                    </View>
                  </View>
                  <ThemedText type="smallBold" themeColor="sageDeep" style={styles.pct}>
                    {Math.round(pct * 100)}%
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

// `text` for stats whose value isn't a bare count — "4,200" toward an award reads better than a
// number formatted the same way as "3 WIP".
function MiniStat({ num, text, label }: { num?: number; text?: string; label: string }) {
  return (
    <Card style={styles.miniStat}>
      <ThemedText type="title" style={styles.miniNum} numberOfLines={1}>
        {text ?? num}
      </ThemedText>
      <ThemedText type="small" themeColor="inkSoft" numberOfLines={2}>
        {label}
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  scrollContent: {
    padding: Spacing.four,
    paddingBottom: Spacing.six * 2,
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.half,
  },
  stats: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  grow: { flex: 1 },
  miniStat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    padding: Spacing.three,
    backgroundColor: Colors.creamDeep,
  },
  nextName: { textAlign: 'center' },
  miniNum: {
    fontSize: 22,
    lineHeight: 26,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  newBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  emptyCard: {
    gap: Spacing.one,
  },
  projList: {
    gap: Spacing.two,
  },
  projRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: Colors.white,
    borderRadius: Radii.medium,
    padding: Spacing.three,
  },
  projInfo: {
    flex: 1,
    gap: 2,
  },
  pct: {
    flexShrink: 0,
  },
});
