import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Card, FormField, PillButton, SelectField } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { TOOL_TYPE_LABELS } from '@/constants/catalogs';
import { Colors, Fonts, Radii, Spacing } from '@/constants/theme';
import type {
  PatternMaterial,
  PatternRow,
  PatternSection,
  PatternTechnique,
  PatternTool,
  ToolType,
} from '@/types/knitwit';

// A pattern is authored independently of anyone's stash: it names generic yarn/tool slots and the
// techniques it calls for, and its sections reference the yarn/tool slots. A project resolves the
// slots to the user's own materials/tools when it is created.
//
// The editors keep their own draft in string form so half-typed numbers ("", "1"…) never
// round-trip through a parsed number and reappear as "0" mid-keystroke. `expanded` is UI-only
// (it collapses a finished entry to a summary) and is stripped from the data pushed up.

// Client-side ids for freshly added slots/notes. Unique within a pattern is all that's needed.
let nextId = 1;
const uid = (prefix: string) => `${prefix}${nextId++}`;

const TOOL_TYPE_OPTIONS = (Object.entries(TOOL_TYPE_LABELS) as [ToolType, string][]).map(
  ([value, label]) => ({ value, label }),
);

const shortForIndex = (i: number) => String.fromCharCode(65 + (i % 26));

// ---------- Yarn / tools / techniques editor ----------

type EditMaterial = { id: string; label: string; short: string; expanded: boolean };
type EditTool = { id: string; type: ToolType; thickness: string; note: string; expanded: boolean };
type EditTechnique = { id: string; name: string; note: string; expanded: boolean };

export type PatternKit = {
  materials: PatternMaterial[];
  tools: PatternTool[];
  techniques: PatternTechnique[];
};

type EditKit = {
  materials: EditMaterial[];
  tools: EditTool[];
  techniques: EditTechnique[];
};

function kitToEdit(kit: PatternKit): EditKit {
  return {
    materials: kit.materials.map((m) => ({ ...m, expanded: false })),
    tools: kit.tools.map((t) => ({ ...t, expanded: false })),
    techniques: kit.techniques.map((t) => ({ ...t, expanded: false })),
  };
}

function kitToPattern(kit: EditKit): PatternKit {
  return {
    materials: kit.materials.map((m) => ({
      id: m.id,
      label: m.label.trim() || 'Yarn',
      short: m.short.trim(),
    })),
    tools: kit.tools.map((t) => ({
      id: t.id,
      type: t.type,
      thickness: t.thickness.trim(),
      note: t.note.trim(),
    })),
    techniques: kit.techniques.map((t) => ({
      id: t.id,
      name: t.name.trim() || 'Technique',
      note: t.note.trim(),
    })),
  };
}

