import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormField, PillButton, SelectField } from '@/components/knitwit-ui';
import { DateField } from '@/components/date-field';
import { GaugeField } from '@/components/gauge-field';
import {
  blankSection,
  ProjectSectionsEditor,
  type DraftSection,
} from '@/components/project-sections-editor';
import { EMPTY_KIT, SectionKitEditor, type SectionKit } from '@/components/stash-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  CRAFT_LABELS,
  CRAFT_ORDER,
  TOOL_TYPE_LABELS,
  describeToolSize,
  scaleForToolType,
} from '@/constants/catalogs';
import { Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';

import { localDate } from '@/lib/achievements';
import { goBackOr } from '@/lib/navigation';
import { categoryFromName } from '@/lib/project-to-pattern';
import { LabelField } from '@/components/label-field';
import { labelsInUse } from '@/lib/labels';
import { formatGaugeIn, isUsableGauge, stitchRatio } from '@/lib/gauge';
import type { Gauge, PatternCategory, TechniqueCraft } from '@/types/knitwit';
import { useKnitwitStore } from '@/store/useKnitwitStore';

type StepId = 'basics' | 'pattern' | 'match' | 'kit' | 'plan';

const CRAFT_OPTIONS: { value: TechniqueCraft; label: string }[] = CRAFT_ORDER.map((c) => ({
  value: c,
  label: CRAFT_LABELS[c],
}));

const CATEGORY_OPTIONS: { value: PatternCategory; label: string }[] = CATEGORY_ORDER.map((c) => ({
  value: c,
  label: CATEGORY_LABELS[c],
}));

export default function NewProjectWizardScreen() {
  const router = useRouter();
  const patterns = useKnitwitStore((state) => state.patterns);
  const projects = useKnitwitStore((state) => state.projects);
  const materials = useKnitwitStore((state) => state.materials);
  const tools = useKnitwitStore((state) => state.tools);
  const createProject = useKnitwitStore((state) => state.createProject);
  const setActiveSection = useKnitwitStore((state) => state.setActiveSection);

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [startedOn, setStartedOn] = useState<string | null>(localDate());
  const [craft, setCraft] = useState<TechniqueCraft>('knit');
  // Read off the name until the knitter says otherwise, the same guess createProject would make —
  // just made where they can see and correct it rather than behind their back.
  const [category, setCategory] = useState<PatternCategory>('sweaters');
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [labels, setLabels] = useState<string[]>([]);
  const [patternId, setPatternId] = useState<string | null>(null);
  // Picking a pattern moves the craft to match it — a project usually is whatever its pattern is,
  // and the selector stays there for the cases where it isn't.
  const [craftTouched, setCraftTouched] = useState(false);
  const [totalRows, setTotalRows] = useState('60');
  const [nameTouched, setNameTouched] = useState(false);
  // Chosen mappings from the pattern's generic slots to the user's own stash.
  const [slotMaterials, setSlotMaterials] = useState<Record<string, string>>({});
  const [slotTools, setSlotTools] = useState<Record<string, string>>({});
  // Which of the pattern's sizes this project is knitted in; every per-size number resolves to it.
  const [sizeIndex, setSizeIndex] = useState(0);
  // Defaults to whatever swatch was recorded on the pattern, so a knitter who already swatched
  // doesn't type it twice. Null means "work it at the pattern's gauge".
  const [swatchGauge, setSwatchGauge] = useState<Gauge | null>(null);
  // The improvise path: what the whole project is made of, and the pieces it's knitted in. A
  // pattern supplies both, so these only come into play when there isn't one.
  const [kit, setKit] = useState<SectionKit>(EMPTY_KIT);
  const [draftSections, setDraftSections] = useState<DraftSection[]>([blankSection(EMPTY_KIT)]);
  const unit = useKnitwitStore((state) => state.settings.gaugeUnit);

  const selectedPattern = patternId ? patterns[patternId] : null;
  const patternMaterials = selectedPattern?.materials ?? [];
  const patternTools = selectedPattern?.tools ?? [];
  const inheritedSections = selectedPattern?.sections ?? [];
  const hasSlots = patternMaterials.length + patternTools.length > 0;
  const hasSections = inheritedSections.length > 0;

  // The stash-matching step only exists when the chosen pattern actually names yarn or tools, and
  // the final step is either the inherited-section review or the manual row count.
  const improvising = patternId === null;

  // A pattern brings its own yarn slots and its own sections, so those steps ask about matching
  // and reviewing. Improvising, there is nothing to match or review — the same two questions have
  // to be answered from scratch, which is what the pattern wizard's Materials and Sections steps
  // do and what these mirror.
  const steps: { id: StepId; label: string }[] = [
    { id: 'basics', label: 'Basics' },
    { id: 'pattern', label: 'Pattern' },
    ...(improvising
      ? [{ id: 'kit' as const, label: 'Yarn & tools' }]
      : hasSlots
        ? [{ id: 'match' as const, label: 'Materials' }]
        : []),
    { id: 'plan', label: hasSections || improvising ? 'Sections' : 'Rows' },
  ];
  const current = steps[step] ?? steps[steps.length - 1];
  // A plain statement of what accepting this will do, before it is done.
  const previewRatio =
    selectedPattern?.gauge && swatchGauge ? stitchRatio(selectedPattern.gauge, swatchGauge) : null;
  const regaugeNote =
    previewRatio == null
      ? ''
      : Math.abs(previewRatio - 1) < 0.0005
        ? 'That matches the pattern — nothing will change.'
        : `Stitch counts will be scaled by ×${Math.round(previewRatio * 1000) / 1000}. Row counts stay as written; work to the measurement.`;

  const isLast = step === steps.length - 1;

  // The original refuses to leave the first step without a name, since an unnamed project is
  // impossible to find again in the list.
  const nameMissing = current.id === 'basics' && !name.trim();

  const choosePattern = (id: string | null) => {
    if (id === patternId) return;
    setPatternId(id);
    // Follow the pattern's craft unless the knitter has already chosen one themselves — a project
    // usually is whatever its pattern is, but overriding it is a real case (a crocheted edging).
    if (!craftTouched && id) {
      const pattern = patterns[id];
      if (pattern) setCraft(pattern.craft);
    }
    // The old mappings belonged to a different pattern's slots — clear them.
    setSlotMaterials({});
    setSlotTools({});
    setSizeIndex(0);
  };

  // Sections follow the project's kit until the knitter narrows one by hand. Keyed off that flag
  // rather than off an empty kit, which was wrong: the first pick filled the section in, and
  // every pick after it then looked like a deliberate choice and was skipped.
  const chooseKit = (next: SectionKit) => {
    setKit(next);
    setDraftSections((prev) => prev.map((s) => (s.kitTouched ? s : { ...s, ...next })));
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
      label: `${describeToolSize(t.thickness, scaleForToolType(t.type))} · ${TOOL_TYPE_LABELS[t.type]} · ${t.length}`,
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
      startedOn,
      craft,
      patternId,
      totalRows: Math.max(1, parseInt(totalRows, 10) || 60),
      category,
      labels,
      sizeIndex,
      swatchGauge,
      slotMaterials,
      slotTools,
      sections: improvising
        ? draftSections.map((d) => ({
            name: d.name,
            totalRows: parseInt(d.totalRows, 10) || 60,
            description: d.description,
            materialIds: d.materialIds,
            toolIds: d.toolIds,
            techniqueIds: d.techniqueIds,
          }))
        : [],
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
                onChangeText={(v) => {
                  setName(v);
                  if (!categoryTouched) setCategory(categoryFromName(v));
                }}
                placeholder="e.g. Summer Tee"
              />
              {nameTouched && nameMissing && (
                <ThemedText type="small" themeColor="coralDeep">
                  A name is needed to save the project.
                </ThemedText>
              )}
              <DateField
                label="Started"
                value={startedOn}
                onChange={setStartedOn}
              />
              <SelectField
                label="Craft"
                options={CRAFT_OPTIONS}
                value={craft}
                onChange={(v) => {
                  setCraft(v);
                  setCraftTouched(true);
                }}
              />
              <SelectField
                label="Category"
                options={CATEGORY_OPTIONS}
                value={category}
                onChange={(v) => {
                  setCategory(v);
                  setCategoryTouched(true);
                }}
              />
              <LabelField
                value={labels}
                suggestions={labelsInUse(Object.values(projects))}
                onChange={setLabels}
                hint="Optional. Group this with others — a gift list, a year, a yarn you're using up."
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
                      {describeToolSize(slot.thickness, scaleForToolType(slot.type))} ·{' '}
                      {TOOL_TYPE_LABELS[slot.type]}
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

          {current.id === 'kit' && (
            <>
              <ThemedText type="subtitle">What are you making it with?</ThemedText>
              <ThemedText type="small" themeColor="inkSoft">
                Pick from your library. Anything you choose here is offered on each section in the
                next step — leave it empty if you&apos;d rather decide as you go.
              </ThemedText>
              <SectionKitEditor value={kit} onChange={chooseKit} />
            </>
          )}

          {current.id === 'plan' && (selectedPattern?.sizes.length ?? 0) > 1 && (
            <View style={styles.field}>
              <ThemedText type="smallBold" themeColor="inkSoft">
                Which size are you making?
              </ThemedText>
              <View style={styles.chipRow}>
                {selectedPattern?.sizes.map((label, i) => (
                  <Pressable
                    key={label + i}
                    onPress={() => setSizeIndex(i)}
                    style={[styles.chip, sizeIndex === i && styles.chipOn]}>
                    <ThemedText type="smallBold" themeColor={sizeIndex === i ? 'white' : 'inkSoft'}>
                      {label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Offered only when the pattern states a gauge — without one there is nothing to
              compare against, and asking would imply otherwise. */}
          {current.id === 'plan' && isUsableGauge(selectedPattern?.gauge) && (
            <View style={styles.field}>
              <GaugeField
                label="Your swatch (optional)"
                hint={`The pattern is written for ${formatGaugeIn(selectedPattern?.gauge, unit)}. If your swatch differs, Knitwit works out this project's stitch counts at your gauge instead — the pattern itself is left alone.`}
                value={swatchGauge}
                onChange={setSwatchGauge}
              />
              {regaugeNote ? (
                <ThemedText type="small" themeColor="sageDeep">
                  {regaugeNote}
                </ThemedText>
              ) : null}
            </View>
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
            ) : improvising ? (
              <>
                <ThemedText type="subtitle">Break it into sections</ThemedText>
                <ThemedText type="small" themeColor="inkSoft">
                  The parts you knit one at a time — a body, a sleeve, a collar — each with its own
                  row count and timer. One is plenty if you just want to count.
                </ThemedText>
                <ProjectSectionsEditor
                  sections={draftSections}
                  kit={kit}
                  onChange={setDraftSections}
                />
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
  field: { gap: Spacing.one },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    backgroundColor: Colors.creamDeep,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chipOn: { backgroundColor: Colors.blushDeep },
});
