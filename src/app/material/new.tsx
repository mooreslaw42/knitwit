import { useRouter } from 'expo-router';
import { putPhoto } from '@/lib/photo-store';
import { PhotoImage } from '@/components/photo';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormField, PillButton, SelectField } from '@/components/knitwit-ui';
import { GaugeField } from '@/components/gauge-field';
import { ThemedText } from '@/components/themed-text';
import { usePageTitle } from '@/lib/use-page-title';
import { ThemedView } from '@/components/themed-view';
import { goBackOr } from '@/lib/navigation';
import { pickImage, pickImageMessage, takePhoto } from '@/lib/pick-image';
import { SourceBadge, type FieldSource } from '@/components/source-badge';
import {
  lookUpYarn,
  missingCount,
  missingFields,
  readYarnLabel,
} from '@/lib/read-yarn-label';
import { WASHING_LABELS, YARN_WEIGHTS,
  toolSizeOptions,
} from '@/constants/catalogs';
import { Colors, MaxContentWidth, MaxNameLength, Radii, Spacing } from '@/constants/theme';
import { useKnitwitStore } from '@/store/useKnitwitStore';
import type { CraftType, Material } from '@/types/knitwit';

const STEPS = ['Photo', 'Identity', 'Yarn', 'Care', 'Craft'] as const;

const BLANK: Material = {
  brand: '',
  colorName: '',
  colorLot: '',
  price: '',
  weight: '',
  grams: '',
  meters: '',
  composition: '',
  thickness: '',
  strands: '1',
  craftType: 'knit',
  washing: 'hand-wash',
  gauge: null,
  link: '',
  photo: null,
};

const CRAFT_OPTIONS: { value: CraftType; label: string }[] = [
  { value: 'knit', label: 'Knitting' },
  { value: 'crochet', label: 'Crochet' },
];

const WEIGHT_OPTIONS = [
  { value: '', label: 'Not set' },
  ...YARN_WEIGHTS.map((w) => ({ value: w.code, label: `${w.code} · ${w.label}` })),
];

