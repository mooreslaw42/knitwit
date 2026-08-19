import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, ProgressBar, StatusBadge } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { currentSectionIndexOf, projectProgress, sectionStatus } from '@/lib/knitwit-helpers';
import { useKnitwitStore } from '@/store/useKnitwitStore';

export default function ProjectDetailScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const router = useRouter();
  const project = useKnitwitStore((state) => state.projects[key]);
  const pattern = useKnitwitStore((state) =>
    project?.patternId ? state.patterns[project.patternId] : null,
  );

  if (!project) return null;

  const pct = projectProgress(project).pct;
  const curIdx = currentSectionIndexOf(project);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View
            style={[
              styles.hero,
              { backgroundColor: project.photo ? undefined : project.colorDeep },
            ]}>
            <ThemedText type="smallBold" themeColor="white">
              {pct >= 1 ? 'Complete' : 'In progress'}
            </ThemedText>
          </View>
          <ThemedText type="title">{project.name}</ThemedText>
          <ThemedText type="default" themeColor="inkSoft">
            {project.started} · {Math.round(pct * 100)}% complete
          </ThemedText>

          <Card style={styles.tagCard}>
            <ThemedText type="small" themeColor="inkSoft">
              Pattern
            </ThemedText>
            {pattern ? (
              <>
                <ThemedText type="smallBold">{pattern.name}</ThemedText>
                <ThemedText type="small" themeColor="inkSoft">
                  {pattern.gaugeStitches}×{pattern.gaugeRows} sts/rows · 10cm
                </ThemedText>
              </>
            ) : (
              <ThemedText type="smallBold">No pattern linked</ThemedText>
            )}
          </Card>

          <ThemedText type="subtitle" style={styles.sectionsTitle}>
            Sections
          </ThemedText>
          <View style={styles.sectionsList}>
            {project.sections.map((s, i) => {
              const status = sectionStatus(s);
              const isCurrent = i === curIdx && status !== 'complete';
              const secPct = s.totalRows ? s.row / s.totalRows : 0;
              return (
                <Pressable
                  key={s.name + i}
                  style={styles.secCard}
                  onPress={() => router.push(`/project/${key}/section/${i}`)}>
                  <View style={styles.secTop}>
                    <ThemedText type="smallBold">
                      {s.name}
                      {isCurrent ? ' · Currently on' : ''}
                    </ThemedText>
                    <StatusBadge status={status} />
                  </View>
                  <ProgressBar pct={secPct} color={project.colorDeep} />
                  <ThemedText type="small" themeColor="inkSoft">
                    Row {s.row} of {s.totalRows}
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
    gap: Spacing.two,
  },
  hero: {
    height: 140,
    borderRadius: Radii.large,
    padding: Spacing.three,
    justifyContent: 'flex-end',
    marginBottom: Spacing.two,
  },
  tagCard: {
    marginTop: Spacing.two,
    gap: 2,
  },
  sectionsTitle: {
    marginTop: Spacing.three,
  },
  sectionsList: {
    gap: Spacing.two,
  },
  secCard: {
    backgroundColor: Colors.white,
    borderRadius: Radii.medium,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  secTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
