import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, DeleteButton, FormField, PillButton, SelectField } from '@/components/knitwit-ui';
import { PatternKitEditor, PatternSectionsEditor } from '@/components/pattern-section-editor';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  SIZE_OPTIONS,
  TOOL_TYPE_LABELS,
} from '@/constants/catalogs';
import { Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { patternSectionMarkers } from '@/lib/knitwit-helpers';
import { goBackOr } from '@/lib/navigation';
import { pickImage, pickImageMessage } from '@/lib/pick-image';
import { useKnitwitStore } from '@/store/useKnitwitStore';
import type { Pattern, PatternCategory, PatternLevel } from '@/types/knitwit';

const CATEGORY_OPTIONS: { value: PatternCategory; label: string }[] = CATEGORY_ORDER.map((c) => ({
  value: c,
  label: CATEGORY_LABELS[c],
}));

const LEVEL_OPTIONS: { value: PatternLevel; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'easy', label: 'Easy' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

export default function PatternDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const pattern = useKnitwitStore((state) => state.patterns[id]);
  const savePattern = useKnitwitStore((state) => state.savePattern);
  const deletePattern = useKnitwitStore((state) => state.deletePattern);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Pattern | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // The colour swatch at the top doubles as the photo well while editing.
  const choosePhoto = async () => {
    const result = await pickImage();
    if (result.status === 'picked') {
      setDraft((d) => (d ? { ...d, photo: result.dataUrl } : d));
      setPhotoError(null);
    } else {
      setPhotoError(pickImageMessage(result.status));
    }
  };

  if (!pattern) return null;

  const startEditing = () => {
    setDraft({ ...pattern });
    setEditing(true);
  };
  const cancelEditing = () => {
    setDraft(null);
    setEditing(false);
  };
  const commit = () => {
    if (draft) savePattern(id, { ...draft, name: draft.name.trim() || pattern.name });
    setDraft(null);
    setEditing(false);
  };

  const set = <K extends keyof Pattern>(key: K, value: Pattern[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  const toggleSize = (size: string) =>
    setDraft((d) => {
      if (!d) return d;
      const next = d.sizes.includes(size)
        ? d.sizes.filter((s) => s !== size)
        : [...d.sizes, size];
      return { ...d, sizes: SIZE_OPTIONS.filter((s) => next.includes(s)) };
    });

  const view = editing && draft ? draft : pattern;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {editing ? (
            <>
              <Pressable
                onPress={choosePhoto}
                style={[styles.hero, styles.heroPress, { backgroundColor: view.accentColor }]}>
                {view.photo ? (
                  <Image source={{ uri: view.photo }} style={styles.heroPhoto} />
                ) : null}
                <View style={styles.heroHint}>
                  <ThemedText type="smallBold" themeColor="ink">
                    {view.photo ? 'Tap to change picture' : 'Tap to add a picture'}
                  </ThemedText>
                </View>
              </Pressable>
              {view.photo && (
                <Pressable
                  hitSlop={6}
                  style={styles.photoClear}
                  onPress={() => setDraft((d) => (d ? { ...d, photo: null } : d))}>
                  <ThemedText type="smallBold" themeColor="coralDeep">
                    Remove picture
                  </ThemedText>
                </Pressable>
              )}
              {photoError && (
                <ThemedText type="small" themeColor="coralDeep">
                  {photoError}
                </ThemedText>
              )}
            </>
          ) : (
            <View style={[styles.hero, { backgroundColor: view.accentColor }]}>
              {view.photo ? (
                <Image source={{ uri: view.photo }} style={styles.heroPhoto} />
              ) : null}
            </View>
          )}

          <View style={styles.titleRow}>
            <ThemedText type="title" style={styles.grow}>
              {view.name}
            </ThemedText>
            {!editing && (
              <Pressable hitSlop={8} onPress={startEditing}>
                <ThemedText type="smallBold" themeColor="blushDeep">
                  Edit
                </ThemedText>
              </Pressable>
            )}
          </View>

          {editing && draft ? (
            <>
              <FormField
                label="Pattern name"
                value={draft.name}
                onChangeText={(v) => set('name', v)}
                placeholder="e.g. Meadow Cardigan"
              />
              <SelectField
                label="Category"
                options={CATEGORY_OPTIONS}
                value={draft.category}
                onChange={(v) => set('category', v)}
              />
              <SelectField
                label="Difficulty"
                options={LEVEL_OPTIONS}
                value={draft.level}
                onChange={(v) => set('level', v)}
              />
              <View style={styles.field}>
                <ThemedText type="smallBold" themeColor="inkSoft">
                  Sizes
                </ThemedText>
                <View style={styles.chipRow}>
                  {SIZE_OPTIONS.map((size) => {
                    const on = draft.sizes.includes(size);
                    return (
                      <Pressable
                        key={size}
                        onPress={() => toggleSize(size)}
                        style={[styles.chip, on && styles.chipOn]}>
                        <ThemedText type="smallBold" themeColor={on ? 'white' : 'inkSoft'}>
                          {size}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <FormField
                label="Needle / hook size"
                value={draft.needleSize}
                onChangeText={(v) => set('needleSize', v)}
                placeholder="e.g. 4.5mm"
              />
              <FormField
                label="Stitches / 10cm"
                value={draft.gaugeStitches}
                onChangeText={(v) => set('gaugeStitches', v)}
                keyboardType="numeric"
                placeholder="22"
              />
              <FormField
                label="Rows / 10cm"
                value={draft.gaugeRows}
                onChangeText={(v) => set('gaugeRows', v)}
                keyboardType="numeric"
                placeholder="30"
              />
              <FormField
                label="Instruction video (optional)"
                value={draft.video}
                onChangeText={(v) => set('video', v)}
                placeholder="https://…"
              />

              <ThemedText type="subtitle" style={styles.blockTitle}>
                Yarn, tools &amp; techniques
              </ThemedText>
              <PatternKitEditor
                initial={{
                  materials: draft.materials,
                  tools: draft.tools,
                  techniques: draft.techniques,
                }}
                onChange={(kit) =>
                  setDraft((d) =>
                    d
                      ? {
                          ...d,
                          materials: kit.materials,
                          tools: kit.tools,
                          techniques: kit.techniques,
                        }
                      : d,
                  )
                }
              />

              <ThemedText type="subtitle" style={styles.blockTitle}>
                Sections
              </ThemedText>
              <ThemedText type="small" themeColor="inkSoft">
                Stitch charts are edited from each section on the overview.
              </ThemedText>
              <PatternSectionsEditor
                initial={draft.sections}
                materials={draft.materials}
                tools={draft.tools}
                techniques={draft.techniques}
                onChange={(sections) => set('sections', sections)}
              />

              <PillButton style={styles.saveBtn} onPress={commit}>
                <ThemedText type="smallBold" themeColor="white">
                  Save pattern
                </ThemedText>
              </PillButton>
              <PillButton variant="secondary" onPress={cancelEditing}>
                <ThemedText type="smallBold" themeColor="ink">
                  Cancel
                </ThemedText>
              </PillButton>
            </>
          ) : (
            <>
              <Field label="Category" value={CATEGORY_LABELS[pattern.category]} />
              <Field
                label="Difficulty"
                value={LEVEL_OPTIONS.find((l) => l.value === pattern.level)?.label ?? pattern.level}
              />
              <Field label="Sizes" value={pattern.sizes.join(', ')} />
              <Field label="Needle / hook size" value={pattern.needleSize || pattern.weight} />
              <Field
                label="Gauge"
                value={
                  pattern.gaugeStitches || pattern.gaugeRows
                    ? `${pattern.gaugeStitches || '?'}×${pattern.gaugeRows || '?'} sts/rows · 10cm`
                    : ''
                }
              />
              <Field label="Instruction video" value={pattern.video} />
              <Field label="Imported file" value={pattern.sourceName} />
              <Field label="Imported text" value={pattern.sourceText} numberOfLines={4} />

              <Field
                label="Yarn"
                value={pattern.materials
                  .map((m) => `${m.short ? `${m.short} · ` : ''}${m.label}`)
                  .join('\n')}
              />
              <Field
                label="Tools"
                value={pattern.tools
                  .map((t) =>
                    [t.thickness, TOOL_TYPE_LABELS[t.type], t.note].filter(Boolean).join(' · '),
                  )
                  .join('\n')}
              />
              <Field
                label="Techniques"
                value={pattern.techniques
                  .map((t) => (t.note ? `${t.name} — ${t.note}` : t.name))
                  .join('\n')}
              />

              <ThemedText type="subtitle" style={styles.blockTitle}>
                Sections
              </ThemedText>
              {pattern.sections.length === 0 ? (
                <ThemedText type="small" themeColor="inkSoft">
                  This pattern has no sections.
                </ThemedText>
              ) : (
                <View style={styles.sectionsList}>
                  {pattern.sections.map((s, i) => {
                    const markers = patternSectionMarkers(s);
                    const meta = [
                      s.rows.length > 0 ? `${s.rows.length} rows charted` : 'No stitches yet',
                      `from ${s.castOn} sts`,
                      markers.length ? `${markers.length} markers` : '',
                    ]
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <Pressable
                        key={s.name + i}
                        style={styles.secRow}
                        onPress={() => router.push(`/pattern/${id}/section/${i}`)}>
                        <View style={styles.grow}>
                          <ThemedText type="smallBold">{s.name}</ThemedText>
                          <ThemedText type="small" themeColor="inkSoft">
                            {meta}
                          </ThemedText>
                        </View>
                        <ThemedText type="default" themeColor="inkSoft">
                          ›
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              <DeleteButton
                onPress={() => {
                  deletePattern(id);
                  goBackOr(router, '/library');
                }}
              />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

// A read-only row; hidden entirely when the pattern never set this field.
function Field({
  label,
  value,
  numberOfLines,
}: {
  label: string;
  value: string;
  numberOfLines?: number;
}) {
  if (!value) return null;
  return (
    <Card style={styles.fieldCard}>
      <ThemedText type="small" themeColor="inkSoft">
        {label}
      </ThemedText>
      <ThemedText type="smallBold" numberOfLines={numberOfLines}>
        {value}
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  scrollContent: {
    padding: Spacing.four,
    paddingBottom: Spacing.six * 2,
    gap: Spacing.two,
  },
  hero: {
    height: 120,
    borderRadius: Radii.large,
    marginBottom: Spacing.two,
    overflow: 'hidden',
  },
  heroPress: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPhoto: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  heroHint: {
    backgroundColor: Colors.cream,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  photoClear: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  fieldCard: { gap: 2 },
  field: { gap: Spacing.one },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    backgroundColor: Colors.creamDeep,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chipOn: { backgroundColor: Colors.blushDeep },
  blockTitle: { marginTop: Spacing.three },
  sectionsList: { gap: Spacing.two },
  secRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: Colors.white,
    borderRadius: Radii.medium,
    padding: Spacing.three,
  },
  grow: { flex: 1, gap: 2 },
  saveBtn: { marginTop: Spacing.three },
});
