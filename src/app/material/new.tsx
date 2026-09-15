import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormField, PillButton, SelectField } from '@/components/knitwit-ui';
import { GaugeField } from '@/components/gauge-field';
import { ThemedText } from '@/components/themed-text';
import { usePageTitle } from '@/lib/use-page-title';
import { ThemedView } from '@/components/themed-view';
import { goBackOr } from '@/lib/navigation';
import { pickImage, pickImageMessage, takePhoto } from '@/lib/pick-image';
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

// What each field is called when the screen reports back what the band gave up.
const FIELD_LABELS: Partial<Record<keyof Material, string>> = {
  brand: 'brand',
  colorName: 'colour',
  colorLot: 'dye lot',
  composition: 'composition',
  weight: 'weight',
  washing: 'care',
  grams: 'grams',
  meters: 'meters',
  thickness: 'needle size',
  gauge: 'tension',
};

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
  // What the last scan produced, so step 1 can say what it found rather than leaving the knitter
  // to spot the difference across four steps of form.
  const [scan, setScan] = useState<{ found: string[]; confident: boolean } | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  // What the search filled, and what it thought it was looking at. Kept apart from `scan` so the
  // two sources of a prefilled form stay distinguishable to the knitter.
  const [lookup, setLookup] = useState<{ found: boolean; filled: string[]; name: string } | null>(
    null,
  );

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
    setForm((f) => ({ ...f, photo: picked.dataUrl }));
    setReading(true);
    try {
      const result = await readYarnLabel(picked.dataUrl);
      setForm((f) => ({ ...f, ...result.values }));
      setScan({
        found: result.filled.map((k) => FIELD_LABELS[k] ?? k),
        confident: result.confident,
      });
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
      setForm((f) => {
        const next = { ...f };
        for (const [key, value] of Object.entries(result.values) as [keyof Material, never][]) {
          // Blanks only, checked here as well as asked for there: between asking and answering the
          // knitter may have typed the very field being looked up.
          const current = key === 'gauge' ? f.gauge : String(f[key] ?? '').trim();
          if (!current) next[key] = value;
        }
        return next;
      });
      setLookup({
        found: result.found,
        filled: result.filled.map((k) => FIELD_LABELS[k] ?? k),
        name: result.matchedName,
      });
    } catch (error) {
      setScanError(
        error instanceof Error ? error.message : "Couldn't look that yarn up. Fill the rest in yourself.",
      );
    } finally {
      setLookingUp(false);
    }
  };

  const set = <K extends keyof Material>(key: K, value: Material[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

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
                <Image source={{ uri: form.photo }} style={styles.preview} />
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
              {/* Says what came off the band and how much to trust it. A prefilled form that never
                  explains itself leaves the knitter unsure which values are theirs. */}
              {scan ? (
                <View style={[styles.scanNote, !scan.confident && styles.scanNoteUnsure]}>
                  <ThemedText type="smallBold" themeColor={scan.confident ? 'sageDeep' : 'coralDeep'}>
                    {scan.found.length > 0
                      ? `Read from the band: ${scan.found.join(', ')}.`
                      : 'Nothing could be read from that photo.'}
                  </ThemedText>
                  <ThemedText type="small" themeColor="inkSoft">
                    {scan.confident
                      ? 'Check it as you go — everything here is editable.'
                      : 'The photo was hard to read, so check every field carefully.'}
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

              {lookup ? (
                <View style={[styles.scanNote, !lookup.found && styles.scanNoteUnsure]}>
                  <ThemedText
                    type="smallBold"
                    themeColor={lookup.found ? 'sageDeep' : 'coralDeep'}>
                    {lookup.found && lookup.filled.length > 0
                      ? `From the web, on ${lookup.name}: ${lookup.filled.join(', ')}.`
                      : lookup.found
                        ? `Found ${lookup.name}, but it added nothing new.`
                        : "Couldn't find that yarn — the name may be too general."}
                  </ThemedText>
                  <ThemedText type="small" themeColor="inkSoft">
                    {lookup.found
                      ? 'From a search, not from your band — worth a glance. The dye lot and price are never looked up.'
                      : 'Try the full name, maker and range together, like “DROPS Baby Merino”.'}
                  </ThemedText>
                </View>
              ) : null}
              <FormField
                label="Brand"
                value={form.brand}
                maxLength={MaxNameLength}
                onChangeText={(v) => set('brand', v)}
                placeholder="e.g. Rico Design"
              />
              <FormField
                label="Color name"
                value={form.colorName}
                maxLength={MaxNameLength}
                onChangeText={(v) => set('colorName', v)}
                placeholder="e.g. Blossom Pink"
              />
              <FormField
                label="Dye lot / batch #"
                value={form.colorLot}
                onChangeText={(v) => set('colorLot', v)}
                placeholder="e.g. L28304"
              />
              <FormField
                label="Price / skein (€)"
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
                value={form.composition}
                onChangeText={(v) => set('composition', v)}
                placeholder="e.g. 100% wool, or 80/20 wool/nylon"
              />
              <SelectField
                label="Yarn weight"
                options={WEIGHT_OPTIONS}
                value={form.weight}
                onChange={(v) => set('weight', v)}
              />
              <FormField
                label="Grams"
                value={form.grams}
                onChangeText={(v) => set('grams', v)}
                keyboardType="numeric"
                placeholder="50"
              />
              <FormField
                label="Meters"
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
                label={form.craftType === 'crochet' ? 'Hook size' : 'Needle size'}
                options={toolSizeOptions(form.thickness, form.craftType)}
                value={form.thickness}
                onChange={(v) => set('thickness', v)}
              />
              <GaugeField
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
