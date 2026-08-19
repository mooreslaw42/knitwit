import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DeleteButton, FormField, PillButton, SelectField } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { goBackOr } from '@/lib/navigation';
import { WASHING_LABELS, YARN_WEIGHTS } from '@/constants/catalogs';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useKnitwitStore } from '@/store/useKnitwitStore';
import type { CraftType, Material } from '@/types/knitwit';

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

export default function MaterialEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const router = useRouter();

  const existing = useKnitwitStore((state) => (isNew ? null : state.materials[id]));
  const saveMaterial = useKnitwitStore((state) => state.saveMaterial);
  const deleteMaterial = useKnitwitStore((state) => state.deleteMaterial);

  const [form, setForm] = useState<Material>(existing ?? BLANK);
  const set = <K extends keyof Material>(key: K, value: Material[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="title">{isNew ? 'New material' : 'Edit material'}</ThemedText>

          <FormField label="Brand" value={form.brand} onChangeText={(v) => set('brand', v)} />
          <FormField
            label="Color name"
            value={form.colorName}
            onChangeText={(v) => set('colorName', v)}
          />
          <FormField
            label="Color lot"
            value={form.colorLot}
            onChangeText={(v) => set('colorLot', v)}
          />
          <FormField
            label="Price (€)"
            value={form.price}
            onChangeText={(v) => set('price', v)}
            keyboardType="decimal-pad"
          />
          <FormField
            label="Composition"
            value={form.composition}
            onChangeText={(v) => set('composition', v)}
            placeholder="e.g. 100% merino wool"
          />
          <SelectField
            label="Yarn weight"
            options={WEIGHT_OPTIONS}
            value={form.weight}
            onChange={(v) => set('weight', v)}
          />
          <FormField
            label="Grams per skein"
            value={form.grams}
            onChangeText={(v) => set('grams', v)}
            keyboardType="numeric"
          />
          <FormField
            label="Meters per skein"
            value={form.meters}
            onChangeText={(v) => set('meters', v)}
            keyboardType="numeric"
          />
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
            placeholder="e.g. 4.5mm"
          />
          <FormField
            label="Gauge — stitches / 10cm"
            value={form.gaugeStitches}
            onChangeText={(v) => set('gaugeStitches', v)}
            keyboardType="numeric"
          />
          <FormField
            label="Gauge — rows / 10cm"
            value={form.gaugeRows}
            onChangeText={(v) => set('gaugeRows', v)}
            keyboardType="numeric"
          />
          <SelectField
            label="Washing"
            options={WASHING_OPTIONS}
            value={form.washing}
            onChange={(v) => set('washing', v)}
          />
          <FormField label="Link" value={form.link} onChangeText={(v) => set('link', v)} />

          <PillButton
            style={styles.saveBtn}
            onPress={() => {
              saveMaterial(isNew ? null : id, {
                ...form,
                brand: form.brand || 'Unbranded',
                colorName: form.colorName || 'Unnamed color',
              });
              goBackOr(router, '/materials');
            }}>
            <ThemedText type="smallBold" themeColor="white">
              Save
            </ThemedText>
          </PillButton>

          {!isNew && (
            <DeleteButton
              onPress={() => {
                deleteMaterial(id);
                goBackOr(router, '/materials');
              }}
            />
          )}
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
    padding: Spacing.four,
    paddingBottom: Spacing.six * 2,
    gap: Spacing.three,
  },
  saveBtn: {
    marginTop: Spacing.two,
  },
});
