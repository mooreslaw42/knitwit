import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { CardLink } from '@/components/card-link';
import { KnitIcon } from '@/components/icons/KnitIcon';
import { EmptyState } from '@/components/illustrations/EmptyState';
import { Avatar, PillButton, ProgressBar, RowSurface, Thumb } from '@/components/knitwit-ui';
import { PressableScale } from '@/components/motion/PressableScale';
import { ProgressRing } from '@/components/motion/ProgressRing';
import { Screen, ScreenHeader, SectionHeader } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Radii, Shadows, Spacing } from '@/constants/theme';
import { currentStreak, knittedToday } from '@/lib/achievements';
import { nextAward } from '@/lib/awards';
import {
  currentSectionIndexOf,
  currentSectionOf,
  greeting,
  projectProgress,
  projectState,
} from '@/lib/knitwit-helpers';
import { useAccountInNav } from '@/lib/use-nav-layout';
import { usePageTitle } from '@/lib/use-page-title';
import { useKnitwitStore } from '@/store/useKnitwitStore';
import type { Project } from '@/types/knitwit';

// Home answers one question: what do I pick up?
//
// Everything on it is in the order a knitter sitting down would want it. The piece they were last
// working on, with the one button that takes them back to it, comes first and is the only thing on
// the screen that looks like a button. Then how the habit is going. Then everything else that is
// on the needles. It used to open on three statistics, with the way back into the knitting as a
// band of pink underneath them and a second pink button beside it for starting something new —
// two calls to action of equal weight, neither of them first.
export default function HomeScreen() {
  usePageTitle('Home');
  const router = useRouter();
  const projects = useKnitwitStore((state) => state.projects);
  const activeProjectKey = useKnitwitStore((state) => state.activeProjectKey);
  const activeSectionIndex = useKnitwitStore((state) => state.activeSectionIndex);
  const setActiveSection = useKnitwitStore((state) => state.setActiveSection);
  const recentSections = useKnitwitStore((state) => state.recentSections);
  const achievements = useKnitwitStore((state) => state.achievements);
  const displayName = useKnitwitStore((state) => state.settings.displayName);
  const accountInNav = useAccountInNav();

  const streak = currentStreak(achievements);
  const todayCounted = knittedToday(achievements);
  const next = nextAward(achievements);

  const entries = Object.entries(projects);
  // Home is a "what's on the needles" view — only projects still in progress. The full list,
  // including finished and frogged ones, lives on the Projects tab.
  const incomplete = entries.filter(([, p]) => projectState(p) === 'active');

  // Where "Continue" picks up. It has to land somewhere you can actually knit, so a project that
  // has since been frogged or finished is skipped rather than offered — walking back through the
  // sections most recently worked on until one is still on the needles, and falling back to the
  // first WIP project if none of them are.
  const resume = (() => {
    const onNeedles = (project: Project | undefined) => !!project && projectState(project) === 'active';

    const trail = [`${activeProjectKey}|${activeSectionIndex}`, ...(recentSections ?? [])];
    for (const entry of trail) {
      const [key, rawIndex] = entry.split('|');
      const project = projects[key];
      if (!onNeedles(project)) continue;
      // The remembered section may itself be finished even though the project isn't — carry on
      // to whatever that project is actually up to.
      const remembered = Number(rawIndex);
      const candidate = project.sections[remembered];
      const index =
        candidate && candidate.row < candidate.totalRows ? remembered : currentSectionIndexOf(project);
      const section = project.sections[index];
      if (section) return { key, index, project, section };
    }

    const fallback = incomplete[0];
    if (!fallback) return null;
    const [key, project] = fallback;
    const index = currentSectionIndexOf(project);
    const section = project.sections[index];
    return section ? { key, index, project, section } : null;
  })();

  // The list under the hero leaves out the project the hero is already showing. Listing it twice
  // made the screen look like it held one more project than it did.
  const others = incomplete.filter(([key]) => key !== resume?.key);

  const continueKnitting = () => {
    if (!resume) return;
    // Only re-point the counter when resuming somewhere else — re-selecting the current section
    // would also clear a marker the knitter already dismissed.
    if (resume.key !== activeProjectKey || resume.index !== activeSectionIndex) {
      setActiveSection(resume.key, resume.index);
    }
    router.push('/counter');
  };

  return (
    <Screen>
      <ScreenHeader
        title={greeting(displayName)}
        subtitle={
          incomplete.length === 0
            ? 'Nothing on the needles yet.'
            : `${incomplete.length} on the needles`
        }
        trailing={
          accountInNav ? undefined : (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Account and settings"
              hitSlop={6}
              haptic="none"
              onPress={() => router.push('/account')}>
              <Avatar name={displayName} />
            </PressableScale>
          )
        }
      />

      {resume ? (
        <View style={styles.hero}>
          <ThemedText type="overline" themeColor="inkSoft">
            Pick up where you left off
          </ThemedText>
          <CardLink
            href={`/project/${resume.key}`}
            style={styles.heroTop}
            accessibilityLabel={`${resume.project.name}, ${resume.section.name}, row ${resume.section.row} of ${resume.section.totalRows}. Opens the project.`}>
            <Thumb photo={resume.project.photo} color={resume.project.color} size={60} />
            <View style={styles.heroInfo}>
              <ThemedText type="subtitle" numberOfLines={2}>
                {resume.project.name}
              </ThemedText>
              <ThemedText type="caption" themeColor="inkSoft" numberOfLines={1}>
                {resume.section.name}
              </ThemedText>
              <ThemedText type="caption" themeColor="inkSoft" numberOfLines={1}>
                Row {resume.section.row} of {resume.section.totalRows}
              </ThemedText>
            </View>
            <ProgressRing
              progress={projectProgress(resume.project).pct}
              size={56}
              strokeWidth={6}
              color={resume.project.colorDeep}>
              <ThemedText type="smallBold">
                {Math.round(projectProgress(resume.project).pct * 100)}%
              </ThemedText>
            </ProgressRing>
          </CardLink>
          <PillButton onPress={continueKnitting} style={styles.heroButton}>
            <View style={styles.heroButtonInner}>
              <KnitIcon name="play" size={18} color={Colors.white} accent={Colors.white} />
              <ThemedText type="default" themeColor="white" style={styles.heroButtonText}>
                Continue knitting
              </ThemedText>
            </View>
          </PillButton>
        </View>
      ) : (
        <View style={styles.emptyHero}>
          <EmptyState
            illustration="no-projects"
            title={entries.length === 0 ? 'Cast on your first project' : 'Nothing on the needles'}
            message={
              entries.length === 0
                ? 'Give it a name, pick a pattern or go without one, and Knitwit keeps count from the first row.'
                : 'Everything you started is finished. Time for the next one.'
            }
            action={
              <PillButton onPress={() => router.push('/project/new')} style={styles.emptyButton}>
                <ThemedText type="default" themeColor="white" style={styles.heroButtonText}>
                  Start a project
                </ThemedText>
              </PillButton>
            }
          />
        </View>
      )}

      <View style={styles.stats}>
        <StatTile
          value={String(streak)}
          label={streak === 0 ? 'Start a streak today' : todayCounted ? 'Day streak' : 'Knit today to keep it'}
          accent={todayCounted ? Colors.sageDeep : Colors.ink}
          onPress={() => router.push('/awards')}
          accessibilityLabel={`${streak} day streak. Opens your awards.`}
        />
        {/* Captioned and shown as a fraction, so it reads as something being worked towards
            rather than as a second count of things you already have. */}
        <StatTile
          wide
          value={next ? next.fractionLabel : 'All'}
          label={next ? `Next: ${next.award.name}` : 'Every award earned'}
          progress={next ? next.fraction : undefined}
          onPress={() => router.push('/awards')}
          accessibilityLabel={
            next ? `Next award: ${next.award.name}, ${next.fractionLabel}. Opens your awards.` : 'Every award earned. Opens your awards.'
          }
        />
      </View>

      {incomplete.length > 0 && (
        <>
          <SectionHeader
            title={others.length > 0 ? 'Also on the needles' : 'On the needles'}
            actionLabel="New project"
            actionIcon="plus"
            onAction={() => router.push('/project/new')}
          />
          {others.length === 0 ? (
            <ThemedText type="caption" themeColor="inkSoft">
              Just the one. Start another whenever you like — Knitwit keeps each one&apos;s place.
            </ThemedText>
          ) : (
            <View style={styles.list}>
              {others.map(([key, p]) => {
                const pct = projectProgress(p).pct;
                const cur = currentSectionOf(p);
                return (
                  <CardLink
                    key={key}
                    style={styles.row}
                    href={`/project/${key}`}
                    accessibilityLabel={`${p.name}, ${Math.round(pct * 100)}% complete`}>
                    <Thumb photo={p.photo} color={p.color} size={48} />
                    <View style={styles.rowInfo}>
                      <ThemedText type="default" numberOfLines={1} style={styles.rowTitle}>
                        {p.name}
                      </ThemedText>
                      {/* A project with no sections has nothing to count — render it rather than
                          crash the home list on a current section that isn't there. */}
                      {cur ? (
                        <ThemedText type="caption" themeColor="inkSoft" numberOfLines={1}>
                          {cur.name} · row {cur.row} of {cur.totalRows}
                        </ThemedText>
                      ) : null}
                      <View style={styles.rowBar}>
                        <ProgressBar pct={pct} color={p.colorDeep} />
                      </View>
                    </View>
                    <ThemedText type="smallBold" themeColor="inkSoft" style={styles.pct}>
                      {Math.round(pct * 100)}%
                    </ThemedText>
                  </CardLink>
                );
              })}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

// One of the quiet tiles under the hero. Quiet on purpose — cream on cream, no lift — because
// they are things to glance at, and the card above them is the thing to press.
function StatTile({
  value,
  label,
  progress,
  wide,
  accent = Colors.ink,
  onPress,
  accessibilityLabel,
}: {
  value: string;
  label: string;
  progress?: number;
  wide?: boolean;
  accent?: string;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, wide && styles.tileWide, pressed && styles.pressed]}>
      <ThemedText type="title" numberOfLines={1} style={{ color: accent }}>
        {value}
      </ThemedText>
      <ThemedText type="small" themeColor="inkSoft" numberOfLines={2}>
        {label}
      </ThemedText>
      {progress != null ? (
        <View style={styles.tileBar}>
          <ProgressBar pct={progress} color={Colors.blushDeep} trackColor={Colors.white} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: Colors.white,
    borderRadius: Radii.large,
    padding: Spacing.four,
    gap: Spacing.three,
    ...Shadows.raised,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  heroInfo: {
    flex: 1,
    gap: 2,
  },
  heroButton: {
    paddingVertical: Spacing.three + Spacing.half,
  },
  heroButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  heroButtonText: {
    fontFamily: Fonts.bodyExtrabold,
  },
  emptyHero: {
    backgroundColor: Colors.white,
    borderRadius: Radii.large,
    ...Shadows.card,
  },
  emptyButton: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.five,
  },
  stats: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  tile: {
    flex: 1,
    backgroundColor: Colors.creamDeep,
    borderRadius: Radii.medium,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  tileWide: { flex: 1.6 },
  tileBar: { marginTop: Spacing.one },
  pressed: { opacity: 0.7 },
  list: {
    gap: Spacing.two,
  },
  row: {
    ...RowSurface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontFamily: Fonts.bodyExtrabold,
  },
  rowBar: { marginTop: Spacing.one },
  pct: {
    flexShrink: 0,
  },
});
