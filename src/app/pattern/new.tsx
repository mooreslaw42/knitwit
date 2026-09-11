import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormField, PillButton, SelectField } from '@/components/knitwit-ui';
import { PatternKitEditor, PatternSectionsEditor } from '@/components/pattern-section-editor';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { goBackOr } from '@/lib/navigation';
import { pickImage, pickImageMessage } from '@/lib/pick-image';
import { CATEGORY_LABELS, CATEGORY_ORDER, SIZE_OPTIONS } from '@/constants/catalogs';
import { Colors, Fonts, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { useKnitwitStore } from '@/store/useKnitwitStore';
import type { Pattern, PatternCategory, PatternLevel } from '@/types/knitwit';

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
    weight: '',
    needleSize: '',
    video: '',
    // Auto-assigned so the library grid stays varied without asking the user to pick.
    accentColor: ACCENT_SWATCHES[Math.floor(Math.random() * ACCENT_SWATCHES.length)],
    photo: null,
    gaugeStitches: '',
    gaugeRows: '',
    favorited: false,
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

export default function NewPatternWizardScreen() {
  const router = useRouter();
  const savePattern = useKnitwitStore((state) => state.savePattern);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Pattern>(blankPattern);
  const [nameTouched, setNameTouched] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const choosePhoto = async () => {
    const result = await pickImage();
    if (result.status === 'picked') {
      setForm((f) => ({ ...f, photo: result.dataUrl }));
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

  const pickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: false });
    const file = res.assets?.[0];
    if (!file) return; // cancelled
    set('sourceName', file.name);
  };

  const skipImport = () => {
    // Nothing to carry forward — clear anything captured and move on to the manual details.
    setForm((f) => ({ ...f, sourceName: '', sourceText: '' }));
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
              <ThemedText type="subtitle">Have a pattern already?</ThemedText>
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
                    {form.sourceName ? `📄 ${form.sourceName}` : 'Choose a file…'}
                  </ThemedText>
                </Pressable>
              </View>
              <View style={styles.field}>
                <ThemedText type="smallBold" themeColor="inkSoft">
                  Or paste the pattern text
                </ThemedText>
                <TextInput
                  value={form.sourceText}
                  onChangeText={(v) => set('sourceText', v)}
                  placeholder="Paste the pattern here…"
                  placeholderTextColor={Colors.inkSoft}
                  multiline
                  style={styles.pasteBox}
                />
              </View>
              <PillButton variant="secondary" style={styles.skipBtn} onPress={skipImport}>
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
                    <Image source={{ uri: form.photo }} style={styles.photoPreview} />
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
              <FormField
                label="Needle / hook size"
                value={form.needleSize}
                onChangeText={(v) => set('needleSize', v)}
                placeholder="e.g. 4.5mm"
              />
              <FormField
                label="Stitches / 10cm"
                value={form.gaugeStitches}
                onChangeText={(v) => set('gaugeStitches', v)}
                keyboardType="numeric"
                placeholder="22"
              />
              <FormField
                label="Rows / 10cm"
                value={form.gaugeRows}
                onChangeText={(v) => set('gaugeRows', v)}
                keyboardType="numeric"
                placeholder="30"
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
