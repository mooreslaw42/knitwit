import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { KnitIcon } from '@/components/icons/KnitIcon';
import { YarnSkein } from '@/components/illustrations/YarnSkein';
import { yarnSwatchColor } from '@/components/illustrations/yarn-colors';
import { EmptyState } from '@/components/illustrations/EmptyState';
import { Chip, ChipRow, IconButton, PillButton, RowSurface, Thumb } from '@/components/knitwit-ui';
import { Screen, ScreenHeader } from '@/components/screen';
import { TechniqueLibrary } from '@/components/technique-library';
import { CardLink } from '@/components/card-link';
import { ThemedText } from '@/components/themed-text';
import { usePageTitle } from '@/lib/use-page-title';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  CRAFT_LABELS,
  CRAFT_ORDER,
  TOOL_ICONS,
  MATERIAL_STATUS_LABELS,
  TOOL_TYPE_LABELS,
  yarnWeightLabel,
  describeToolSize,
  scaleForToolType,
} from '@/constants/catalogs';
import { Colors, Radii, Shadows, Spacing } from '@/constants/theme';
import { toolInUseCount } from '@/lib/knitwit-helpers';
import { useKnitwitStore } from '@/store/useKnitwitStore';
import { summarizePattern } from '@/lib/pattern-summary';
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
  materials: '/material/new',
  tools: '/tool/new',
} as const satisfies Partial<Record<LibraryView, string>>;

// Enough to recognise a palette by; the count in the line above says how many there are in all.
const MAX_SWATCHES = 12;

