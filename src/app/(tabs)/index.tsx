import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, PillButton, ProgressBar } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { currentSectionIndexOf, projectProgress } from '@/lib/knitwit-helpers';
import { useKnitwitStore } from '@/store/useKnitwitStore';

export default function HomeScreen() {
  const router = useRouter();
  const projects = useKnitwitStore((state) => state.projects);
  const patterns = useKnitwitStore((state) => state.patterns);
  const activeProjectKey = useKnitwitStore((state) => state.activeProjectKey);
  const activeSectionIndex = useKnitwitStore((state) => state.activeSectionIndex);
  const setActiveSection = useKnitwitStore((state) => state.setActiveSection);

  const entries = Object.entries(projects);
  // Home is a "what's on the needles" view — only projects still in progress. The full list,
  // including finished ones, lives on the Projects tab.
  const incomplete = entries.filter(([, p]) => projectProgress(p).pct < 1);
  const activeCount = incomplete.length;
  const doneCount = entries.length - incomplete.length;

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
            <MiniStat num={activeCount} label="Active" />
            <MiniStat num={Object.keys(patterns).length} label="Saved patterns" />
            <MiniStat num={doneCount} label="Done" />
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
                  <View
                    style={[
                      styles.projThumb,
                      { backgroundColor: p.photo ? undefined : p.color },
                    ]}
                  />
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

function MiniStat({ num, label }: { num: number; label: string }) {
  return (
    <Card style={styles.miniStat}>
      <ThemedText type="title" style={styles.miniNum}>
        {num}
      </ThemedText>
      <ThemedText type="small" themeColor="inkSoft">
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
  miniStat: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.three,
    backgroundColor: Colors.creamDeep,
  },
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
  projThumb: {
    width: 44,
    height: 44,
    borderRadius: Radii.small,
  },
  projInfo: {
    flex: 1,
    gap: 2,
  },
  pct: {
    flexShrink: 0,
  },
});
