import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Card, Spinner } from '@/components/knitwit-ui';
import { CardLink } from '@/components/card-link';
import { ThemedText } from '@/components/themed-text';
import { CRAFT_LABELS, CRAFT_ORDER } from '@/constants/catalogs';
import { Colors, Fonts, Radii, Spacing } from '@/constants/theme';
import { matchesCraft } from '@/lib/knitwit-helpers';
import {
  FAMILY_LABELS,
  FAMILY_ORDER,
  resolveTechnique,
  STATUS_LABELS,
  STATUS_ORDER,
} from '@/lib/technique-catalogue';
import { useKnitwitStore } from '@/store/useKnitwitStore';
import type { TechniqueCraft, TechniqueFamily, TechniqueStatus } from '@/types/knitwit';

type CraftFilter = TechniqueCraft | 'all';

const CRAFT_FILTERS: { value: CraftFilter; label: string }[] = [
  { value: 'all', label: 'All crafts' },
  ...CRAFT_ORDER.map((c) => ({ value: c as CraftFilter, label: CRAFT_LABELS[c] })),
];

const STATUS_COLOURS: Record<TechniqueStatus, string> = {
  want: Colors.creamDeep,
  learning: Colors.butter,
  known: Colors.sage,
};

// The knitter's techniques, and the catalogue behind them.
//
// Opens on what they've marked — the answer to "what do I know?" — with the rest of the catalogue
// one tap away. Techniques are picked from the catalogue rather than typed, so two knitters'
// German short rows are the same thing and a pattern can point at it.
export function TechniqueLibrary() {
  const mine = useKnitwitStore((state) => state.techniques);
  const catalogue = useKnitwitStore((state) => state.catalogue);
  const catalogueError = useKnitwitStore((state) => state.catalogueError);
  const loadCatalogue = useKnitwitStore((state) => state.loadCatalogue);
  const setTechniqueStatus = useKnitwitStore((state) => state.setTechniqueStatus);

  const [browsing, setBrowsing] = useState(false);
  const [craft, setCraft] = useState<CraftFilter>('all');
  const [query, setQuery] = useState('');

  // Fetched on arrival, not at launch: the catalogue is only needed on this screen and by the
  // importer, and it is cached for a day once it's here.
  useEffect(() => {
    void loadCatalogue();
  }, [loadCatalogue]);

  const catalogueList = useMemo(() => Object.values(catalogue), [catalogue]);
  const loading = catalogueList.length === 0 && !catalogueError;

  // Everything the knitter has marked, resolved so custom entries and catalogue entries look the
  // same to the list below.
  const marked = useMemo(
    () =>
      Object.entries(mine)
        .map(([id, t]) => ({ ...resolveTechnique(id, t, catalogue), status: t.status, notes: t.notes }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [mine, catalogue],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const source = browsing
      ? catalogueList
          .filter((t) => !mine[t.id])
          .map((t) => ({ ...t, isCustom: false, status: null as TechniqueStatus | null, notes: '' }))
      : marked;
    return source.filter((t) => {
      if (!matchesCraft(t.craft, craft)) return false;
      if (q && !t.name.toLowerCase().includes(q) && !t.summary.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [browsing, catalogueList, mine, marked, craft, query]);

  // Grouped by family when browsing, because that's how you look for something you don't know the
  // name of. A flat list is right for your own, which is short and alphabetical.
  const groups = useMemo(() => {
    if (!browsing) return [{ family: null as TechniqueFamily | null, items: shown }];
    return FAMILY_ORDER.map((family) => ({
      family,
      items: shown.filter((t) => t.family === family),
    })).filter((g) => g.items.length > 0);
  }, [browsing, shown]);

  return (
    <View style={styles.wrap}>
      <View style={styles.tabs}>
        <Pressable
          onPress={() => setBrowsing(false)}
          style={[styles.tab, !browsing && styles.tabOn]}>
          <ThemedText type="smallBold" themeColor={!browsing ? 'white' : 'inkSoft'}>
            Mine ({Object.keys(mine).length})
          </ThemedText>
        </Pressable>
        <Pressable onPress={() => setBrowsing(true)} style={[styles.tab, browsing && styles.tabOn]}>
          <ThemedText type="smallBold" themeColor={browsing ? 'white' : 'inkSoft'}>
            Browse all
          </ThemedText>
        </Pressable>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={browsing ? 'Search the catalogue' : 'Search your techniques'}
        placeholderTextColor={Colors.inkSoft}
        style={styles.search}
      />

      <View style={styles.chipRow}>
        {CRAFT_FILTERS.map((f) => (
          <Pressable
            key={f.value}
            onPress={() => setCraft(f.value)}
            style={[styles.chip, craft === f.value && styles.chipOn]}>
            <ThemedText type="smallBold" themeColor={craft === f.value ? 'white' : 'inkSoft'}>
              {f.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <Card style={styles.notice}>
          <Spinner />
          <ThemedText type="small" themeColor="inkSoft">
            Fetching the technique catalogue…
          </ThemedText>
        </Card>
      ) : null}

      {/* Only when there is nothing cached to fall back on. With a cache the knitter never needs
          to hear that a refresh failed. */}
      {catalogueError && catalogueList.length === 0 ? (
        <Card style={styles.notice}>
          <ThemedText type="smallBold">Couldn&apos;t reach the catalogue</ThemedText>
          <ThemedText type="small" themeColor="inkSoft">
            Your own techniques are all here. The rest will load next time you have a connection.
          </ThemedText>
          <Pressable onPress={() => void loadCatalogue(true)} hitSlop={6} style={styles.retry}>
            <ThemedText type="smallBold" themeColor="sageDeep">
              Try again
            </ThemedText>
          </Pressable>
        </Card>
      ) : null}

      {shown.length === 0 && !loading ? (
        <Card style={styles.notice}>
          <ThemedText type="smallBold">
            {browsing ? 'Nothing matches' : 'No techniques yet'}
          </ThemedText>
          <ThemedText type="small" themeColor="inkSoft">
            {browsing
              ? 'Try a different search, or another craft.'
              : 'Tap “Browse all” to find the ones you know — or want to.'}
          </ThemedText>
        </Card>
      ) : null}

      {groups.map((group) => (
        <View key={group.family ?? 'mine'} style={styles.group}>
          {group.family ? (
            <ThemedText type="smallBold" themeColor="inkSoft">
              {FAMILY_LABELS[group.family]}
            </ThemedText>
          ) : null}
          {group.items.map((t) => (
            <View key={t.id} style={styles.row}>
              <CardLink href={`/technique/${t.id}`} style={styles.rowMain}>
                <ThemedText type="smallBold">
                  {t.name}
                  {t.isCustom ? ' · yours' : ''}
                </ThemedText>
                <ThemedText type="small" themeColor="inkSoft" numberOfLines={2}>
                  {CRAFT_LABELS[t.craft]}
                  {t.summary ? ` · ${t.summary}` : ''}
                </ThemedText>
              </CardLink>
              {/* Status set from the row. Finding out you already know something shouldn't cost a
                  screen transition. Tapping the one that's already set clears it. */}
              <View style={styles.statusRow}>
                {STATUS_ORDER.map((s) => {
                  const on = t.status === s;
                  return (
                    <Pressable
                      key={s}
                      hitSlop={4}
                      onPress={() => setTechniqueStatus(t.id, on ? null : s)}
                      style={[
                        styles.statusDot,
                        { backgroundColor: on ? STATUS_COLOURS[s] : Colors.cream },
                        on && styles.statusDotOn,
                      ]}>
                      <ThemedText type="small" themeColor={on ? 'ink' : 'inkSoft'}>
                        {STATUS_LABELS[s]}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  tabs: { flexDirection: 'row', gap: Spacing.two },
  tab: {
    backgroundColor: Colors.creamDeep,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  tabOn: { backgroundColor: Colors.blushDeep },
  search: {
    backgroundColor: Colors.white,
    borderRadius: Radii.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontFamily: Fonts.bodySemibold,
    fontSize: 15,
    color: Colors.ink,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    backgroundColor: Colors.creamDeep,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chipOn: { backgroundColor: Colors.lavenderDeep },
  notice: { gap: Spacing.one, alignItems: 'flex-start' },
  retry: { paddingTop: Spacing.one },
  group: { gap: Spacing.two, marginTop: Spacing.two },
  row: {
    backgroundColor: Colors.white,
    borderRadius: Radii.medium,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  rowMain: { gap: 2 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  statusDot: {
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.creamDeep,
  },
  statusDotOn: { borderColor: 'transparent' },
});
