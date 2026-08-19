import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormField, PillButton, SelectField } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { goBackOr } from '@/lib/navigation';
import { WASHING_LABELS, YARN_WEIGHTS } from '@/constants/catalogs';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useKnitwitStore } from '@/store/useKnitwitStore';
import type { CraftType, Material } from '@/types/knitwit';

const STEPS = ['Identity', 'Yarn', 'Care', 'Craft'] as const;

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
  gaugeStitches: '',
  gaugeRows: '',
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
  const router = useRouter();
  const saveMaterial = useKnitwitStore((state) => state.saveMaterial);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Material>(BLANK);
  const set = <K extends keyof Material>(key: K, value: Material[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const isLast = step === STEPS.length - 1;

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
    goBackOr(router, '/materials');
  };

  const handleBack = () => {
    if (step > 0) {
      setStep((s) => s - 1);
    } else {
      goBackOr(router, '/materials');
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
              <ThemedText type="subtitle">Which yarn is it?</ThemedText>
              <ThemedText type="small" themeColor="inkSoft">
                The dye lot matters if you ever need to match another skein.
              </ThemedText>
              <FormField
                label="Brand"
                value={form.brand}
                onChangeText={(v) => set('brand', v)}
                placeholder="e.g. Rico Design"
              />
              <FormField
                label="Color name"
                value={form.colorName}
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

          {step === 1 && (
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

          {step === 2 && (
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

          {step === 3 && (
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
              <FormField
                label={form.craftType === 'crochet' ? 'Hook size' : 'Needle size'}
                value={form.thickness}
                onChangeText={(v) => set('thickness', v)}
                placeholder={form.craftType === 'crochet' ? 'e.g. 5.5mm' : 'e.g. 4.5mm'}
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

          <PillButton style={styles.nextBtn} onPress={handleNext}>
            <ThemedText type="smallBold" themeColor="white">
              {isLast ? 'Save material' : 'Next'}
            </ThemedText>
          </PillButton>
        </View>
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
