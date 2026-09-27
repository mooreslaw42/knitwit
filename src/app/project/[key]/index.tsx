import { useLocalSearchParams, useRouter } from 'expo-router';
import { PhotoImage } from '@/components/photo';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, InputStyle, PillButton, ProgressBar, StatusBadge } from '@/components/knitwit-ui';
import { NotesCard } from '@/components/notes-card';
import { CardLink } from '@/components/card-link';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CRAFT_LABELS, PROJECT_STATUS_LABELS } from '@/constants/catalogs';
import { Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import {
  currentSectionIndexOf,
  formatStarted,
  projectMaterialIds,
  projectProgress,
  projectState,
  sectionStatus,
} from '@/lib/knitwit-helpers';
import { materialLabel } from '@/components/stash-picker';
import { formatGaugeIn } from '@/lib/gauge';
import { usePageTitle } from '@/lib/use-page-title';
import { useKnitwitStore } from '@/store/useKnitwitStore';

export default function ProjectDetailScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const router = useRouter();
  const project = useKnitwitStore((state) => state.projects[key]);
  const pattern = useKnitwitStore((state) =>
    project?.patternId ? state.patterns[project.patternId] : null,
  );
  const unit = useKnitwitStore((state) => state.settings.gaugeUnit);
  const materials = useKnitwitStore((state) => state.materials);
  usePageTitle(project?.name);
  const setProjectNotes = useKnitwitStore((state) => state.setProjectNotes);
  const setMaterialSkeins = useKnitwitStore((state) => state.setMaterialSkeins);

  if (!project) return null;

  const pct = projectProgress(project).pct;
  const curIdx = currentSectionIndexOf(project);
  // Only the yarns that are actually in the stash: a section can still point at one the knitter
  // deleted, and a row with no name to put on it is no use to anybody.
  const yarns = projectMaterialIds(project).filter((id) => materials[id]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={[styles.hero, { backgroundColor: project.colorDeep }]}>
            {/* The background was already being cleared for a photo that nothing ever drew, so a
                project with one showed an empty block. */}
            {project.photo ? (
              <PhotoImage photo={project.photo} style={styles.heroPhoto} />
            ) : null}
            <ThemedText type="smallBold" themeColor="white" style={styles.heroLabel}>
              {pct >= 1 ? 'Complete' : 'In progress'}
            </ThemedText>
          </View>
          <View style={styles.titleRow}>
            <ThemedText type="title" heading={1}>{project.name}</ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Edit ${project.name}`}
              hitSlop={8}
              onPress={() => router.push(`/project/${key}/edit`)}>
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
            {/* A project improvised without a pattern still has one in it — the sections, the row
                counts, the chart. This is how it gets written down so it can be knitted again.
                Offered on a project that already has a pattern too: a heavily-altered make is a
                different pattern from the one it started as. */}
            <Pressable
              hitSlop={6}
              style={styles.convertLink}
              onPress={() => router.push(`/project/${key}/to-pattern`)}>
              <ThemedText type="smallBold" themeColor="sageDeep">
                {pattern ? 'Save my version as a new pattern →' : 'Save this as a pattern →'}
              </ThemedText>
            </Pressable>
          </Card>

          {/* Read-only here. Changing it is an edit, and frogging in particular is the kind of
              thing you shouldn't be one stray tap away from.
              projectState, not the stored flag: a project with every row counted reads as
              finished whether or not anyone declared it so, and this has to agree with the list
              and the filter, which both already worked that way. */}
          <View style={[styles.statusChip, styles.statusChipOn]}>
            <ThemedText type="smallBold" themeColor="white">
              {PROJECT_STATUS_LABELS[projectState(project)]}
            </ThemedText>
          </View>

          {/* How much yarn this make needs, in balls rather than in metres, because that is the
              unit a yarn shop sells in and the number a knitter checks before casting on.
              Stamped from the pattern's per-size counts when the project was created and editable
              ever since: a pattern says what the design takes, a project records what this knitter
              is actually using. Hidden until the project has yarn — an empty table is not an
              invitation, and yarn is chosen on the section screens. */}
          {yarns.length > 0 ? (
            <Card style={styles.yarnCard}>
              <ThemedText type="small" themeColor="inkSoft">
                Yarn you&apos;ll need
              </ThemedText>
              {yarns.map((id) => {
                const needed = project.materialSkeins?.[id];
                return (
                  <View key={id} style={styles.yarnRow}>
                    <ThemedText type="smallBold" numberOfLines={2} style={styles.yarnName}>
                      {materialLabel(materials[id])}
                    </ThemedText>
                    <TextInput
                      style={styles.skeinInput}
                      value={needed == null ? '' : String(needed)}
                      onChangeText={(v) => {
                        // Digits only, and an empty box clears the number rather than storing a
                        // zero — "not worked out yet" is not the same answer as "none".
                        const digits = v.replace(/[^0-9]/g, '');
                        setMaterialSkeins(key, id, digits ? Number(digits) : null);
                      }}
                      keyboardType="numeric"
                      placeholder="—"
                      placeholderTextColor={Colors.inkSoft}
                      accessibilityLabel={`Skeins of ${materialLabel(materials[id])}`}
                    />
                    <ThemedText type="small" themeColor="inkSoft" style={styles.skeinUnit}>
                      {needed === 1 ? 'skein' : 'skeins'}
                    </ThemedText>
                  </View>
                );
              })}
            </Card>
          ) : null}

          <NotesCard
            value={project.notes}
            onChange={(notes) => setProjectNotes(key, notes)}
            hint="About the whole project. Saved as you type."
          />

          <View style={styles.sectionsHeader}>
            <ThemedText type="subtitle" heading={2}>Sections</ThemedText>
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
                <CardLink
                  key={s.name + i}
                  style={styles.secCard}
                  href={`/project/${key}/section/${i}`}>
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
                </CardLink>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  yarnCard: {
    gap: Spacing.two,
  },
  yarnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  // The name takes whatever is left once the number has what it needs, so a long yarn name wraps
  // rather than squeezing the box it is a count of.
  yarnName: {
    flex: 1,
  },
  skeinInput: {
    ...InputStyle,
    backgroundColor: Colors.cream,
    paddingVertical: Spacing.two,
    width: 64,
    textAlign: 'center',
  },
  skeinUnit: {
    width: 44,
  },
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
  convertLink: {
    alignSelf: 'flex-start',
    paddingTop: Spacing.two,
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