export function PatternKitEditor({
  initial,
  onChange,
}: {
  initial: PatternKit;
  onChange: (kit: PatternKit) => void;
}) {
  const [kit, setKit] = useState<EditKit>(() => kitToEdit(initial));

  const commit = (next: EditKit) => {
    setKit(next);
    onChange(kitToPattern(next));
  };

  const updateMaterial = (i: number, patch: Partial<EditMaterial>) =>
    commit({ ...kit, materials: kit.materials.map((m, idx) => (idx === i ? { ...m, ...patch } : m)) });
  const updateTool = (i: number, patch: Partial<EditTool>) =>
    commit({ ...kit, tools: kit.tools.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) });
  const updateTechnique = (i: number, patch: Partial<EditTechnique>) =>
    commit({
      ...kit,
      techniques: kit.techniques.map((t, idx) => (idx === i ? { ...t, ...patch } : t)),
    });

  return (
    <View style={styles.wrap}>
      {/* Yarn */}
      <View style={styles.group}>
        <ThemedText type="smallBold">Yarn the pattern calls for</ThemedText>
        <ThemedText type="small" themeColor="inkSoft">
          Describe each colour generically — the knitter matches these to their own stash later.
        </ThemedText>
        {kit.materials.map((m, i) => (
          <EntryCard
            key={m.id}
            expanded={m.expanded}
            summary={`${m.short || shortForIndex(i)} · ${m.label || 'New yarn'}`}
            onToggle={() => updateMaterial(i, { expanded: !m.expanded })}
            onRemove={() => commit({ ...kit, materials: kit.materials.filter((_, idx) => idx !== i) })}>
            <FormField
              label="Colour name"
              value={m.label}
              onChangeText={(v) => updateMaterial(i, { label: v })}
              placeholder="e.g. Main colour, Contrast"
            />
            <FormField
              label="Tag"
              value={m.short}
              onChangeText={(v) => updateMaterial(i, { short: v })}
              placeholder="A"
            />
          </EntryCard>
        ))}
        <AddLink
          label="+ Add yarn"
          onPress={() =>
            commit({
              ...kit,
              materials: [
                ...kit.materials,
                { id: uid('ms'), label: '', short: shortForIndex(kit.materials.length), expanded: true },
              ],
            })
          }
        />
      </View>

      {/* Tools */}
      <View style={styles.group}>
        <ThemedText type="smallBold">Tools the pattern calls for</ThemedText>
        {kit.tools.map((t, i) => (
          <EntryCard
            key={t.id}
            expanded={t.expanded}
            summary={`${TOOL_TYPE_LABELS[t.type]}${t.thickness ? ` · ${t.thickness}` : ''}${t.note ? ` · ${t.note}` : ''}`}
            onToggle={() => updateTool(i, { expanded: !t.expanded })}
            onRemove={() => commit({ ...kit, tools: kit.tools.filter((_, idx) => idx !== i) })}>
            <SelectField
              label="Type"
              options={TOOL_TYPE_OPTIONS}
              value={t.type}
              onChange={(v) => updateTool(i, { type: v })}
            />
            <FormField
              label="Size"
              value={t.thickness}
              onChangeText={(v) => updateTool(i, { thickness: v })}
              placeholder="e.g. 4.5mm"
            />
            <FormField
              label="Note"
              value={t.note}
              onChangeText={(v) => updateTool(i, { note: v })}
              placeholder="e.g. US 7"
            />
          </EntryCard>
        ))}
        <AddLink
          label="+ Add tool"
          onPress={() =>
            commit({
              ...kit,
              tools: [
                ...kit.tools,
                { id: uid('ts'), type: 'circular', thickness: '', note: '', expanded: true },
              ],
            })
          }
        />
      </View>

      {/* Techniques */}
      <View style={styles.group}>
        <ThemedText type="smallBold">Techniques the pattern uses</ThemedText>
        {kit.techniques.map((t, i) => (
          <EntryCard
            key={t.id}
            expanded={t.expanded}
            summary={t.name || 'New technique'}
            onToggle={() => updateTechnique(i, { expanded: !t.expanded })}
            onRemove={() =>
              commit({ ...kit, techniques: kit.techniques.filter((_, idx) => idx !== i) })
            }>
            <FormField
              label="Name"
              value={t.name}
              onChangeText={(v) => updateTechnique(i, { name: v })}
              placeholder="e.g. Kitchener stitch"
            />
            <FormField
              label="Note"
              value={t.note}
              onChangeText={(v) => updateTechnique(i, { note: v })}
              placeholder="When it's used, things to remember…"
            />
          </EntryCard>
        ))}
        <AddLink
          label="+ Add technique"
          onPress={() =>
            commit({
              ...kit,
              techniques: [...kit.techniques, { id: uid('pte'), name: '', note: '', expanded: true }],
            })
          }
        />
      </View>
    </View>
  );
}

// ---------- Sections editor ----------

type EditNote = { id: number; row: string; text: string };
type EditSection = {
  name: string;
  totalRows: string;
  castOn: number;
  materials: string[]; // slot ids
  tools: string[]; // slot ids
  techniques: string[]; // technique ids
  description: string;
  // The structured stitch rows are carried through untouched here — they are authored/parsed and
  // edited on the dedicated stitch editor (Phase 3); this editor must not drop them on save.
  rows: PatternRow[];
  notes: EditNote[];
  markers: string[];
};

function sectionToEdit(s: PatternSection): EditSection {
  return {
    name: s.name,
    totalRows: s.totalRows ? String(s.totalRows) : '',
    castOn: s.castOn ?? 0,
    materials: [...s.materials],
    tools: [...s.tools],
    techniques: [...(s.techniques ?? [])],
    description: s.description ?? '',
    rows: s.rows ?? [],
    notes: s.notes.map((n) => ({ id: n.id, row: n.row ? String(n.row) : '', text: n.text })),
    markers: s.markers.map((m) => String(m)),
  };
}

function sectionToPattern(s: EditSection): PatternSection {
  return {
    name: s.name.trim() || 'Section',
    totalRows: Math.max(1, parseInt(s.totalRows, 10) || 1),
    castOn: s.castOn,
    materials: [...s.materials],
    tools: [...s.tools],
    techniques: [...s.techniques],
    description: s.description,
    rows: s.rows,
    notes: s.notes
      .filter((n) => n.text.trim())
      .map((n) => ({ id: n.id, row: Math.max(0, parseInt(n.row, 10) || 0), text: n.text.trim() })),
    markers: Array.from(
      new Set(s.markers.map((m) => parseInt(m, 10)).filter((m) => Number.isFinite(m) && m > 0)),
    ).sort((a, b) => a - b),
  };
}

