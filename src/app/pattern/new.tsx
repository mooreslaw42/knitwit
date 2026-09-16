import { useRouter } from 'expo-router';
import { putPhoto } from '@/lib/photo-store';
import { PhotoImage } from '@/components/photo';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AutoGrowInput } from '@/components/auto-grow-input';
import { Card, FormField, PillButton, SelectField } from '@/components/knitwit-ui';
import { PatternKitEditor, PatternSectionsEditor } from '@/components/pattern-section-editor';
import { GaugeField } from '@/components/gauge-field';
import { ThemedText } from '@/components/themed-text';
import { usePageTitle } from '@/lib/use-page-title';
import { ThemedView } from '@/components/themed-view';
import { EdgeFunctionAborted } from '@/lib/edge-function';
import { importPatternDocument, type ImportedPattern } from '@/lib/import-pattern-document';
import { goBackOr } from '@/lib/navigation';
import { pickImage, pickImageMessage } from '@/lib/pick-image';
import { pickPatternFile } from '@/lib/read-pattern-file';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  CRAFT_LABELS,
  CRAFT_ORDER,
  SIZE_OPTIONS,
  toolSizeOptions,
} from '@/constants/catalogs';
import { Colors, Fonts, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { useKnitwitStore } from '@/store/useKnitwitStore';
import type { Pattern, PatternCategory, PatternLevel, TechniqueCraft } from '@/types/knitwit';

const STEPS = ['Import', 'Basics', 'Gauge', 'Materials', 'Sections'] as const;

// The library colour-codes cards from this palette. There is no colour picker any more — a card
// colour is assigned automatically when the pattern is created, so the grid still reads as varied.
const ACCENT_SWATCHES = [
  Colors.blush,
  Colors.sage,
  Colors.lavender,
  Colors.coral,
  Colors.butter,
] as const;

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

function blankPattern(): Pattern {
  return {
    name: '',
    category: 'sweaters',
    craft: 'knit',
    weight: '',
    needleSize: '',
    video: '',
    // Auto-assigned so the library grid stays varied without asking the user to pick.
    accentColor: ACCENT_SWATCHES[Math.floor(Math.random() * ACCENT_SWATCHES.length)],
    photo: null,
    gauge: null,
    swatchGauge: null,
    favorited: false,
    notes: '',
    level: 'intermediate',
    sizes: [],
    sourceName: '',
    sourceText: '',
    materials: [],
    tools: [],
    techniques: [],
    sections: [],
  };
}

// "3 sections · 48 rows charted · 2 sizes · 1 yarn, 2 tools" — what was actually found, so the
// knitter can tell at a glance whether the read was any good before accepting it.
function describeImport(imported: ImportedPattern): string {
  const { pattern, summary } = imported;
  const parts = [
    `${summary.sections} ${summary.sections === 1 ? 'section' : 'sections'}`,
    `${summary.rowsCharted} ${summary.rowsCharted === 1 ? 'row' : 'rows'} charted`,
  ];
  if (pattern.sizes.length) parts.push(pattern.sizes.join(', '));
  if (pattern.materials.length) {
    parts.push(`${pattern.materials.length} ${pattern.materials.length === 1 ? 'yarn' : 'yarns'}`);
  }
  if (pattern.tools.length) {
    parts.push(`${pattern.tools.length} ${pattern.tools.length === 1 ? 'tool' : 'tools'}`);
  }
  if (pattern.techniques.length) parts.push(`${pattern.techniques.length} techniques`);
  return parts.join(' · ');
}

export default function NewPatternWizardScreen() {
  usePageTitle('New pattern');
  const router = useRouter();
  const savePattern = useKnitwitStore((state) => state.savePattern);
  const catalogue = useKnitwitStore((state) => state.catalogue);
  const loadCatalogue = useKnitwitStore((state) => state.loadCatalogue);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Pattern>(blankPattern);
  const [nameTouched, setNameTouched] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  // A pattern read from the source text, held for review — nothing is filled in until accepted.
  const [imported, setImported] = useState<ImportedPattern | null>(null);
  const [reading, setReading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [importError, setImportError] = useState<string | null>(null);
  // Held in a ref, not state: aborting must work from an unmount cleanup, which never sees a
  // re-render's state.
  const readRef = useRef<AbortController | null>(null);

  const choosePhoto = async () => {
    const result = await pickImage();
    if (result.status === 'picked') {
      setForm((f) => ({ ...f, photo: null }));
      // Bytes to their own key, id on the record. See photo-store.ts.
      void putPhoto(result.dataUrl).then((id) => setForm((f) => ({ ...f, photo: id })));
      setPhotoError(null);
    } else {
      setPhotoError(pickImageMessage(result.status));
    }
  };
  const set = <K extends keyof Pattern>(key: K, value: Pattern[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Toggle a size in or out, keeping the selection in catalogue order so it always reads
  // small-to-large regardless of the order it was tapped.
  const toggleSize = (size: string) =>
    setForm((f) => {
      const next = f.sizes.includes(size)
        ? f.sizes.filter((s) => s !== size)
        : [...f.sizes, size];
      return { ...f, sizes: SIZE_OPTIONS.filter((s) => next.includes(s)) };
    });

  const isLast = step === STEPS.length - 1;
  const nameMissing = STEPS[step] === 'Basics' && !form.name.trim();

  // Reading the file puts its text straight into the paste box, so the knitter can see exactly
  // what was picked up — a PDF whose text layer came out scrambled is obvious rather than silently
  // fed to the model.
  const pickFile = async () => {
    setFileError(null);
    const result = await pickPatternFile();
    if (result.status === 'cancelled') return;
    if (result.status === 'refused') {
      setFileError(result.message);
      set('sourceName', result.name);
      return;
    }
    setImported(null);
    setForm((f) => ({ ...f, sourceName: result.name, sourceText: result.text }));
  };

  const readPattern = async () => {
    const text = form.sourceText.trim();
    if (!text) return;
    const controller = new AbortController();
    readRef.current = controller;
    setReading(true);
    setImportError(null);
    setElapsed(0);
    try {
      setImported(
        await importPatternDocument(text, {
          signal: controller.signal,
          catalogue: Object.values(catalogue),
        }),
      );
    } catch (error) {
      // Stopping on purpose isn't a failure — leave the screen as it was rather than
      // reporting something went wrong.
      if (error instanceof EdgeFunctionAborted) return;
      setImportError(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      if (readRef.current === controller) readRef.current = null;
      setReading(false);
    }
  };

  // Leaving the screen has to actually stop the request: an abandoned read goes on costing money
  // until the call is aborted, and the draft it would have filled in is gone anyway.
  useEffect(() => {
    return () => readRef.current?.abort();
  }, []);

  // Wanted before the read finishes, so the techniques it names can be matched to real entries.
  useEffect(() => {
    void loadCatalogue();
  }, [loadCatalogue]);

  // A read of a long pattern runs well past a minute, so a spinner alone gives no way to tell
  // "working" from "stuck". The count is what makes that judgement possible.
  useEffect(() => {
    if (!reading) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [reading]);

  // Applying fills in the rest of the wizard, which the knitter then steps through and corrects.
  // The original text is kept either way, so a bad read is always re-runnable.
  const applyImport = () => {
    if (!imported) return;
    setForm((f) => ({ ...f, ...imported.pattern }));
    setImported(null);
    setStep((s) => s + 1);
  };

  const skipImport = () => {
    // Nothing to carry forward — clear anything captured and move on to the manual details.
    setForm((f) => ({ ...f, sourceName: '', sourceText: '' }));
    setImported(null);
    setStep((s) => s + 1);
  };

  const handleNext = () => {
    if (nameMissing) {
      setNameTouched(true);
      return;
    }
    if (!isLast) {
      setStep((s) => s + 1);
      return;
    }
    savePattern(null, {
      ...form,
      name: form.name.trim(),
      sizes: form.sizes.length ? form.sizes : ['One size'],
    });
    goBackOr(router, '/library');
  };

  const handleBack = () => {
    if (step > 0) setStep((s) => s - 1);
    else goBackOr(router, '/library');
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
              {STEPS.map((s, i) => (
                <View
                  key={s}
                  style={[styles.dot, i === step && styles.dotActive, i < step && styles.dotDone]}
                />
              ))}
            </View>
            <View style={styles.topbarSpacer} />
          </View>
          <ThemedText type="small" themeColor="inkSoft" style={styles.caption}>
            Step {step + 1} of {STEPS.length} · {STEPS[step]}
          </ThemedText>

          {STEPS[step] === 'Import' && (
            <>
              <ThemedText type="subtitle" heading={1}>Have a pattern already?</ThemedText>
              <ThemedText type="small" themeColor="inkSoft">
                Upload it or paste it in to keep the original with your pattern. Otherwise just skip
                — you can fill in the details yourself.
              </ThemedText>
              <View style={styles.field}>
                <ThemedText type="smallBold" themeColor="inkSoft">
                  Upload a file
                </ThemedText>
                <Pressable style={styles.uploadBtn} onPress={pickFile}>
                  <ThemedText type="smallBold" themeColor="inkSoft" numberOfLines={1}>
                    {form.sourceName ? `📄 ${form.sourceName}` : 'Choose a PDF or text file…'}
                  </ThemedText>
                </Pressable>
                {fileError && (
                  <ThemedText type="small" themeColor="coralDeep">
                    {fileError}
                  </ThemedText>
                )}
              </View>
              <View style={styles.field}>
                <ThemedText type="smallBold" themeColor="inkSoft">
                  Or paste the pattern text
                </ThemedText>
                <AutoGrowInput
                  value={form.sourceText}
                  onChangeText={(v) => {
                    set('sourceText', v);
                    setImported(null);
                  }}
                  placeholder="Paste the pattern here…"
                  minHeight={72}
                  style={styles.pasteBox}
                />
              </View>

              {form.sourceText.trim().length > 0 && !imported && (
                <View style={styles.field}>
                  <View style={styles.inline}>
                    <PillButton style={styles.readBtn} loading={reading} onPress={readPattern}>
                      <ThemedText type="smallBold" themeColor="white">
                        {reading
                          ? `Reading the pattern… ${elapsed}s`
                          : 'Read this pattern for me'}
                      </ThemedText>
                    </PillButton>
                    {/* A long pattern runs past a minute, so stopping has to be possible without
                        abandoning the whole wizard. */}
                    {reading && (
                      <PillButton
                        variant="secondary"
                        style={styles.readBtn}
                        onPress={() => readRef.current?.abort()}>
                        <ThemedText type="smallBold" themeColor="ink">
                          Stop
                        </ThemedText>
                      </PillButton>
                    )}
                  </View>
                  <ThemedText type="small" themeColor="inkSoft">
                    {reading
                      ? 'A long pattern can take a couple of minutes. Stopping — or leaving this screen — cancels it.'
                      : 'Fills in the rest of these steps — sizes, yarn, tools, techniques and sections. You review everything before it’s saved.'}
                  </ThemedText>
                  {importError && (
                    <ThemedText type="small" themeColor="coralDeep">
                      {importError}
                    </ThemedText>
                  )}
                </View>
              )}

              {imported && (
                <Card style={styles.importCard}>
                  <ThemedText type="smallBold">
                    {imported.pattern.name || 'Untitled pattern'}
                  </ThemedText>
                  <ThemedText type="small" themeColor="inkSoft">
                    {describeImport(imported)}
                  </ThemedText>
                  {imported.summary.rowsUnparsed > 0 && (
                    <ThemedText type="small" themeColor="inkSoft">
                      {imported.summary.rowsUnparsed}{' '}
                      {imported.summary.rowsUnparsed === 1 ? 'row was' : 'rows were'} too irregular
                      to chart — open the section afterwards to read{' '}
                      {imported.summary.rowsUnparsed === 1 ? 'it' : 'them'} with AI.
                    </ThemedText>
                  )}
                  {/* Per-size runs that don't line up with the size list mean every number in the
                      pattern is attributed to the wrong size — worth saying out loud, because it
                      looks right on the page. */}
                  {imported.warnings.map((w, i) => (
                    <ThemedText key={i} type="small" themeColor="coralDeep">
                      ⚠ {w}
                    </ThemedText>
                  ))}
                  {imported.notes ? (
                    <ThemedText type="small" themeColor="coralDeep">
                      {imported.notes}
                    </ThemedText>
                  ) : null}
                  <View style={styles.importActions}>
                    <PillButton style={styles.grow} onPress={applyImport}>
                      <ThemedText type="smallBold" themeColor="white">
                        Use this
                      </ThemedText>
                    </PillButton>
                    <PillButton
                      variant="secondary"
                      style={styles.grow}
                      onPress={() => setImported(null)}>
                      <ThemedText type="smallBold" themeColor="ink">
                        Discard
                      </ThemedText>
                    </PillButton>
                  </View>
                </Card>
              )}

              <PillButton
                variant="secondary"
                style={styles.skipBtn}
                disabled={reading}
                onPress={skipImport}>
                <ThemedText type="smallBold" themeColor="ink">
                  Skip
                </ThemedText>
              </PillButton>
            </>
          )}

          {STEPS[step] === 'Basics' && (
            <>
              <ThemedText type="subtitle">What is the pattern?</ThemedText>
              <ThemedText type="small" themeColor="inkSoft">
                Give it a name so you can find it in the library.
              </ThemedText>
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
              <View style={styles.field}>
                <ThemedText type="smallBold" themeColor="inkSoft">
                  Sizes
                </ThemedText>
                <View style={styles.sizeRow}>
                  {SIZE_OPTIONS.map((size) => {
                    const selected = form.sizes.includes(size);
                    return (
                      <Pressable
                        key={size}
                        onPress={() => toggleSize(size)}
                        style={[styles.sizeChip, selected && styles.sizeChipActive]}>
                        <ThemedText type="smallBold" themeColor={selected ? 'white' : 'inkSoft'}>
                          {size}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <FormField
                label="Instruction video (optional)"
                value={form.video}
                onChangeText={(v) => set('video', v)}
                placeholder="https://…"
              />
              <View style={styles.field}>
                <ThemedText type="smallBold" themeColor="inkSoft">
                  Picture (optional)
                </ThemedText>
                <Pressable onPress={choosePhoto} style={styles.photoPick}>
                  {form.photo ? (
                    <PhotoImage photo={form.photo} style={styles.photoPreview} />
                  ) : (
                    <ThemedText type="smallBold" themeColor="inkSoft">
                      + Add a picture
                    </ThemedText>
                  )}
                </Pressable>
                {form.photo && (
                  <Pressable onPress={() => set('photo', null)} hitSlop={6} style={styles.photoClear}>
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
              </View>
            </>
          )}

          {STEPS[step] === 'Gauge' && (
            <>
              <ThemedText type="subtitle">What gauge does it call for?</ThemedText>
              <ThemedText type="small" themeColor="inkSoft">
                This is what you&apos;ll check a swatch against before casting on.
              </ThemedText>
              <SelectField
                label="Needle / hook size"
                options={toolSizeOptions(form.needleSize, form.craft)}
                value={form.needleSize}
                onChange={(v) => set('needleSize', v)}
              />
              <GaugeField
                value={form.gauge}
                onChange={(g) => set('gauge', g)}
                hint="Measure your swatch over the window the pattern uses — they are not interchangeable."
              />
            </>
          )}

          {STEPS[step] === 'Materials' && (
            <>
              <ThemedText type="subtitle">Yarn, tools & techniques</ThemedText>
              <ThemedText type="small" themeColor="inkSoft">
                Name what the pattern needs generically. A project made from it matches the yarn and
                tools to its own stash.
              </ThemedText>
              <PatternKitEditor
                initial={{
                  materials: form.materials,
                  tools: form.tools,
                  techniques: form.techniques,
                }}
                onChange={(kit) =>
                  setForm((f) => ({
                    ...f,
                    materials: kit.materials,
                    tools: kit.tools,
                    techniques: kit.techniques,
                  }))
                }
              />
            </>
          )}

          {STEPS[step] === 'Sections' && (
            <>
              <ThemedText type="subtitle">Break it into sections</ThemedText>
              <ThemedText type="small" themeColor="inkSoft">
                Plan the parts you knit one at a time — each with its rows, the yarn/tools it uses,
                notes and stitch markers. A project inherits these sections.
              </ThemedText>
              <PatternSectionsEditor
                craft={form.craft}
                initial={form.sections}
                materials={form.materials}
                tools={form.tools}
                techniques={form.techniques}
                onChange={(sections) => set('sections', sections)}
              />
            </>
          )}

          <PillButton style={styles.nextBtn} onPress={handleNext}>
            <ThemedText type="smallBold" themeColor="white">
              {isLast ? 'Save pattern' : STEPS[step] === 'Import' ? 'Continue' : 'Next'}
            </ThemedText>
          </PillButton>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
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
  field: {
    gap: Spacing.one,
  },
  uploadBtn: {
    backgroundColor: Colors.white,
    borderRadius: Radii.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  pasteBox: {
    backgroundColor: Colors.white,
    borderRadius: Radii.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontFamily: Fonts.bodySemibold,
    fontSize: 15,
    color: Colors.ink,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  readBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.four,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  importCard: {
    gap: Spacing.two,
  },
  importActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  grow: { flex: 1 },
  skipBtn: {
    marginTop: Spacing.one,
  },
  sizeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  sizeChip: {
    backgroundColor: Colors.creamDeep,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  sizeChipActive: {
    backgroundColor: Colors.blushDeep,
  },
  photoPick: {
    height: 140,
    borderRadius: Radii.medium,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  photoClear: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  nextBtn: {
    marginTop: Spacing.two,
  },
});
