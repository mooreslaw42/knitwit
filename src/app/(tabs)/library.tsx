import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, PillButton } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '@/constants/catalogs';
import { Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { useKnitwitStore } from '@/store/useKnitwitStore';
import type { PatternCategory, TechniqueCraft } from '@/types/knitwit';

const CRAFT_LABELS: Record<TechniqueCraft, string> = {
  knit: 'Knitting',
  crochet: 'Crochet',
  both: 'Knitting & crochet',
};

export default function LibraryScreen() {
  const router = useRouter();
  const patterns = useKnitwitStore((state) => state.patterns);
  const techniques = useKnitwitStore((state) => state.techniques);
  const toggleFavorite = useKnitwitStore((state) => state.toggleFavorite);
  const [view, setView] = useState<'patterns' | 'techniques'>('patterns');
  const [filter, setFilter] = useState<'all' | PatternCategory>('all');

  const entries = Object.entries(patterns);
  const usedCategories = CATEGORY_ORDER.filter((c) => entries.some(([, p]) => p.category === c));
  const visible = filter === 'all' ? entries : entries.filter(([, p]) => p.category === filter);
  const techniqueEntries = Object.entries(techniques);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerRow}>
            <ThemedText type="title">Library</ThemedText>
            <PillButton
              style={styles.newBtn}
              onPress={() =>
                router.push(view === 'patterns' ? '/pattern/new' : '/technique/new')
              }>
              <ThemedText type="smallBold" themeColor="white">
                + New {view === 'patterns' ? 'pattern' : 'technique'}
              </ThemedText>
            </PillButton>
          </View>

          <View style={styles.segment}>
            <SegButton
              label="Patterns"
              active={view === 'patterns'}
              onPress={() => setView('patterns')}
            />
            <SegButton
              label="Techniques"
              active={view === 'techniques'}
              onPress={() => setView('techniques')}
            />
          </View>

          {view === 'patterns' ? (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
                <FilterChip
                  label="All"
                  active={filter === 'all'}
                  onPress={() => setFilter('all')}
                />
                {usedCategories.map((c) => (
                  <FilterChip
                    key={c}
                    label={CATEGORY_LABELS[c]}
                    active={filter === c}
                    onPress={() => setFilter(c)}
                  />
                ))}
              </ScrollView>

              <View style={styles.grid}>
                {visible.map(([id, pt]) => (
                  <Pressable
                    key={id}
                    style={styles.libCard}
                    onPress={() => router.push(`/pattern/${id}`)}>
                    <View style={[styles.libThumb, { backgroundColor: pt.accentColor }]}>
                      {pt.photo ? (
                        <Image source={{ uri: pt.photo }} style={styles.libPhoto} />
                      ) : null}
                    </View>
                    <View style={styles.libInfo}>
                      <Pressable
                        onPress={() => toggleFavorite(id)}
                        hitSlop={8}
                        style={styles.heartBtn}>
                        <ThemedText type="default">{pt.favorited ? '♥' : '♡'}</ThemedText>
                      </Pressable>
                      <ThemedText type="smallBold" numberOfLines={1}>
                        {pt.name}
                      </ThemedText>
                      <ThemedText type="small" themeColor="inkSoft">
                        {CATEGORY_LABELS[pt.category]}
                        {pt.needleSize || pt.weight ? ` · ${pt.needleSize || pt.weight}` : ''}
                      </ThemedText>
                    </View>
                  </Pressable>
                ))}
              </View>
            </>
          ) : techniqueEntries.length === 0 ? (
            <Card style={styles.emptyCard}>
              <ThemedText type="smallBold">No techniques yet</ThemedText>
              <ThemedText type="small" themeColor="inkSoft">
                Tap “+ New technique” to jot down a cast-on, decrease or finishing trick.
              </ThemedText>
            </Card>
          ) : (
            <View style={styles.techList}>
              {techniqueEntries.map(([id, t]) => (
                <Pressable
                  key={id}
                  style={styles.techRow}
                  onPress={() => router.push(`/technique/${id}`)}>
                  <View style={styles.techInfo}>
                    <ThemedText type="smallBold">{t.name}</ThemedText>
                    <ThemedText type="small" themeColor="inkSoft" numberOfLines={2}>
                      {CRAFT_LABELS[t.craft]}
                      {t.notes ? ` · ${t.notes}` : ''}
                    </ThemedText>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function SegButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.segBtn, active && styles.segBtnActive]}>
      <ThemedText type="smallBold" themeColor={active ? 'ink' : 'inkSoft'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.filterChip, active && styles.filterChipActive]}>
      <ThemedText type="smallBold" themeColor={active ? 'white' : 'inkSoft'}>
        {label}
      </ThemedText>
    </Pressable>
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
  segment: {
    flexDirection: 'row',
    backgroundColor: Colors.creamDeep,
    borderRadius: Radii.pill,
    padding: 4,
  },
  segBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Radii.pill,
  },
  segBtnActive: {
    backgroundColor: Colors.white,
  },
  filters: {
    flexGrow: 0,
  },
  filterChip: {
    backgroundColor: Colors.creamDeep,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    marginRight: Spacing.two,
  },
  filterChipActive: {
    backgroundColor: Colors.blushDeep,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  libCard: {
    width: '47%',
    backgroundColor: Colors.white,
    borderRadius: Radii.medium,
    overflow: 'hidden',
  },
  libThumb: {
    aspectRatio: 1,
    overflow: 'hidden',
  },
  libPhoto: {
    width: '100%',
    height: '100%',
  },
  libInfo: {
    padding: Spacing.two,
    gap: 2,
  },
  heartBtn: {
    position: 'absolute',
    top: -34,
    right: Spacing.two,
  },
  emptyCard: {
    gap: Spacing.one,
  },
  techList: {
    gap: Spacing.two,
  },
  techRow: {
    backgroundColor: Colors.white,
    borderRadius: Radii.medium,
    padding: Spacing.three,
  },
  techInfo: {
    gap: 2,
  },
});
