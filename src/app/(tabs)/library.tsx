import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '@/constants/catalogs';
import { Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { useKnitwitStore } from '@/store/useKnitwitStore';
import type { PatternCategory } from '@/types/knitwit';

export default function LibraryScreen() {
  const patterns = useKnitwitStore((state) => state.patterns);
  const toggleFavorite = useKnitwitStore((state) => state.toggleFavorite);
  const [filter, setFilter] = useState<'all' | PatternCategory>('all');

  const entries = Object.entries(patterns);
  const usedCategories = CATEGORY_ORDER.filter((c) => entries.some(([, p]) => p.category === c));
  const visible = filter === 'all' ? entries : entries.filter(([, p]) => p.category === filter);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="title">Pattern library</ThemedText>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
            <FilterChip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
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
              <View key={id} style={styles.libCard}>
                <View style={[styles.libThumb, { backgroundColor: pt.accentColor }]} />
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
                    {CATEGORY_LABELS[pt.category]} · {pt.weight}
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
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
});