export default function LibraryScreen() {
  usePageTitle('Library');
  const router = useRouter();
  const patterns = useKnitwitStore((state) => state.patterns);
  const materials = useKnitwitStore((state) => state.materials);
  const tools = useKnitwitStore((state) => state.tools);
  const projects = useKnitwitStore((state) => state.projects);
  const toggleFavorite = useKnitwitStore((state) => state.toggleFavorite);
  const [view, setView] = useState<LibraryView>('patterns');
  const [filter, setFilter] = useState<'all' | PatternCategory>('all');
  const [craft, setCraft] = useState<'all' | TechniqueCraft>('all');

  const entries = Object.entries(patterns);
  // How many projects have been made from each pattern — one of the few things that tells two
  // similar patterns apart ("the one I knitted twice").
  const projectCounts = new Map<string, number>();
  for (const p of Object.values(projects)) {
    if (p.patternId) projectCounts.set(p.patternId, (projectCounts.get(p.patternId) ?? 0) + 1);
  }

  // A pattern marked 'both' shows under either craft, because it is either.
  const byCraft =
    craft === 'all'
      ? entries
      : entries.filter(([, p]) => p.craft === craft || p.craft === 'both');
  const visible = filter === 'all' ? byCraft : byCraft.filter(([, p]) => p.category === filter);
  const usedCrafts = CRAFT_ORDER.filter((c) => entries.some(([, p]) => p.craft === c));
  // Categories follow the craft filter, so it never offers one with nothing behind it.
  const usedCategories = CATEGORY_ORDER.filter((c) => byCraft.some(([, p]) => p.category === c));

  const singular = VIEWS.find((v) => v.id === view)?.singular;
  const openNew = () => {
    if (view !== 'techniques') router.push(NEW_ROUTE[view] as Parameters<typeof router.push>[0]);
  };

  return (
    <Screen>
      <ScreenHeader
        title="Library"
        // No "new technique": a technique is picked from the shared catalogue, not written. The
        // techniques view has its own Browse tab for that.
        trailing={
          view !== 'techniques' ? (
            <IconButton icon="plus" label={`New ${singular}`} variant="primary" onPress={openNew} />
          ) : undefined
        }
      />

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
                <ChipRow>
                  <Chip label="All crafts" selected={craft === 'all'} onPress={() => setCraft('all')} />
                  {usedCrafts.map((c) => (
                    <Chip
                      key={c}
                      label={CRAFT_LABELS[c]}
                      selected={craft === c}
                      onPress={() => setCraft(c)}
                    />
                  ))}
                </ChipRow>
              )}
              {/* With one category there is nothing to choose between. */}
              {usedCategories.length > 1 && (
                <ChipRow>
                  <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
                  {usedCategories.map((c) => (
                    <Chip
                      key={c}
                      label={CATEGORY_LABELS[c]}
                      selected={filter === c}
                      onPress={() => setFilter(c)}
                    />
                  ))}
                </ChipRow>
              )}

              {entries.length === 0 && (
                <EmptyState
                  illustration="no-patterns"
                  title="No patterns yet"
                  message="Upload a PDF, paste the text, or chart one yourself. Knitwit reads it into sections and rows you can count through."
                  action={
                    <PillButton onPress={openNew} style={styles.emptyButton}>
                      <ThemedText type="default" themeColor="white">
                        Add a pattern
                      </ThemedText>
                    </PillButton>
                  }
                />
              )}

              <View style={styles.libList}>
                {visible.map(([id, pt]) => {
                  const summary = summarizePattern(pt, projectCounts.get(id) ?? 0);
                  return (
                    // The favourite toggle is a sibling of the link, not inside it. A button nested
                    // in an anchor is invalid on web, and tapping the heart would follow the link as
                    // well as toggling — so the row is a link and the heart sits beside it.
                    <View key={id} style={styles.libRowWrap}>
                      {/* The link gets the width; see libRowLink. */}
                      <View style={styles.libRowLink}>
                      <CardLink href={`/pattern/${id}`} style={styles.libRow}>
                        <Thumb photo={pt.photo} color={pt.accentColor} size={64} />
                        <View style={styles.libInfo}>
                          <ThemedText type="smallBold" numberOfLines={1}>
                            {pt.name}
                          </ThemedText>
                          <ThemedText type="small" themeColor="inkSoft" numberOfLines={1}>
                            {summary.kind}
                          </ThemedText>
                          {summary.contents ? (
                            <ThemedText type="small" themeColor="inkSoft" numberOfLines={1}>
                              {summary.contents}
                            </ThemedText>
                          ) : null}
                          {summary.colors.length > 0 && (
                            <View style={styles.swatches}>
                              {summary.colors.slice(0, MAX_SWATCHES).map((c, i) => (
                                <View key={i} style={[styles.swatch, { backgroundColor: c }]} />
                              ))}
                            </View>
                          )}
                        </View>
                      </CardLink>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          pt.favorited ? `Unfavourite ${pt.name}` : `Favourite ${pt.name}`
                        }
                        onPress={() => toggleFavorite(id)}
                        hitSlop={8}
                        style={styles.heartBtn}>
                        <KnitIcon
                          name={pt.favorited ? 'bookmark-filled' : 'bookmark'}
                          color={Colors.coralDeep}
                          accent={pt.favorited ? undefined : Colors.coral}
                        />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </>
          ) : view === 'techniques' ? (
            <TechniqueLibrary />
          ) : view === 'materials' ? (
            <View style={styles.techList}>
              {Object.keys(materials).length === 0 && (
                <EmptyState
                  illustration="no-materials"
                  title="Your stash is empty"
                  message="Add a yarn by hand, or photograph its ball band and Knitwit fills in the details."
                  action={
                    <PillButton onPress={openNew} style={styles.emptyButton}>
                      <ThemedText type="default" themeColor="white">
                        Add a yarn
                      </ThemedText>
                    </PillButton>
                  }
                />
              )}
              {Object.entries(materials).map(([id, m]) => {
                const status = m.status ?? 'instash';
                const meta = [
                  // How many you have comes first: it is what the list is scanned for.
                  m.skeins != null ? `${m.skeins} ${m.skeins === 1 ? 'skein' : 'skeins'}` : '',
                  // Only when it is not the ordinary case — a stash list where every row says
                  // "In the stash" has just become a stash list with a wasted column.
                  status === 'instash' ? '' : MATERIAL_STATUS_LABELS[status],
                  m.composition,
                  m.weight ? yarnWeightLabel(m.weight) : '',
                  `${m.grams || '?'}g / ${m.meters || '?'}m`,
                  m.location ? m.location : '',
                  m.price ? `€${m.price}` : '',
                ]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <CardLink
                    key={id}
                    style={styles.stashRow}
                    href={`/material/${id}`}>
                    <Thumb photo={m.photo}>
                      <YarnSkein color={yarnSwatchColor(m.colorName, m.swatch)} size={44} />
                    </Thumb>
                    <View style={styles.techInfo}>
                      <ThemedText type="smallBold">
                        {m.brand} — {m.colorName}
                      </ThemedText>
                      <ThemedText type="small" themeColor="inkSoft">
                        {meta}
                      </ThemedText>
                    </View>
                  </CardLink>
                );
              })}
            </View>
          ) : (
            <View style={styles.techList}>
              {Object.keys(tools).length === 0 && (
                <EmptyState
                  illustration="no-tools"
                  title="No needles or hooks yet"
                  message="Add what you own, and a project can say which ones it is using."
                  action={
                    <PillButton onPress={openNew} style={styles.emptyButton}>
                      <ThemedText type="default" themeColor="white">
                        Add a tool
                      </ThemedText>
                    </PillButton>
                  }
                />
              )}
              {Object.entries(tools).map(([id, t]) => {
                const owned = t.quantity ?? 1;
                const inUse = toolInUseCount(projects, id);
                return (
                  <CardLink
                    key={id}
                    style={styles.stashRow}
                    href={`/tool/${id}`}>
                    <Thumb>
                      <KnitIcon
                        name={TOOL_ICONS[t.type]}
                        size={26}
                        color={Colors.lavenderDeep}
                        accent={Colors.lavender}
                      />
                    </Thumb>
                    <View style={styles.techInfo}>
                      <ThemedText type="smallBold">
                        {describeToolSize(t.thickness, scaleForToolType(t.type))} ·{' '}
                        {TOOL_TYPE_LABELS[t.type]}
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
                  </CardLink>
                );
              })}
            </View>
          )}
    </Screen>
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

const styles = StyleSheet.create({
  emptyButton: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.five,
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
    ...Shadows.card,
  },
  libList: {
    gap: Spacing.two,
  },
  // The row is the link and the heart is its neighbour, so the row takes the space and the heart
  // keeps the end. No absolute positioning: in a row there is a real place for it to sit.
  libRowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: Colors.white,
    borderRadius: Radii.medium,
    paddingRight: Spacing.three,
    ...Shadows.card,
  },
  // `Link asChild` hands its props to an anchor that is only as wide as its contents, so a long
  // summary line ran straight past the edge of the card and pushed the bookmark off the screen
  // with it. The width has to be claimed by a view around the link; minWidth lets the text inside
  // shrink to it and truncate.
  libRowLink: {
    flex: 1,
    minWidth: 0,
  },
  libRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  libInfo: {
    gap: 2,
    flex: 1,
    minWidth: 0,
  },
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    marginTop: 2,
  },
  swatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(74, 59, 56, 0.15)',
  },
  heartBtn: {
    marginLeft: 'auto',
  },
  emptyCard: {
    gap: Spacing.one,
  },
  stashRow: {
    ...RowSurface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
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