const WASHING_OPTIONS = Object.entries(WASHING_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export default function NewMaterialWizardScreen() {
  usePageTitle('New yarn');
  const router = useRouter();
  const saveMaterial = useKnitwitStore((state) => state.saveMaterial);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Material>(BLANK);
  const [reading, setReading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  // Where each filled value came from, marked on the field itself rather than listed in prose
  // above the form. A knitter checking a prefilled form needs to know which parts are theirs at
  // the moment they look at each one, not in a summary four steps earlier.
  const [sources, setSources] = useState<Partial<Record<keyof Material, FieldSource>>>({});
  // Only for the messages that are about the whole attempt rather than any one field: a photo too
  // blurry to trust, or a yarn the search could not identify.
  const [unsure, setUnsure] = useState(false);
  const [noMatch, setNoMatch] = useState(false);
  const [matchedName, setMatchedName] = useState('');

  // The form as last committed, readable after an await.
  //
  // A search takes seconds, and in those seconds the knitter may type into the very field being
  // looked up — so the merge has to decide against the form as it is when the answer lands, not as
  // it was when the button was pressed. Reading `form` from the closure would use the older one.
  const formRef = useRef(form);
  useEffect(() => {
    formRef.current = form;
  }, [form]);

  // Photograph the band, read it, and drop whatever it says into the form. Everything stays
  // editable: this is a head start, not an answer.
  const scanLabel = async (source: 'camera' | 'library') => {
    setScanError(null);
    const picked = source === 'camera' ? await takePhoto() : await pickImage();
    if (picked.status !== 'picked') {
      setScanError(pickImageMessage(picked.status));
      return;
    }

    // The band is kept as the yarn's picture either way, so a scan that fails outright still
    // leaves the knitter better off than they started.
    void putPhoto(picked.dataUrl).then((id) => setForm((f) => ({ ...f, photo: id })));
    setReading(true);
    try {
      const result = await readYarnLabel(picked.dataUrl);
      setForm((f) => ({ ...f, ...result.values }));
      setSources((prev) => {
        const next = { ...prev };
        for (const key of result.filled) next[key] = 'band';
        return next;
      });
      setUnsure(!result.confident);
      setStep(1);
    } catch (error) {
      setScanError(
        error instanceof Error ? error.message : "Couldn't read that label. Try again, or type it in.",
      );
    } finally {
      setReading(false);
    }
  };
  // Fills the blanks the band left, from a web search. Never touches a field that already has
  // something in it, so a value read off the band cannot be argued with by a search result.
  const lookUp = async () => {
    setScanError(null);
    setLookingUp(true);
    try {
      const wanted = missingFields(form);
      const result = await lookUpYarn(form.brand, form.colorName, wanted);

      // Decided in one pass against the current form, so the values written and the fields marked
      // can never disagree. Working it out inside a setForm updater looked tidier and was wrong:
      // the updater runs later, so the list of what had been written was still empty by the time
      // the marks were set, and no web badge ever appeared.
      const latest = formRef.current;
      const merged = { ...latest };
      const written: (keyof Material)[] = [];
      for (const [key, value] of Object.entries(result.values) as [keyof Material, never][]) {
        // Blanks only, checked here as well as asked for there.
        const current = key === 'gauge' ? latest.gauge : String(latest[key] ?? '').trim();
        if (!current) {
          merged[key] = value;
          written.push(key);
        }
      }

      setForm(merged);
      // Only what was actually written gets marked. A field the search returned but the merge
      // skipped is the knitter's own, and badging it would be a lie.
      setSources((prev) => {
        const next = { ...prev };
        for (const key of written) next[key] = 'web';
        return next;
      });
      setNoMatch(!result.found);
      setMatchedName(result.matchedName);
    } catch (error) {
      setScanError(
        error instanceof Error ? error.message : "Couldn't look that yarn up. Fill the rest in yourself.",
      );
    } finally {
      setLookingUp(false);
    }
  };

  const set = <K extends keyof Material>(key: K, value: Material[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    // Typing over a value makes it the knitter's, so the mark saying where it came from goes.
    setSources((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // The mark for a field, or nothing when the knitter put the value there themselves.
  const badgeFor = (key: keyof Material) => {
    const source = sources[key];
    if (!source) return undefined;
    return (
      <SourceBadge
        source={source}
        detail={source === 'web' && matchedName ? `The search matched ${matchedName}.` : undefined}
      />
    );
  };

  const isLast = step === STEPS.length - 1;
  const stillMissing = missingCount(missingFields(form));

  const handleNext = () => {
    if (!isLast) {
      setStep((s) => s + 1);
      return;
    }
    saveMaterial(null, {
      ...form,
      brand: form.brand.trim() || 'Unbranded',
      colorName: form.colorName.trim() || 'Unnamed color',
    });
    goBackOr(router, '/library');
  };

  const handleBack = () => {
    if (step > 0) {
      setStep((s) => s - 1);
    } else {
      goBackOr(router, '/library');
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.topbar}>
          <Pressable onPress={handleBack} hitSlop={8}>
            <ThemedText type="default">←</ThemedText>
          </Pressable>
          <View style={styles.dots}>
            {STEPS.map((s, i) => (
              <View
                key={s}
                style={[
                  styles.dot,
                  i === step && styles.dotActive,
                  i < step && styles.dotDone,
                ]}
              />
            ))}
          </View>
          <View style={styles.topbarSpacer} />
        </View>
        <ThemedText type="small" themeColor="inkSoft" style={styles.caption}>
          Step {step + 1} of {STEPS.length} · {STEPS[step]}
        </ThemedText>

        <View style={styles.body}>
          {step === 0 && (
            <>
              <ThemedText type="subtitle">Start with the band?</ThemedText>
              <ThemedText type="small" themeColor="inkSoft">
                Photograph the ball band and Knitwit fills in what it says — brand, colour, dye lot,
                length, fibre, tension and care. You check it on the next steps. Or skip and type it
                in yourself.
              </ThemedText>

              {form.photo ? (
                <PhotoImage photo={form.photo} style={styles.preview} />
              ) : null}

              {reading ? (
                <View style={styles.readingRow}>
                  <ActivityIndicator color={Colors.blushDeep} />
                  <ThemedText type="small" themeColor="inkSoft">
                    Reading the band…
                  </ThemedText>
                </View>
              ) : (
                <>
                  <PillButton style={styles.scanBtn} onPress={() => void scanLabel('camera')}>
                    <ThemedText type="smallBold" themeColor="white">
                      Take a photo
                    </ThemedText>
                  </PillButton>
                  <Pressable
                    onPress={() => void scanLabel('library')}
                    hitSlop={6}
                    style={styles.scanAlt}>
                    <ThemedText type="smallBold" themeColor="sageDeep">
                      Choose a photo instead
                    </ThemedText>
                  </Pressable>
                </>
              )}

              {scanError ? (
                <ThemedText type="small" themeColor="coralDeep">
                  {scanError}
                </ThemedText>
              ) : null}
            </>
          )}

          {step === 1 && (
            <>
              <ThemedText type="subtitle">Which yarn is it?</ThemedText>
              {/* The badges beside each field say what came from where. This is only for the
                  thing no single field can say: that the photo as a whole was hard to read. */}
              {unsure ? (
                <View style={[styles.scanNote, styles.scanNoteUnsure]}>
                  <ThemedText type="smallBold" themeColor="coralDeep">
                    That photo was hard to read
                  </ThemedText>
                  <ThemedText type="small" themeColor="inkSoft">
                    Check every marked field carefully, or retake the photo straighter on.
                  </ThemedText>
                </View>
              ) : (
                <ThemedText type="small" themeColor="inkSoft">
                  The dye lot matters if you ever need to match another skein.
                </ThemedText>
              )}

              {/* Offered only once the yarn has a name to search on and only while something is
                  still blank, so the call is never made when it cannot buy anything. */}
              {form.brand.trim() && stillMissing > 0 ? (
                lookingUp ? (
                  <View style={styles.readingRow}>
                    <ActivityIndicator color={Colors.blushDeep} />
                    <ThemedText type="small" themeColor="inkSoft">
                      Looking up {form.brand.trim()}…
                    </ThemedText>
                  </View>
                ) : (
                  <Pressable onPress={() => void lookUp()} hitSlop={6} style={styles.scanAlt}>
                    <ThemedText type="smallBold" themeColor="sageDeep">
                      Look up {stillMissing} missing{' '}
                      {stillMissing === 1 ? 'field' : 'fields'} on the web →
                    </ThemedText>
                  </Pressable>
                )
              ) : null}

              {noMatch ? (
                <View style={[styles.scanNote, styles.scanNoteUnsure]}>
                  <ThemedText type="smallBold" themeColor="coralDeep">
                    Couldn&apos;t find that yarn
                  </ThemedText>
                  <ThemedText type="small" themeColor="inkSoft">
                    The name may be too general. Try the maker and range together, like “DROPS Baby
                    Merino”.
                  </ThemedText>
                </View>
              ) : null}

              <FormField
                label="Brand"
                badge={badgeFor('brand')}
                value={form.brand}
                maxLength={MaxNameLength}
                onChangeText={(v) => set('brand', v)}
                placeholder="e.g. Rico Design"
              />
              <FormField
                label="Color name"
                badge={badgeFor('colorName')}
                value={form.colorName}
                maxLength={MaxNameLength}
                onChangeText={(v) => set('colorName', v)}
                placeholder="e.g. Blossom Pink"
              />
              <FormField
                label="Dye lot / batch #"
                badge={badgeFor('colorLot')}
                value={form.colorLot}
                onChangeText={(v) => set('colorLot', v)}
                placeholder="e.g. L28304"
              />
              <FormField
                label="Price / skein (€)"
                badge={badgeFor('price')}
                value={form.price}
                onChangeText={(v) => set('price', v)}
                keyboardType="decimal-pad"
                placeholder="6.50"
              />
            </>
          )}

          {step === 2 && (
            <>
              <ThemedText type="subtitle">What is it made of?</ThemedText>
              <ThemedText type="small" themeColor="inkSoft">
                Weight, grams and meters are what you&apos;ll compare against a pattern.
              </ThemedText>
              <FormField
                label="Material"
                badge={badgeFor('composition')}
                value={form.composition}
                onChangeText={(v) => set('composition', v)}
                placeholder="e.g. 100% wool, or 80/20 wool/nylon"
              />
              <SelectField
                label="Yarn weight"
                badge={badgeFor('weight')}
                options={WEIGHT_OPTIONS}
                value={form.weight}
                onChange={(v) => set('weight', v)}
              />
              <FormField
                label="Grams"
                badge={badgeFor('grams')}
                value={form.grams}
                onChangeText={(v) => set('grams', v)}
                keyboardType="numeric"
                placeholder="50"
              />
              <FormField
                label="Meters"
                badge={badgeFor('meters')}
                value={form.meters}
                onChangeText={(v) => set('meters', v)}
                keyboardType="numeric"
                placeholder="250"
              />
            </>
          )}

          {step === 3 && (
            <>
              <ThemedText type="subtitle">How is it cared for?</ThemedText>
              <ThemedText type="small" themeColor="inkSoft">
                Worth recording now — the ball band tends to go missing.
              </ThemedText>
              <SelectField
                label="Washing"
                badge={badgeFor('washing')}
                options={WASHING_OPTIONS}
                value={form.washing}
                onChange={(v) => set('washing', v)}
              />
              <FormField
                label="Strands held together"
                value={form.strands}
                onChangeText={(v) => set('strands', v)}
                keyboardType="numeric"
                placeholder="1"
              />
              <FormField
                label="Product link (optional)"
                badge={badgeFor('link')}
                value={form.link}
                onChangeText={(v) => set('link', v)}
                placeholder="https://…"
              />
            </>
          )}

          {step === 4 && (
            <>
              <ThemedText type="subtitle">How do you work it?</ThemedText>
              <ThemedText type="small" themeColor="inkSoft">
                Record a gauge for the craft you use.
              </ThemedText>
              <SelectField
                label="Craft"
                options={CRAFT_OPTIONS}
                value={form.craftType}
                onChange={(v) => set('craftType', v)}
              />
              <SelectField
                badge={badgeFor('thickness')}
                label={form.craftType === 'crochet' ? 'Hook size' : 'Needle size'}
                options={toolSizeOptions(form.thickness, form.craftType)}
                value={form.thickness}
                onChange={(v) => set('thickness', v)}
              />
              <GaugeField
                badge={badgeFor('gauge')}
                value={form.gauge}
                onChange={(g) => set('gauge', g)}
                hint="What the ball band says, or what you got on a swatch."
              />
            </>
          )}

          <PillButton style={styles.nextBtn} onPress={handleNext}>
            <ThemedText type="smallBold" themeColor="white">
              {isLast ? 'Save material' : step === 0 ? 'Skip — type it in' : 'Next'}
            </ThemedText>
          </PillButton>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  // Wide and short: a ball band is a strip, and this is a receipt of what was scanned rather than
  // the yarn's portrait.
  preview: {
    width: '100%',
    height: 140,
    borderRadius: Radii.medium,
    backgroundColor: Colors.creamDeep,
  },
  readingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  scanBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  scanAlt: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  scanNote: {
    backgroundColor: Colors.white,
    borderRadius: Radii.medium,
    padding: Spacing.three,
    gap: 2,
    borderLeftWidth: 3,
    borderLeftColor: Colors.sageDeep,
  },
  scanNoteUnsure: {
    borderLeftColor: Colors.coralDeep,
  },
  container: {
    flex: 1,
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
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
    marginTop: Spacing.two,
    marginBottom: Spacing.four,
  },
  body: {
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  nextBtn: {
    marginTop: Spacing.three,
  },
});
