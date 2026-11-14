import { useRouter } from 'expo-router';
import { PhotoImage } from '@/components/photo';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/illustrations/EmptyState';
import {
  Chip,
  ChipRow,
  IconButton,
  PillButton,
  ProgressBar,
  ProjectStatusBadge,
  SearchField,
} from '@/components/knitwit-ui';
import { CardLink } from '@/components/card-link';
import { Screen, ScreenHeader } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { usePageTitle } from '@/lib/use-page-title';
import { CRAFT_LABELS, CRAFT_ORDER, PROJECT_STATUS_LABELS } from '@/constants/catalogs';
import { hasLabel, labelKey, labelsInUse } from '@/lib/labels';
import { Colors, Radii, Shadows, Spacing } from '@/constants/theme';
import {
  currentSectionOf,
  matchesCraft,
  projectProgress,
  projectState,
} from '@/lib/knitwit-helpers';
import { useKnitwitStore } from '@/store/useKnitwitStore';
import type { TechniqueCraft } from '@/types/knitwit';

type StatusFilter = 'all' | 'active' | 'finished' | 'frogged';
type CraftFilter = 'all' | TechniqueCraft;

// The same three words the badge on each card uses. The filter used to say "In progress" and
// "Completed" over cards that said "On the needles" and "Finished" — one state, two names, on the
// same screen.
const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: PROJECT_STATUS_LABELS.active },
  { value: 'finished', label: PROJECT_STATUS_LABELS.finished },
  { value: 'frogged', label: PROJECT_STATUS_LABELS.frogged },
];

const CRAFT_FILTERS: { value: CraftFilter; label: string }[] = [
  { value: 'all', label: 'All crafts' },
  ...CRAFT_ORDER.map((c) => ({ value: c as CraftFilter, label: CRAFT_LABELS[c] })),
];

