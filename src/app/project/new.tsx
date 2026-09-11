import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormField, PillButton, SelectField } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CATEGORY_LABELS, TOOL_TYPE_LABELS } from '@/constants/catalogs';
import { Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { todayStarted } from '@/lib/knitwit-helpers';
import { goBackOr } from '@/lib/navigation';
import { useKnitwitStore } from '@/store/useKnitwitStore';

type StepId = 'basics' | 'pattern' | 'match' | 'plan';

export default function NewProjectWizardScreen() {
  const router = useRouter();
  const patterns = useKnitwitStore((state) => state.patterns);
  const materials = useKnitwitStore((state) => state.materials);
  const tools = useKnitwitStore((state) => state.tools);
  const createProject = useKnitwitStore((state) => state.createProject);
  const setActiveSection = useKnitwitStore((state) => state.setActiveSection);

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [started, setStarted] = useState(todayStarted());
  const [patternId, setPatternId] = useState<string | null>(null);
  const [totalRows, setTotalRows] = useState('60');
  const [nameTouched, setNameTouched] = useState(false);
  // Chosen mappings from the pattern's generic slots to the user's own stash.
  const [slotMaterials, setSlotMaterials] = useState<Record<string, string>>({});
  const [slotTools, setSlotTools] = useState<Record<string, string>>({});

  const selectedPattern = patternId ? patterns[patternId] : null;
  const patternMaterials = selectedPattern?.materials ?? [];
  const patternTools = selectedPattern?.tools ?? [];
  const inheritedSections = selectedPattern?.sections ?? [];
  const hasSlots = patternMaterials.length + patternTools.length > 0;
  const hasSections = inheritedSections.length > 0;

  // The stash-matching step only exists when the chosen pattern actually names yarn or tools, and
  // the final step is either the inherited-section review or the manual row count.
  const steps: { id: StepId; label: string }[] = [
    { id: 'basics', label: 'Basics' },
    { id: 'pattern', label: 'Pattern' },
    ...(hasSlots ? [{ id: 'match' as const, label: 'Materials' }] : []),
    { id: 'plan', label: hasSections ? 'Sections' : 'Rows' },
  ];
  const current = steps[step] ?? steps[steps.length - 1];
  const isLast = step === steps.length - 1;

  // The original refuses to leave the first step without a name, since an unnamed project is
  // impossible to find again in the list.
  const nameMissing = current.id === 'basics' && !name.trim();

  const choosePattern = (id: string | null) => {
    if (id === patternId) return;
    setPatternId(id);
    // The old mappings belonged to a different pattern's slots — clear them.
    setSlotMaterials({});
    setSlotTools({});
  };

  const setSlotMaterial = (slotId: string, value: string) =>
    setSlotMaterials((prev) => {
      const next = { ...prev };
      if (value) next[slotId] = value;
      else delete next[slotId];
      return next;
    });
  const setSlotTool = (slotId: string, value: string) =>
    setSlotTools((prev) => {
      const next = { ...prev };
      if (value) next[slotId] = value;
      else delete next[slotId];
      return next;
    });

  const materialOptions = [
    { value: '', label: '— choose from your stash —' },
    ...Object.entries(materials).map(([id, m]) => ({
      value: id,
      label: `${m.brand} — ${m.colorName}`,
    })),
  ];
  const toolOptions = [
    { value: '', label: '— choose from your stash —' },
    ...Object.entries(tools).map(([id, t]) => ({
      value: id,
      label: `${t.thickness} ${TOOL_TYPE_LABELS[t.type]} · ${t.length}`,
    })),
  ];

  const handleNext = () => {
    if (nameMissing) {
      setNameTouched(true);
      return;
    }
    if (!isLast) {
      setStep((s) => s + 1);
      return;
    }
    const key = createProject({
      name,
      started,
      patternId,
      totalRows: Math.max(1, parseInt(totalRows, 10) || 60),
      slotMaterials,
      slotTools,
    });
    setActiveSection(key, 0);
    router.replace(`/project/${key}`);
  };

  const handleBack = () => {
    if (step > 0) setStep((s) => s - 1);
    else goBackOr(router, '/');
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.topbar}>
            <Pressable onPress={handleBack} hitSlop={8}>
              <ThemedText type="default">←</ThemedText>
            </Pressable>
            <View style={styles.dots}>
              {steps.map((s, i) => (
                <View
                  key={s.id}
                  style={[styles.dot, i === step && styles.dotActive, i < step && styles.dotDone]}
                />
              ))}
            </View>
            <View style={styles.topbarSpacer} />
          </View>
          <ThemedText type="small" themeColor="inkSoft" style={styles.caption}>
            Step {step + 1} of {steps.length} · {current.label}
          </ThemedText>

          {current.id === 'basics' && (
            <>
              <ThemedText type="subtitle">What are you making?</ThemedText>
              <ThemedText type="small" themeColor="inkSoft">
                Give it a name so you can find it later.
              </ThemedText>
              <FormField
                label="Project name"
                value={name}
                onChangeText={setName}
                placeholder="e.g. Summer Tee"
              />
              {nameTouched && nameMissing && (
                <ThemedText type="small" themeColor="coralDeep">
                  A name is needed to save the project.
                </ThemedText>
              )}
              <FormField
                label="Started"
                value={started}
                onChangeText={setStarted}
                placeholder="e.g. Started Jun 14"
              />
            </>
          )}

          {current.id === 'pattern' && (
            <>
              <ThemedText type="subtitle">Working from a pattern?</ThemedText>
              <ThemedText type="small" themeColor="inkSoft">
                Linking one keeps its gauge and details with the project.
              </ThemedText>
              {Object.entries(patterns).map(([id, pattern]) => (
                <ChoiceCard
                  key={id}
                  swatch={pattern.accentColor}
                  title={pattern.name}
                  meta={`${CATEGORY_LABELS[pattern.category]}${
                    pattern.needleSize || pattern.weight
                      ? ` · ${pattern.needleSize || pattern.weight}`
                      : ''
                  }`}
                  selected={patternId === id}
                  onPress={() => choosePattern(id)}
                />
              ))}
              <ChoiceCard
                swatch={Colors.creamDeep}
                title="No pattern — I'll improvise"
                meta="Just count rows"
                selected={patternId === null}
                onPress={() => choosePattern(null)}
              />
            </>
          )}

          {current.id === 'match' && (
            <>
              <ThemedText type="subtitle">Match your stash</ThemedText>
              <ThemedText type="small" themeColor="inkSoft">
                {selectedPattern?.name} asks for these — pick which of your own yarn and tools to
                use. You can leave any unset for now.
              </ThemedText>
              {patternMaterials.map((slot) => (
                <View key={slot.id} style={styles.slotMap}>
                  <View style={styles.slotLabel}>
                    <View style={[styles.slotDot, { backgroundColor: Colors.creamDeep }]} />
                    <ThemedText type="smallBold">
                      {slot.short ? `${slot.short} · ${slot.label}` : slot.label}
                    </ThemedText>
                  </View>
                  <SelectField
                    label="Yarn"
                    options={materialOptions}
                    value={slotMaterials[slot.id] ?? ''}
                    onChange={(v) => setSlotMaterial(slot.id, v)}
                  />
                </View>
              ))}
              {patternTools.map((slot) => (
                <View key={slot.id} style={styles.slotMap}>
                  <View style={styles.slotLabel}>
                    <View style={[styles.slotDot, { backgroundColor: Colors.creamDeep }]} />
                    <ThemedText type="smallBold">
                      {slot.thickness} {TOOL_TYPE_LABELS[slot.type]}
                      {slot.note ? ` · ${slot.note}` : ''}
                    </ThemedText>
                  </View>
                  <SelectField
                    label="Tool"
                    options={toolOptions}
                    value={slotTools[slot.id] ?? ''}
                    onChange={(v) => setSlotTool(slot.id, v)}
                  />
                </View>
              ))}
            </>
          )}

          {current.id === 'plan' &&
            (hasSections ? (
              <>
                <ThemedText type="subtitle">Sections from the pattern</ThemedText>
                <ThemedText type="small" themeColor="inkSoft">
                  {selectedPattern?.name} brings its own sections — they&apos;ll be added ready to
                  count.
                </ThemedText>
                {inheritedSections.map((s, i) => (
                  <View key={s.name + i} style={styles.choiceCard}>
                    <View style={styles.choiceInfo}>
                      <ThemedText type="smallBold">{s.name}</ThemedText>
                      <ThemedText type="small" themeColor="inkSoft">
                        {s.totalRows} rows
                        {s.markers.length ? ` · ${s.markers.length} markers` : ''}
                      </ThemedText>
                    </View>
                  </View>
                ))}
              </>
            ) : (
              <>
                <ThemedText type="subtitle">How many rows?</ThemedText>
                <ThemedText type="small" themeColor="inkSoft">
                  This makes a single section you can count through.
                </ThemedText>
                <FormField
                  label="Target rows"
                  value={totalRows}
                  onChangeText={setTotalRows}
                  keyboardType="numeric"
                  placeholder="60"
                />
              </>
            ))}

          <PillButton style={styles.nextBtn} onPress={handleNext}>
            <ThemedText type="smallBold" themeColor="white">
              {isLast ? 'Save project' : 'Next'}
            </ThemedText>
          </PillButton>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function ChoiceCard({
  swatch,
  title,
  meta,
  selected,
  onPress,
}: {
  swatch: string;
  title: string;
  meta: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.choiceCard, selected && styles.choiceCardSelected]}>
      <View style={[styles.choiceSwatch, { backgroundColor: swatch }]} />
      <View style={styles.choiceInfo}>
        <ThemedText type="smallBold">{title}</ThemedText>
        <ThemedText type="small" themeColor="inkSoft">
          {meta}
        </ThemedText>
      </View>
      {selected && (
        <ThemedText type="smallBold" themeColor="sageDeep">
          ✓
        </ThemedText>
      )}
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
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topbarSpacer: {
    width: 20,
  },
  dots: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.creamDeep,
  },
  dotActive: {
    backgroundColor: Colors.blushDeep,
  },
  dotDone: {
    backgroundColor: Colors.sage,
  },
  caption: {
    textAlign: 'center',
  },
  choiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: Colors.white,
    borderRadius: Radii.medium,
    padding: Spacing.three,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  choiceCardSelected: {
    borderColor: Colors.sageDeep,
  },
  choiceSwatch: {
    width: 40,
    height: 40,
    borderRadius: Radii.small,
  },
  choiceInfo: {
    flex: 1,
    gap: 2,
  },
  slotMap: {
    gap: Spacing.two,
    backgroundColor: Colors.white,
    borderRadius: Radii.medium,
    padding: Spacing.three,
  },
  slotLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  slotDot: {
    width: 20,
    height: 20,
    borderRadius: Radii.small,
  },
  nextBtn: {
    marginTop: Spacing.two,
  },
});
