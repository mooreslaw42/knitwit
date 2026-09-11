import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, FormField, PillButton, SelectField } from '@/components/knitwit-ui';
import { StitchChart, type ChartSelection } from '@/components/stitch-chart';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { STITCHES, STITCH_ORDER } from '@/constants/catalogs';
import { Colors, Fonts, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { rowStitchesAfter, sectionRowCounts } from '@/lib/knitwit-helpers';
import { goBackOr } from '@/lib/navigation';
import { useKnitwitStore } from '@/store/useKnitwitStore';
import type { PatternRow, PatternStitchGroup, StitchSide, StitchSpan } from '@/types/knitwit';

type EditGroup = {
  id: string;
  type: string;
  span: StitchSpan;
  count: string;
  materialSlot: string | null;
  note: string;
};
type EditRow = {
  id: string;
  label: string;
  side: StitchSide;
  marker: boolean;
  instruction: string;
  stitches: EditGroup[];
};

let uidN = 1;
const uid = (p: string) => `${p}${Date.now().toString(36)}${uidN++}`;

const STITCH_OPTIONS = STITCH_ORDER.map((k) => ({
  value: k,
  label: `${STITCHES[k].abbr} · ${STITCHES[k].label}`,
}));

const SPANS: { value: StitchSpan; label: string }[] = [
  { value: 'exact', label: 'Times' },
  { value: 'all', label: 'Across' },
  { value: 'to-last', label: 'To last' },
];

function toEditGroup(g: PatternStitchGroup): EditGroup {
  return {
    id: g.id,
    type: g.type,
    span: g.span,
    count: g.count != null ? String(g.count) : '',
    materialSlot: g.materialSlot,
    note: g.note,
  };
}
function toEditRow(r: PatternRow): EditRow {
  return {
    id: r.id,
    label: r.label,
    side: r.side,
    marker: r.marker,
    instruction: r.instruction,
    stitches: r.stitches.map(toEditGroup),
  };
}
function toGroup(g: EditGroup): PatternStitchGroup {
  const n = parseInt(g.count, 10);
  return {
    id: g.id,
    type: g.type,
    span: g.span,
    count: g.span === 'all' || Number.isNaN(n) ? null : Math.max(0, n),
    materialSlot: g.materialSlot,
    note: g.note.trim(),
  };
}
function toRow(r: EditRow, i: number): PatternRow {
  return {
    id: r.id,
    label: r.label.trim() || `Row ${i + 1}`,
    side: r.side,
    marker: r.marker,
    instruction: r.instruction.trim(),
    stitches: r.stitches.map(toGroup),
  };
}

// A short readable summary of a group, e.g. "k2", "M1L", "k to last 1", "p across".
function groupLabel(g: EditGroup): string {
  const def = STITCHES[g.type];
  const abbr = def ? def.abbr : g.type;
  if (g.span === 'all') return `${abbr} across`;
  if (g.span === 'to-last') return `${abbr} to last ${g.count || '?'}`;
  return `${abbr}${def && def.takes > 0 && g.count ? g.count : ''}`;
}

export default function SectionStitchesScreen() {
  const { id, index } = useLocalSearchParams<{ id: string; index: string }>();
  const sectionIndex = Number(index);
  const router = useRouter();

  const pattern = useKnitwitStore((state) => state.patterns[id]);
  const savePattern = useKnitwitStore((state) => state.savePattern);
  const section = pattern?.sections[sectionIndex];

  const [description, setDescription] = useState(section?.description ?? '');
  const [castOn, setCastOn] = useState(String(section?.castOn ?? 0));
  const [rows, setRows] = useState<EditRow[]>(() => (section?.rows ?? []).map(toEditRow));
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Which stitch group the user tapped in the chart, if any.
  const [selected, setSelected] = useState<ChartSelection | null>(null);

  // Derived before the missing-pattern guard: everything here reads component state, not the
  // section, and an early return sitting above these declarations trips up the React Compiler's
  // memoisation (it hoists them into a block that runs regardless).
  const patternRows = rows.map(toRow);
  const startCount = Math.max(0, parseInt(castOn, 10) || 0);
  const before = sectionRowCounts(patternRows, startCount);
  // Resolve the tapped cell back to a group; rows can change underneath a stale selection.
  const selectedGroup = selected
    ? (rows[selected.rowIndex]?.stitches[selected.groupIndex] ?? null)
    : null;

  const updateRow = (i: number, patch: Partial<EditRow>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const updateGroup = (ri: number, gi: number, patch: Partial<EditGroup>) =>
    setRows((rs) =>
      rs.map((r, idx) =>
        idx === ri
          ? { ...r, stitches: r.stitches.map((g, gx) => (gx === gi ? { ...g, ...patch } : g)) }
          : r,
      ),
    );

  const addRow = () => {
    const nr: EditRow = {
      id: uid('r'),
      label: '',
      side: rows.length % 2 === 0 ? 'RS' : 'WS',
      marker: false,
      instruction: '',
      stitches: [{ id: uid('g'), type: 'knit', span: 'all', count: '', materialSlot: null, note: '' }],
    };
    setRows((rs) => [...rs, nr]);
    setExpanded((e) => ({ ...e, [nr.id]: true }));
  };

  const save = () => {
    if (!pattern) return;
    savePattern(id, {
      ...pattern,
      sections: pattern.sections.map((s, idx) =>
        idx === sectionIndex
          ? { ...s, description, castOn: startCount, rows: patternRows }
          : s,
      ),
    });
    goBackOr(router, `/pattern/${id}`);
  };

  // The pattern or section can be missing (deep link, or deleted in another tab).
  if (!pattern || !section) return null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="title">{section.name}</ThemedText>
          <ThemedText type="small" themeColor="inkSoft">
            {pattern.name} · stitch-by-stitch
          </ThemedText>

          {/* The written instruction this section was set up with — the source the stitches are
              charted from, so it stays visible right above the chart. */}
          <View style={styles.field}>
            <ThemedText type="smallBold" themeColor="inkSoft">
              Pattern text
            </ThemedText>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Write or paste this section's instructions…"
              placeholderTextColor={Colors.inkSoft}
              multiline
              style={[styles.input, styles.patternText]}
            />
          </View>

          <FormField
            label="Cast on (stitches to start from)"
            value={castOn}
            onChangeText={setCastOn}
            keyboardType="numeric"
            placeholder="0"
          />

          {rows.length === 0 && (
            <ThemedText type="small" themeColor="inkSoft">
              No rows yet. Add the first row to build the stitch-by-stitch overview.
            </ThemedText>
          )}

          {rows.length > 0 && (
            <Card style={styles.chartCard}>
              <ThemedText type="smallBold">Chart</ThemedText>
              <ThemedText type="small" themeColor="inkSoft">
                Read bottom-up, stitches right-to-left. Shaded rows are worked from the wrong side.
                Tap a stitch to edit it.
              </ThemedText>
              <StitchChart
                rows={patternRows}
                castOn={startCount}
                selected={selected}
                onSelectStitch={setSelected}
              />

              {selectedGroup && selected && (
                <View style={styles.selPanel}>
                  <View style={styles.selHead}>
                    <ThemedText type="smallBold">
                      Row {selected.rowIndex + 1} · stitch {selected.groupIndex + 1}
                    </ThemedText>
                    <Pressable hitSlop={8} onPress={() => setSelected(null)}>
                      <ThemedText type="smallBold" themeColor="inkSoft">
                        Done
                      </ThemedText>
                    </Pressable>
                  </View>
                  {/* A stitch marker belongs to the row, so it is settable from here too. */}
                  <View style={styles.inline}>
                    <SideToggle
                      value={rows[selected.rowIndex].side}
                      onChange={(v) => updateRow(selected.rowIndex, { side: v })}
                    />
                    <Pressable
                      onPress={() =>
                        updateRow(selected.rowIndex, { marker: !rows[selected.rowIndex].marker })
                      }
                      style={[styles.chip, rows[selected.rowIndex].marker && styles.chipOn]}>
                      <ThemedText
                        type="smallBold"
                        themeColor={rows[selected.rowIndex].marker ? 'white' : 'inkSoft'}>
                        📍 Marker on row {selected.rowIndex + 1}
                      </ThemedText>
                    </Pressable>
                  </View>
                  <GroupFields
                    group={selectedGroup}
                    onChange={(patch) => updateGroup(selected.rowIndex, selected.groupIndex, patch)}
                    onRemove={() => {
                      const target = rows[selected.rowIndex];
                      updateRow(selected.rowIndex, {
                        stitches: target.stitches.filter((_, x) => x !== selected.groupIndex),
                      });
                      setSelected(null);
                    }}
                  />
                </View>
              )}
            </Card>
          )}

          {rows.map((row, ri) => {
            const after = rowStitchesAfter(patternRows[ri], before[ri]);
            const delta = after - before[ri];
            const isOpen = expanded[row.id];
            return (
              <Card key={row.id} style={styles.rowCard}>
                <Pressable
                  style={styles.rowHead}
                  onPress={() => setExpanded((e) => ({ ...e, [row.id]: !e[row.id] }))}>
                  <View style={styles.rowHeadMain}>
                    <ThemedText type="smallBold" themeColor="inkSoft">
                      {isOpen ? '▾' : '▸'}
                    </ThemedText>
                    <View style={styles.grow}>
                      <ThemedText type="smallBold">
                        Row {ri + 1} · {row.side}
                        {row.marker ? '  📍' : ''}
                      </ThemedText>
                      <ThemedText type="small" themeColor="inkSoft" numberOfLines={1}>
                        {row.stitches.map(groupLabel).join(', ') || 'No stitches'}
                      </ThemedText>
                    </View>
                    <ThemedText type="smallBold" themeColor="sageDeep">
                      {after} sts{delta ? ` (${delta > 0 ? '+' : ''}${delta})` : ''}
                    </ThemedText>
                  </View>
                </Pressable>

                {isOpen && (
                  <View style={styles.rowBody}>
                    <View style={styles.inline}>
                      <SideToggle value={row.side} onChange={(v) => updateRow(ri, { side: v })} />
                      <Pressable
                        onPress={() => updateRow(ri, { marker: !row.marker })}
                        style={[styles.chip, row.marker && styles.chipOn]}>
                        <ThemedText type="smallBold" themeColor={row.marker ? 'white' : 'inkSoft'}>
                          📍 Marker
                        </ThemedText>
                      </Pressable>
                    </View>

                    <FormField
                      label="Instruction (optional)"
                      value={row.instruction}
                      onChangeText={(v) => updateRow(ri, { instruction: v })}
                      placeholder="e.g. K1, M1L, knit to last st, M1R, K1."
                    />

                    <ThemedText type="smallBold" themeColor="inkSoft">
                      Stitches
                    </ThemedText>
                    {row.stitches.map((g, gi) => (
                      <GroupFields
                        key={g.id}
                        group={g}
                        onChange={(patch) => updateGroup(ri, gi, patch)}
                        onRemove={() =>
                          updateRow(ri, { stitches: row.stitches.filter((_, x) => x !== gi) })
                        }
                      />
                    ))}
                    <Pressable
                      hitSlop={6}
                      style={styles.addLink}
                      onPress={() =>
                        updateRow(ri, {
                          stitches: [
                            ...row.stitches,
                            { id: uid('g'), type: 'knit', span: 'all', count: '', materialSlot: null, note: '' },
                          ],
                        })
                      }>
                      <ThemedText type="smallBold" themeColor="blushDeep">
                        + Add stitch
                      </ThemedText>
                    </Pressable>

                    <Pressable
                      hitSlop={6}
                      style={styles.addLink}
                      onPress={() => setRows((rs) => rs.filter((_, x) => x !== ri))}>
                      <ThemedText type="smallBold" themeColor="coralDeep">
                        Remove row
                      </ThemedText>
                    </Pressable>
                  </View>
                )}
              </Card>
            );
          })}

          <PillButton variant="secondary" style={styles.addRowBtn} onPress={addRow}>
            <ThemedText type="smallBold" themeColor="ink">
              + Add row
            </ThemedText>
          </PillButton>

          <PillButton style={styles.saveBtn} onPress={save}>
            <ThemedText type="smallBold" themeColor="white">
              Save stitches
            </ThemedText>
          </PillButton>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

// The editable controls for one stitch group — shared by the expanded row list and the
// tap-a-cell-in-the-chart editor, so both always offer exactly the same fields.
function GroupFields({
  group,
  onChange,
  onRemove,
}: {
  group: EditGroup;
  onChange: (patch: Partial<EditGroup>) => void;
  onRemove?: () => void;
}) {
  return (
    <View style={styles.groupCard}>
      <SelectField
        label="Stitch"
        options={STITCH_OPTIONS}
        value={group.type}
        onChange={(v) => onChange({ type: v })}
      />
      <View style={styles.inline}>
        {SPANS.map((sp) => (
          <Pressable
            key={sp.value}
            onPress={() => onChange({ span: sp.value })}
            style={[styles.chip, group.span === sp.value && styles.chipOn]}>
            <ThemedText type="smallBold" themeColor={group.span === sp.value ? 'white' : 'inkSoft'}>
              {sp.label}
            </ThemedText>
          </Pressable>
        ))}
        {group.span !== 'all' && (
          <TextInput
            value={group.count}
            onChangeText={(v) => onChange({ count: v })}
            keyboardType="numeric"
            placeholder={group.span === 'to-last' ? 'leave' : 'count'}
            placeholderTextColor={Colors.inkSoft}
            style={[styles.input, styles.countInput]}
          />
        )}
      </View>
      <View style={styles.inline}>
        <TextInput
          value={group.note}
          onChangeText={(v) => onChange({ note: v })}
          placeholder="Note (optional)"
          placeholderTextColor={Colors.inkSoft}
          style={[styles.input, styles.grow]}
        />
        {onRemove && (
          <Pressable hitSlop={8} onPress={onRemove}>
            <ThemedText type="default" themeColor="inkSoft">
              ✕
            </ThemedText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function SideToggle({ value, onChange }: { value: StitchSide; onChange: (v: StitchSide) => void }) {
  return (
    <View style={styles.sideToggle}>
      {(['RS', 'WS'] as StitchSide[]).map((s) => (
        <Pressable
          key={s}
          onPress={() => onChange(s)}
          style={[styles.chip, value === s && styles.chipOn]}>
          <ThemedText type="smallBold" themeColor={value === s ? 'white' : 'inkSoft'}>
            {s}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  scrollContent: {
    padding: Spacing.four,
    paddingBottom: Spacing.six * 2,
    gap: Spacing.three,
  },
  chartCard: { gap: Spacing.two },
  selPanel: {
    gap: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: Colors.creamDeep,
    paddingTop: Spacing.three,
    marginTop: Spacing.one,
  },
  selHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowCard: { gap: Spacing.three },
  rowHead: { flexDirection: 'row' },
  rowHeadMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flex: 1,
  },
  rowBody: { gap: Spacing.three },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  sideToggle: { flexDirection: 'row', gap: Spacing.two },
  groupCard: {
    gap: Spacing.two,
    backgroundColor: Colors.cream,
    borderRadius: Radii.medium,
    padding: Spacing.three,
  },
  chip: {
    backgroundColor: Colors.creamDeep,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chipOn: { backgroundColor: Colors.blushDeep },
  input: {
    backgroundColor: Colors.white,
    borderRadius: Radii.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontFamily: Fonts.bodySemibold,
    fontSize: 15,
    color: Colors.ink,
  },
  countInput: { width: 90 },
  field: { gap: Spacing.one },
  patternText: { minHeight: 88, textAlignVertical: 'top' },
  grow: { flex: 1 },
  addLink: { alignSelf: 'flex-start', paddingVertical: Spacing.one },
  addRowBtn: { marginTop: Spacing.one },
  saveBtn: { marginTop: Spacing.two },
});