export default function ProjectsScreen() {
  usePageTitle('Projects');
  const router = useRouter();
  const projects = useKnitwitStore((state) => state.projects);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [craftFilter, setCraftFilter] = useState<CraftFilter>('all');
  // Null is "any label", which is not the same as a project having none — a knitter looking at
  // everything shouldn't have to know their own groupings exist.
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  // Derive the visible list in a memo off the raw store slice rather than inside the selector,
  // so Zustand's snapshot stays stable and we don't loop.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.entries(projects).filter(([, p]) => {
      // Filtering on the project's actual state, not just its row count — a frogged project was
      // showing up under "In progress" or "Completed" depending on how far it had got.
      if (filter !== 'all' && projectState(p) !== filter) return false;
      if (!matchesCraft(p.craft, craftFilter)) return false;
      if (labelFilter && !hasLabel(p.labels, labelFilter)) return false;
      // Search covers labels as well as the name, so typing "christmas" finds the group whether
      // or not you've noticed the filter row.
      if (q && !p.name.toLowerCase().includes(q) && !p.labels.some((l) => labelKey(l).includes(q))) {
        return false;
      }
      return true;
    });
  }, [projects, filter, craftFilter, labelFilter, query]);

  // Only the labels actually in use, so the row is empty until a knitter has invented a group and
  // never offers one they've since removed from everything.
  const labels = useMemo(() => labelsInUse(Object.values(projects)), [projects]);

  const total = Object.keys(projects).length;

  // The craft row only earns its place once there is more than one craft to choose between; a
  // knitter who has never crocheted does not need a row of filters that all return everything.
  const crafts = new Set(Object.values(projects).map((p) => p.craft));
  const showCrafts = crafts.size > 1;

  return (
    <Screen>
      <ScreenHeader
        title="Projects"
        trailing={
          <IconButton
            icon="plus"
            label="New project"
            variant="primary"
            onPress={() => router.push('/project/new')}
          />
        }
      />

      {total > 0 && (
        <>
          <SearchField value={query} onChangeText={setQuery} placeholder="Search projects" />

          <ChipRow>
            {FILTERS.map((f) => (
              <Chip
                key={f.value}
                label={f.label}
                selected={filter === f.value}
                onPress={() => setFilter(f.value)}
              />
            ))}
          </ChipRow>

          {/* A second row rather than one long one: these are two independent questions, and
              "All" meaning two different things in the same row would read as a single choice. */}
          {showCrafts && (
            <ChipRow>
              {CRAFT_FILTERS.map((f) => (
                <Chip
                  key={f.value}
                  label={f.label}
                  selected={craftFilter === f.value}
                  onPress={() => setCraftFilter(f.value)}
                />
              ))}
            </ChipRow>
          )}

          {/* A third filter row, and only when there is something to filter by. */}
          {labels.length > 0 && (
            <ChipRow>
              <Chip label="Any label" selected={labelFilter === null} onPress={() => setLabelFilter(null)} />
              {labels.map((l) => {
                const on = labelFilter !== null && labelKey(l) === labelKey(labelFilter);
                return <Chip key={l} label={l} selected={on} onPress={() => setLabelFilter(on ? null : l)} />;
              })}
            </ChipRow>
          )}
        </>
      )}

          {total === 0 ? (
            <EmptyState
              illustration="no-projects"
              title="No projects yet"
              message="A project is one thing you are making: its sections, its row counts, its yarn and its notes."
              action={
                <PillButton onPress={() => router.push('/project/new')} style={styles.emptyButton}>
                  <ThemedText type="default" themeColor="white">
                    Start a project
                  </ThemedText>
                </PillButton>
              }
            />
          ) : visible.length === 0 ? (
            <EmptyState
              compact
              illustration="nothing-here"
              title="Nothing matches"
              message="Try a different search, or clear a filter."
            />
          ) : (
            <View style={styles.projGrid}>
              {visible.map(([key, p]) => {
                const pct = projectProgress(p).pct;
                const cur = currentSectionOf(p);
                return (
                  // The width lives on this wrapper, not on the CardLink. `Link asChild` hands its
                  // own props to the anchor and the card style lands on a View inside it, so a
                  // percentage set there would measure against an anchor that is only as wide as
                  // its contents — which is exactly how the grid first came out.
                  <View key={key} style={styles.projCardWrap}>
                  <CardLink
                    href={`/project/${key}`}
                    style={styles.projCard}
                    accessibilityLabel={`${p.name}, ${Math.round(pct * 100)}% complete`}>
                    {/* The picture leads, at the size a picture is worth having. A project is the
                        thing you made; a square of it says more than any line of text here. */}
                    <View style={[styles.projThumb, { backgroundColor: p.color }]}>
                      {p.photo ? (
                        <PhotoImage photo={p.photo} style={styles.projPhoto} />
                      ) : null}
                      <ThemedText type="smallBold" themeColor="white" style={styles.projPct}>
                        {Math.round(pct * 100)}%
                      </ThemedText>
                    </View>
                    <View style={styles.projInfo}>
                      <ThemedText type="smallBold" numberOfLines={1}>
                        {p.name}
                      </ThemedText>
                      {/* The project's combined state, not the current section's. Under "All" the
                          cards were otherwise indistinguishable: a frogged project and one on the
                          needles both just read "row 12 of 40". */}
                      <View style={styles.projMeta}>
                        <ProjectStatusBadge status={projectState(p)} />
                        {p.labels.slice(0, 1).map((l) => (
                          <View key={l} style={styles.labelPill}>
                            <ThemedText
                              type="small"
                              themeColor="ink"
                              numberOfLines={1}
                              style={styles.chipText}>
                              {l}
                            </ThemedText>
                          </View>
                        ))}
                      </View>
                      <ThemedText type="small" themeColor="inkSoft" numberOfLines={1}>
                        {CRAFT_LABELS[p.craft]}{cur ? ` · ${cur.name}` : ''}
                      </ThemedText>
                      {/* A project with no sections has nothing to count — render it rather than
                          crash the whole list on a current section that isn't there. */}
                      {cur ? (
                        <ThemedText type="small" themeColor="inkSoft" numberOfLines={1}>
                          row {cur.row} of {cur.totalRows}
                        </ThemedText>
                      ) : null}
                      <ProgressBar pct={pct} color={p.colorDeep} />
                    </View>
                  </CardLink>
                  </View>
                );
              })}
            </View>
          )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  emptyButton: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.five,
  },
  chipText: { maxWidth: 200 },
  labelPill: {
    backgroundColor: Colors.coral,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    flexShrink: 1,
  },
  // Two to a row, sharing the width exactly. It was 47% each, which left the grid a few points
  // short of the right-hand margin that everything above it lines up with.
  //
  // Half each, with the gutter as padding and the grid pulled out by the same amount to cancel it
  // at the edges — the one arrangement where a card on a row of its own is exactly as wide as the
  // cards in the row above.
  projGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    margin: -Spacing.two,
  },
  projCardWrap: {
    width: '50%',
    padding: Spacing.two,
  },
  // The lift is on the card and the clipping is on the picture inside it. Both on one view and
  // the overflow would cut the shadow off along with the photo's corners.
  projCard: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: Radii.medium,
    ...Shadows.card,
  },
  projThumb: {
    aspectRatio: 1,
    overflow: 'hidden',
    borderTopLeftRadius: Radii.medium,
    borderTopRightRadius: Radii.medium,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    padding: Spacing.two,
  },
  projPhoto: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  // Over the corner of the picture, with its own backing so it stays readable on a pale photo —
  // the same trick the project hero uses.
  projPct: {
    backgroundColor: 'rgba(74, 59, 56, 0.55)',
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  projInfo: {
    padding: Spacing.three,
    gap: Spacing.one,
  },
  projMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
});
