import { useRouter } from 'expo-router';
import { PhotoImage } from '@/components/photo';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, PillButton, ProgressBar, ProjectStatusBadge } from '@/components/knitwit-ui';
import { CardLink } from '@/components/card-link';
import { ThemedText } from '@/components/themed-text';
import { usePageTitle } from '@/lib/use-page-title';
import { ThemedView } from '@/components/themed-view';
import { CRAFT_LABELS, CRAFT_ORDER } from '@/constants/catalogs';
import { hasLabel, labelKey, labelsInUse } from '@/lib/labels';
import { Colors, Fonts, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import {
  currentSectionIndexOf,
  matchesCraft,
  projectProgress,
  projectState,
} from '@/lib/knitwit-helpers';
import { useKnitwitStore } from '@/store/useKnitwitStore';
import type { TechniqueCraft } from '@/types/knitwit';

type StatusFilter = 'all' | 'active' | 'finished' | 'frogged';
type CraftFilter = 'all' | TechniqueCraft;

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'In progress' },
  { value: 'finished', label: 'Completed' },
  { value: 'frogged', label: 'Frogged' },
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

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerRow}>
            <ThemedText type="title" heading={1}>Projects</ThemedText>
            <PillButton style={styles.newBtn} onPress={() => router.push('/project/new')}>
              <ThemedText type="smallBold" themeColor="white">
                + New project
              </ThemedText>
            </PillButton>
          </View>

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search projects"
            placeholderTextColor={Colors.inkSoft}
            style={styles.search}
          />

          <View style={styles.filters}>
            {FILTERS.map((f) => (
              <Pressable
                key={f.value}
                onPress={() => setFilter(f.value)}
                style={[styles.chip, filter === f.value && styles.chipActive]}>
                <ThemedText type="smallBold" themeColor={filter === f.value ? 'white' : 'inkSoft'}>
                  {f.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          {/* A second row rather than one long one: these are two independent questions, and
              "All" meaning two different things in the same row would read as a single choice. */}
          <View style={styles.filters}>
            {CRAFT_FILTERS.map((f) => (
              <Pressable
                key={f.value}
                onPress={() => setCraftFilter(f.value)}
                style={[styles.chip, craftFilter === f.value && styles.chipCraftActive]}>
                <ThemedText
                  type="smallBold"
                  themeColor={craftFilter === f.value ? 'white' : 'inkSoft'}>
                  {f.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          {/* A third filter row, and only when there is something to filter by. Its own accent
              again, so which of the three is set is readable without reading them. */}
          {labels.length > 0 && (
            <View style={styles.filters}>
              <Pressable
                onPress={() => setLabelFilter(null)}
                style={[styles.chip, labelFilter === null && styles.chipLabelActive]}>
                <ThemedText type="smallBold" themeColor={labelFilter === null ? 'white' : 'inkSoft'}>
                  Any label
                </ThemedText>
              </Pressable>
              {labels.map((l) => {
                const on = labelFilter !== null && labelKey(l) === labelKey(labelFilter);
                return (
                  <Pressable
                    key={l}
                    onPress={() => setLabelFilter(on ? null : l)}
                    style={[styles.chip, on && styles.chipLabelActive]}>
                    <ThemedText
                      type="smallBold"
                      numberOfLines={1}
                      style={styles.chipText}
                      themeColor={on ? 'white' : 'inkSoft'}>
                      {l}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          )}

          {total === 0 ? (
            <Card style={styles.emptyCard}>
              <ThemedText type="smallBold">No projects yet</ThemedText>
              <ThemedText type="small" themeColor="inkSoft">
                Tap “+ New project” to cast on your first one.
              </ThemedText>
            </Card>
          ) : visible.length === 0 ? (
            <Card style={styles.emptyCard}>
              <ThemedText type="smallBold">Nothing matches</ThemedText>
              <ThemedText type="small" themeColor="inkSoft">
                Try a different search or filter.
              </ThemedText>
            </Card>
          ) : (
            <View style={styles.projGrid}>
              {visible.map(([key, p]) => {
                const pct = projectProgress(p).pct;
                const cur = p.sections[currentSectionIndexOf(p)];
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
                        {CRAFT_LABELS[p.craft]} · {cur.name}
                      </ThemedText>
                      <ThemedText type="small" themeColor="inkSoft" numberOfLines={1}>
                        row {cur.row} of {cur.totalRows}
                      </ThemedText>
                      <ProgressBar pct={pct} color={p.colorDeep} />
                    </View>
                  </CardLink>
                  </View>
                );
              })}
            </View>
          )}
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
    gap: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  newBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  search: {
    backgroundColor: Colors.white,
    borderRadius: Radii.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontFamily: Fonts.bodySemibold,
    fontSize: 15,
    color: Colors.ink,
  },
  filters: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  chip: {
    backgroundColor: Colors.creamDeep,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chipActive: {
    backgroundColor: Colors.blushDeep,
  },
  // A different accent from the status row, so which of the two filters is set is readable at a
  // glance rather than by counting rows.
  chipCraftActive: {
    backgroundColor: Colors.lavenderDeep,
  },
  chipLabelActive: {
    backgroundColor: Colors.coralDeep,
  },
  // A group name can be a sentence, so it has to be allowed to truncate rather than push the
  // row's progress bar off the card.
  chipText: { maxWidth: 200 },
  labelPill: {
    backgroundColor: Colors.coral,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    flexShrink: 1,
  },
  emptyCard: {
    gap: Spacing.one,
  },
  projGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  projCardWrap: {
    width: '47%',
  },
  projCard: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: Radii.medium,
    overflow: 'hidden',
  },
  projThumb: {
    aspectRatio: 1,
    overflow: 'hidden',
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
    padding: Spacing.two,
    gap: Spacing.one,
  },
  projMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
});
