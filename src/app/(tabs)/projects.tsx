import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, PillButton, ProgressBar } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { currentSectionIndexOf, projectProgress } from '@/lib/knitwit-helpers';
import { useKnitwitStore } from '@/store/useKnitwitStore';

type StatusFilter = 'all' | 'active' | 'done';

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'In progress' },
  { value: 'done', label: 'Completed' },
];

export default function ProjectsScreen() {
  const router = useRouter();
  const projects = useKnitwitStore((state) => state.projects);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');

  // Derive the visible list in a memo off the raw store slice rather than inside the selector,
  // so Zustand's snapshot stays stable and we don't loop.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.entries(projects).filter(([, p]) => {
      const done = projectProgress(p).pct >= 1;
      if (filter === 'active' && done) return false;
      if (filter === 'done' && !done) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [projects, filter, query]);

  const total = Object.keys(projects).length;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerRow}>
            <ThemedText type="title">Projects</ThemedText>
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
            <View style={styles.projList}>
              {visible.map(([key, p]) => {
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
