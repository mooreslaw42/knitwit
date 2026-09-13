import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, PillButton, Thumb } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  CRAFT_LABELS,
  CRAFT_ORDER,
  TOOL_ICONS,
  TOOL_TYPE_LABELS,
  yarnWeightLabel,
} from '@/constants/catalogs';
import { Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { toolInUseCount } from '@/lib/knitwit-helpers';
import { useKnitwitStore } from '@/store/useKnitwitStore';
import type { PatternCategory, TechniqueCraft } from '@/types/knitwit';

// Everything a knitter keeps rather than works on: patterns, the techniques they've noted down,
// and the yarn and tools in their stash. Materials used to be its own menu item; four segments in
// one place beats two top-level entries that both mean "my reference material".
type LibraryView = 'patterns' | 'techniques' | 'materials' | 'tools';

const VIEWS: { id: LibraryView; label: string; singular: string }[] = [
  { id: 'patterns', label: 'Patterns', singular: 'pattern' },
  { id: 'techniques', label: 'Techniques', singular: 'technique' },
  { id: 'materials', label: 'Yarn', singular: 'material' },
  { id: 'tools', label: 'Tools', singular: 'tool' },
];

const NEW_ROUTE = {
  patterns: '/pattern/new',
  techniques: '/technique/new',
  materials: '/material/new',
  tools: '/tool/new',
} as const satisfies Record<LibraryView, string>;

export default function LibraryScreen() {
  const router = useRouter();
  const patterns = useKnitwitStore((state) => state.patterns);
  const techniques = useKnitwitStore((state) => state.techniques);
  const materials = useKnitwitStore((state) => state.materials);
  const tools = useKnitwitStore((state) => state.tools);
  const projects = useKnitwitStore((state) => state.projects);
  const toggleFavorite = useKnitwitStore((state) => state.toggleFavorite);
  const [view, setView] = useState<LibraryView>('patterns');
  const [filter, setFilter] = useState<'all' | PatternCategory>('all');
  const [craft, setCraft] = useState<'all' | TechniqueCraft>('all');

  const entries = Object.entries(patterns);

  // A pattern marked 'both' shows under either craft, because it is either.
  const byCraft =
    craft === 'all'
      ? entries
      : entries.filter(([, p]) => p.craft === craft || p.craft === 'both');
  const visible = filter === 'all' ? byCraft : byCraft.filter(([, p]) => p.category === filter);
  const usedCrafts = CRAFT_ORDER.filter((c) => entries.some(([, p]) => p.craft === c));
  // Categories follow the craft filter, so it never offers one with nothing behind it.
  const usedCategories = CATEGORY_ORDER.filter((c) => byCraft.some(([, p]) => p.category === c));
  const techniqueEntries = Object.entries(techniques);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerRow}>
            <ThemedText type="title">Library</ThemedText>
            <PillButton style={styles.newBtn} onPress={() => router.push(NEW_ROUTE[view])}>
              <ThemedText type="smallBold" themeColor="white">
                + New {VIEWS.find((v) => v.id === view)?.singular}
              </ThemedText>
            </PillButton>
          </View>

          <View style={styles.segment}>
            {VIEWS.map((v) => (
              <SegButton
                key={v.id}
                label={v.label}
                active={view === v.id}
                onPress={() => setView(v.id)}
              />
            ))}
          </View>

          {view === 'patterns' ? (
            <>
              {/* Only worth showing once there's more than one kind in the library. */}
              {usedCrafts.length > 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
                  <FilterChip label="All crafts" active={craft === 'all'} onPress={() => setCraft('all')} />
                  {usedCrafts.map((c) => (
                    <FilterChip
                      key={c}
                      label={CRAFT_LABELS[c]}
                      active={craft === c}
                      onPress={() => setCraft(c)}
                    />
                  ))}
                </ScrollView>
              )}
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
          ) : view === 'techniques' ? (
            techniqueEntries.length === 0 ? (
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
            )
          ) : view === 'materials' ? (
            <View style={styles.techList}>
              {Object.entries(materials).map(([id, m]) => {
                const meta = [
                  m.composition,
                  m.weight ? yarnWeightLabel(m.weight) : '',
                  `${m.grams || '?'}g / ${m.meters || '?'}m`,
                  m.price ? `€${m.price}` : '',
                ]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <Pressable
                    key={id}
                    style={styles.stashRow}
                    onPress={() => router.push(`/material/${id}`)}>
                    <Thumb photo={m.photo} />
                    <View style={styles.techInfo}>
                      <ThemedText type="smallBold">
                        {m.brand} — {m.colorName}
                      </ThemedText>
                      <ThemedText type="small" themeColor="inkSoft">
                        {meta}
                      </ThemedText>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.techList}>
              {Object.entries(tools).map(([id, t]) => {
                const owned = t.quantity ?? 1;
                const inUse = toolInUseCount(projects, id);
                return (
                  <Pressable
                    key={id}
                    style={styles.stashRow}
                    onPress={() => router.push(`/tool/${id}`)}>
                    <Thumb>
                      <ThemedText type="default">{TOOL_ICONS[t.type]}</ThemedText>
                    </Thumb>
                    <View style={styles.techInfo}>
                      <ThemedText type="smallBold">
                        {t.thickness} {TOOL_TYPE_LABELS[t.type]}
                      </ThemedText>
                      <ThemedText type="small" themeColor="inkSoft">
                        {t.length}
                      </ThemedText>
                    </View>
                    <View style={[styles.qtyPill, inUse > 0 && styles.qtyPillActive]}>
                      <ThemedText type="small" themeColor={inUse > 0 ? 'coralDeep' : 'inkSoft'}>
                        {inUse > 0 ? `${owned} · ${inUse} in use` : `${owned} in stash`}
                      </ThemedText>
                    </View>
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
  stashRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: Colors.white,
    borderRadius: Radii.medium,
    padding: Spacing.three,
  },
  qtyPill: {
    backgroundColor: Colors.creamDeep,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  qtyPillActive: {
    backgroundColor: Colors.butter,
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
    flex: 1,
    gap: 2,
  },
});