const BLANK_SECTION: EditSection = {
  name: '',
  totalRows: '',
  castOn: 0,
  materials: [],
  tools: [],
  techniques: [],
  description: '',
  rows: [],
  notes: [],
  markers: [],
};

export function PatternSectionsEditor({
  initial,
  materials,
  tools,
  techniques,
  onChange,
}: {
  initial: PatternSection[];
  materials: PatternMaterial[];
  tools: PatternTool[];
  techniques: PatternTechnique[];
  onChange: (sections: PatternSection[]) => void;
}) {
  const [sections, setSections] = useState<EditSection[]>(() => initial.map(sectionToEdit));

  const commit = (next: EditSection[]) => {
    setSections(next);
    onChange(next.map(sectionToPattern));
  };
  const updateSection = (i: number, patch: Partial<EditSection>) =>
    commit(sections.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  return (
    <View style={styles.wrap}>
      {sections.length === 0 && (
        <ThemedText type="small" themeColor="inkSoft">
          No sections yet — add one below, or leave this empty to plan sections later.
        </ThemedText>
      )}

      {sections.map((section, i) => (
        <Card key={i} style={styles.entryCard}>
          <View style={styles.entryHeader}>
            <ThemedText type="smallBold">Section {i + 1}</ThemedText>
            <Pressable
              hitSlop={8}
              onPress={() => commit(sections.filter((_, idx) => idx !== i))}>
              <ThemedText type="smallBold" themeColor="coralDeep">
                Remove
              </ThemedText>
            </Pressable>
          </View>

          <FormField
            label="Section name"
            value={section.name}
            onChangeText={(v) => updateSection(i, { name: v })}
            placeholder="e.g. Body, Left sleeve"
          />
          <FormField
            label="Rows"
            value={section.totalRows}
            onChangeText={(v) => updateSection(i, { totalRows: v })}
            keyboardType="numeric"
            placeholder="60"
          />

          <View style={styles.field}>
            <ThemedText type="smallBold" themeColor="inkSoft">
              Pattern text
            </ThemedText>
            <ThemedText type="small" themeColor="inkSoft">
              Write or paste this section&apos;s instructions. We&apos;ll turn this into a
              stitch-by-stitch view you can edit and count from — coming soon.
            </ThemedText>
            <TextInput
              value={section.description}
              onChangeText={(v) => updateSection(i, { description: v })}
              placeholder="e.g. Row 1 (RS): K2, *yo, k2tog; rep from * to last 2 sts, k2."
              placeholderTextColor={Colors.inkSoft}
              multiline
              style={[styles.input, styles.patternText]}
            />
          </View>

          {materials.length > 0 && (
            <View style={styles.field}>
              <ThemedText type="smallBold" themeColor="inkSoft">
                Uses yarn
              </ThemedText>
              <View style={styles.chipRow}>
                {materials.map((m) => {
                  const on = section.materials.includes(m.id);
                  return (
                    <Pressable
                      key={m.id}
                      onPress={() =>
                        updateSection(i, {
                          materials: on
                            ? section.materials.filter((x) => x !== m.id)
                            : [...section.materials, m.id],
                        })
                      }
                      style={[styles.chip, on && styles.chipOn]}>
                      <ThemedText type="smallBold" themeColor={on ? 'white' : 'inkSoft'}>
                        {(m.short || '•') + ' · ' + (m.label || 'Yarn')}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {tools.length > 0 && (
            <View style={styles.field}>
              <ThemedText type="smallBold" themeColor="inkSoft">
                Uses tools
              </ThemedText>
              <View style={styles.chipRow}>
                {tools.map((t) => {
                  const on = section.tools.includes(t.id);
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() =>
                        updateSection(i, {
                          tools: on
                            ? section.tools.filter((x) => x !== t.id)
                            : [...section.tools, t.id],
                        })
                      }
                      style={[styles.chip, on && styles.chipOn]}>
                      <ThemedText type="smallBold" themeColor={on ? 'white' : 'inkSoft'}>
                        {t.thickness || TOOL_TYPE_LABELS[t.type]}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {techniques.length > 0 && (
            <View style={styles.field}>
              <ThemedText type="smallBold" themeColor="inkSoft">
                Uses techniques
              </ThemedText>
              <View style={styles.chipRow}>
                {techniques.map((t) => {
                  const on = section.techniques.includes(t.id);
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() =>
                        updateSection(i, {
                          techniques: on
                            ? section.techniques.filter((x) => x !== t.id)
                            : [...section.techniques, t.id],
                        })
                      }
                      style={[styles.chip, on && styles.chipOn]}>
                      <ThemedText type="smallBold" themeColor={on ? 'white' : 'inkSoft'}>
                        {t.name || 'Technique'}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          <View style={styles.subGroup}>
            <ThemedText type="smallBold" themeColor="inkSoft">
              Notes
            </ThemedText>
            {section.notes.map((note, ni) => (
              <View key={note.id} style={styles.rowLine}>
                <TextInput
                  value={note.row}
                  onChangeText={(v) =>
                    updateSection(i, {
                      notes: section.notes.map((n, idx) => (idx === ni ? { ...n, row: v } : n)),
                    })
                  }
                  keyboardType="numeric"
                  placeholder="Row"
                  placeholderTextColor={Colors.inkSoft}
                  style={[styles.input, styles.rowNumInput]}
                />
                <TextInput
                  value={note.text}
                  onChangeText={(v) =>
                    updateSection(i, {
                      notes: section.notes.map((n, idx) => (idx === ni ? { ...n, text: v } : n)),
                    })
                  }
                  placeholder="What to remember at this row"
                  placeholderTextColor={Colors.inkSoft}
                  style={[styles.input, styles.grow]}
                />
                <Pressable
                  hitSlop={8}
                  onPress={() =>
                    updateSection(i, { notes: section.notes.filter((_, idx) => idx !== ni) })
                  }>
                  <ThemedText type="default" themeColor="inkSoft">
                    ✕
                  </ThemedText>
                </Pressable>
              </View>
            ))}
            <AddLink
              label="+ Add note"
              onPress={() =>
                updateSection(i, { notes: [...section.notes, { id: nextId++, row: '', text: '' }] })
              }
            />
          </View>

          <View style={styles.subGroup}>
            <ThemedText type="smallBold" themeColor="inkSoft">
              Stitch markers
            </ThemedText>
            <ThemedText type="small" themeColor="inkSoft">
              Rows where the counter should prompt you to place a marker.
            </ThemedText>
            {section.markers.map((marker, mi) => (
              <View key={mi} style={styles.rowLine}>
                <TextInput
                  value={marker}
                  onChangeText={(v) =>
                    updateSection(i, {
                      markers: section.markers.map((m, idx) => (idx === mi ? v : m)),
                    })
                  }
                  keyboardType="numeric"
                  placeholder="Row"
                  placeholderTextColor={Colors.inkSoft}
                  style={[styles.input, styles.rowNumInput]}
                />
                <Pressable
                  hitSlop={8}
                  onPress={() =>
                    updateSection(i, { markers: section.markers.filter((_, idx) => idx !== mi) })
                  }>
                  <ThemedText type="default" themeColor="inkSoft">
                    ✕
                  </ThemedText>
                </Pressable>
              </View>
            ))}
            <AddLink
              label="+ Add marker"
              onPress={() => updateSection(i, { markers: [...section.markers, ''] })}
            />
          </View>
        </Card>
      ))}

      <PillButton
        variant="secondary"
        style={styles.addSectionBtn}
        onPress={() => commit([...sections, { ...BLANK_SECTION }])}>
        <ThemedText type="smallBold" themeColor="ink">
          + Add section
        </ThemedText>
      </PillButton>
    </View>
  );
}

// ---------- Shared bits ----------

function EntryCard({
  expanded,
  summary,
  onToggle,
  onRemove,
  children,
}: {
  expanded: boolean;
  summary: string;
  onToggle: () => void;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card style={styles.entryCard}>
      <View style={styles.entryHeader}>
        <Pressable style={styles.entryHeaderMain} hitSlop={6} onPress={onToggle}>
          <ThemedText type="smallBold" themeColor="inkSoft">
            {expanded ? '▾' : '▸'}
          </ThemedText>
          <ThemedText type="smallBold" numberOfLines={1} style={styles.grow}>
            {summary}
          </ThemedText>
        </Pressable>
        <Pressable hitSlop={8} onPress={onRemove}>
          <ThemedText type="smallBold" themeColor="coralDeep">
            Remove
          </ThemedText>
        </Pressable>
      </View>
      {expanded && children}
    </Card>
  );
}

function AddLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable hitSlop={6} onPress={onPress} style={styles.addLink}>
      <ThemedText type="smallBold" themeColor="blushDeep">
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.four,
  },
  group: {
    gap: Spacing.two,
  },
  entryCard: {
    gap: Spacing.three,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  entryHeaderMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flex: 1,
  },
  subGroup: {
    gap: Spacing.two,
  },
  field: {
    gap: Spacing.one,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    backgroundColor: Colors.creamDeep,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chipOn: {
    backgroundColor: Colors.blushDeep,
  },
  rowLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  input: {
    backgroundColor: Colors.cream,
    borderRadius: Radii.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontFamily: Fonts.bodySemibold,
    fontSize: 15,
    color: Colors.ink,
  },
  rowNumInput: {
    width: 72,
  },
  patternText: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  grow: {
    flex: 1,
  },
  addLink: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  addSectionBtn: {
    marginTop: Spacing.one,
  },
});
