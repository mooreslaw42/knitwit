import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GaugeField } from '@/components/gauge-field';
import { Card, FormField, PillButton, SelectField } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  CRAFT_LABELS,
  CRAFT_ORDER,
  toolSizeOptions,
} from '@/constants/catalogs';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { goBackOr } from '@/lib/navigation';
import { describeConversion, projectToPattern } from '@/lib/project-to-pattern';
import { useKnitwitStore } from '@/store/useKnitwitStore';
import type { Pattern, PatternCategory, PatternLevel, TechniqueCraft } from '@/types/knitwit';

const CATEGORY_OPTIONS: { value: PatternCategory; label: string }[] = CATEGORY_ORDER.map((c) => ({
  value: c,
  label: CATEGORY_LABELS[c],
}));

const CRAFT_OPTIONS: { value: TechniqueCraft; label: string }[] = CRAFT_ORDER.map((c) => ({
  value: c,
  label: CRAFT_LABELS[c],
}));

const LEVEL_OPTIONS: { value: PatternLevel; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'easy', label: 'Easy' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

export default function ProjectToPatternScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const router = useRouter();

  const project = useKnitwitStore((state) => state.projects[key]);
  const patterns = useKnitwitStore((state) => state.patterns);
  const materials = useKnitwitStore((state) => state.materials);
  const tools = useKnitwitStore((state) => state.tools);
  const techniques = useKnitwitStore((state) => state.techniques);
  const catalogue = useKnitwitStore((state) => state.catalogue);
  const savePatternFromProject = useKnitwitStore((state) => state.savePatternFromProject);

  const source = project?.patternId ? (patterns[project.patternId] ?? null) : null;

  // Converted once on arrival and then edited like any other draft. Recomputing it as the knitter
  // types would throw away every correction they'd made.
  const converted = useMemo(
    () => (project ? projectToPattern(project, { materials, tools, techniques, catalogue }, source) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the draft is seeded once, on purpose.
    [],
  );
  const [form, setForm] = useState<Pattern | null>(converted);
  const [nameTouched, setNameTouched] = useState(false);

  if (!project || !form) return null;

  const set = <K extends keyof Pattern>(field: K, value: Pattern[K]) =>
    setForm((f) => (f ? { ...f, [field]: value } : f));

  const nameMissing = !form.name.trim();

  const create = () => {
    if (nameMissing) {
      setNameTouched(true);
      return;
    }
    const id = savePatternFromProject(key, { ...form, name: form.name.trim() });
    // To the pattern rather than back to the project: the pattern is the new thing, and its
    // sections are what the knitter will want to check first.
    router.replace(`/pattern/${id}`);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="title">Save as pattern</ThemedText>
          <ThemedText type="small" themeColor="inkSoft">
            Everything {project.name} is made of becomes a pattern you can knit again — its
            sections, rows, yarn and needles. Your progress stays where it is; nothing about the
            project changes except that it will be linked to the new pattern.
          </ThemedText>

          <Card style={styles.summary}>
            <ThemedText type="smallBold">What comes across</ThemedText>
            <ThemedText type="small" themeColor="inkSoft">
              {describeConversion(form)}
            </ThemedText>
            {/* A pattern is written for one size — the one that was knitted. Saying so here stops
                it reading as a bug later when the size list has a single entry in it. */}
            <ThemedText type="small" themeColor="inkSoft">
              Saved as one size ({form.sizes[0]}), because that&apos;s the size you knitted.
            </ThemedText>
            {source ? (
              <ThemedText type="small" themeColor="inkSoft">
                Wording and techniques are carried over from {source.name}. The project will be
                linked to this new pattern instead.
              </ThemedText>
            ) : null}
          </Card>

          <FormField
            label="Pattern name"
            value={form.name}
            onChangeText={(v) => set('name', v)}
            placeholder="e.g. Meadow Cardigan"
          />
          {nameTouched && nameMissing && (
            <ThemedText type="small" themeColor="coralDeep">
              A name is needed to save the pattern.
            </ThemedText>
          )}
          <SelectField
            label="Craft"
            options={CRAFT_OPTIONS}
            value={form.craft}
            onChange={(v) => set('craft', v)}
          />
          {/* The one thing a project has no answer for: it was never categorised. Sitting at the
              top of the list rather than guessed from the name. */}
          <SelectField
            label="Category"
            options={CATEGORY_OPTIONS}
            value={form.category}
            onChange={(v) => set('category', v)}
          />
          <SelectField
            label="Difficulty"
            options={LEVEL_OPTIONS}
            value={form.level}
            onChange={(v) => set('level', v)}
          />
          <SelectField
            label="Needle / hook size"
            options={toolSizeOptions(form.needleSize, form.craft)}
            value={form.needleSize}
            onChange={(v) => set('needleSize', v)}
          />
          <GaugeField
            value={form.gauge}
            onChange={(g) => set('gauge', g)}
            hint="The gauge you actually knitted this at — that's what anyone knitting the pattern needs to match."
          />

          <View style={styles.actions}>
            <PillButton onPress={create}>
              <ThemedText type="smallBold" themeColor="white">
                Create pattern
              </ThemedText>
            </PillButton>
            <PillButton variant="secondary" onPress={() => goBackOr(router, `/project/${key}`)}>
              <ThemedText type="smallBold" themeColor="ink">
                Cancel
              </ThemedText>
            </PillButton>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
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
  summary: { gap: Spacing.one },
  actions: { gap: Spacing.two, marginTop: Spacing.two },
});
