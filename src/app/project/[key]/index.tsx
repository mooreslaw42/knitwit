import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, PillButton, ProgressBar, StatusBadge } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CRAFT_LABELS } from '@/constants/catalogs';
import { Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import {
  currentSectionIndexOf,
  formatStarted,
  projectProgress,
  sectionStatus,
} from '@/lib/knitwit-helpers';
import { formatGaugeIn } from '@/lib/gauge';
import { useKnitwitStore } from '@/store/useKnitwitStore';
import type { ProjectStatus } from '@/types/knitwit';

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  active: 'On the needles',
  finished: 'Finished',
  frogged: 'Frogged',
};

export default function ProjectDetailScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const router = useRouter();
  const project = useKnitwitStore((state) => state.projects[key]);
  const pattern = useKnitwitStore((state) =>
    project?.patternId ? state.patterns[project.patternId] : null,
  );
  const unit = useKnitwitStore((state) => state.settings.gaugeUnit);

  if (!project) return null;

  const pct = projectProgress(project).pct;
  const curIdx = currentSectionIndexOf(project);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={[styles.hero, { backgroundColor: project.colorDeep }]}>
            {/* The background was already being cleared for a photo that nothing ever drew, so a
                project with one showed an empty block. */}
            {project.photo ? (
              <Image source={{ uri: project.photo }} style={styles.heroPhoto} />
            ) : null}
            <ThemedText type="smallBold" themeColor="white" style={styles.heroLabel}>
              {pct >= 1 ? 'Complete' : 'In progress'}
            </ThemedText>
          </View>
          <View style={styles.titleRow}>
            <ThemedText type="title">{project.name}</ThemedText>
            <Pressable hitSlop={8} onPress={() => router.push(`/project/${key}/edit`)}>
              <ThemedText type="default">✎</ThemedText>
            </Pressable>
          </View>
          <ThemedText type="default" themeColor="inkSoft">
            {formatStarted(project.startedOn)} · {CRAFT_LABELS[project.craft]} ·{' '}
            {Math.round(pct * 100)}% complete
          </ThemedText>

          <Card style={styles.tagCard}>
            <ThemedText type="small" themeColor="inkSoft">
              Pattern
            </ThemedText>
            {pattern ? (
              <>
                <ThemedText type="smallBold">{pattern.name}</ThemedText>
                {formatGaugeIn(pattern.gauge, unit) ? (
                  <ThemedText type="small" themeColor="inkSoft">
                    {formatGaugeIn(pattern.gauge, unit)}
                  </ThemedText>
                ) : null}
                {/* Without this the counts would simply differ from the printed pattern with no
                    explanation, which reads as a bug rather than a feature. */}
                {project.gauge ? (
                  <ThemedText type="small" themeColor="sageDeep">
                    Worked at your gauge: {formatGaugeIn(project.gauge.mine, unit)}. Stitch counts here are
                    yours, not the pattern&apos;s; row counts are unchanged.
                  </ThemedText>
                ) : null}
              </>
            ) : (
              <ThemedText type="smallBold">No pattern linked</ThemedText>
            )}
          </Card>

          {/* Read-only here. Changing it is an edit, and frogging in particular is the kind of
              thing you shouldn't be one stray tap away from. */}
          <View style={[styles.statusChip, styles.statusChipOn]}>
            <ThemedText type="smallBold" themeColor="white">
              {STATUS_LABELS[project.status]}
            </ThemedText>
          </View>

          <View style={styles.sectionsHeader}>
            <ThemedText type="subtitle">Sections</ThemedText>
            <PillButton
              style={styles.addBtn}
              onPress={() => router.push(`/project/${key}/section/new`)}>
              <ThemedText type="smallBold" themeColor="white">
                + Add section
              </ThemedText>
            </PillButton>
          </View>
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
  heroPhoto: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: Radii.large,
  },
  // Sits above the photo, and keeps its own backing so white text stays readable on a pale one.
  heroLabel: {
    backgroundColor: 'rgba(74, 59, 56, 0.55)',
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    alignSelf: 'flex-start',
    overflow: 'hidden',
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  statusChip: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.creamDeep,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  statusChipOn: { backgroundColor: Colors.blushDeep },
  sectionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  addBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
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
