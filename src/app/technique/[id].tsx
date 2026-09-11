import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DeleteButton, FormField, PillButton, SelectField } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { goBackOr } from '@/lib/navigation';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useKnitwitStore } from '@/store/useKnitwitStore';
import type { Technique, TechniqueCraft } from '@/types/knitwit';

const BLANK: Technique = { name: '', craft: 'both', notes: '', link: '' };

const CRAFT_OPTIONS: { value: TechniqueCraft; label: string }[] = [
  { value: 'both', label: 'Knitting & crochet' },
  { value: 'knit', label: 'Knitting' },
  { value: 'crochet', label: 'Crochet' },
];

export default function TechniqueEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const router = useRouter();

  const existing = useKnitwitStore((state) => (isNew ? null : state.techniques[id]));
  const saveTechnique = useKnitwitStore((state) => state.saveTechnique);
  const deleteTechnique = useKnitwitStore((state) => state.deleteTechnique);

  const [form, setForm] = useState<Technique>(existing ?? BLANK);
  const set = <K extends keyof Technique>(key: K, value: Technique[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="title">{isNew ? 'New technique' : 'Edit technique'}</ThemedText>

          <FormField
            label="Name"
            value={form.name}
            onChangeText={(v) => set('name', v)}
            placeholder="e.g. Long-tail cast-on"
          />
          <SelectField
            label="Craft"
            options={CRAFT_OPTIONS}
            value={form.craft}
            onChange={(v) => set('craft', v)}
          />
          <FormField
            label="Notes"
            value={form.notes}
            onChangeText={(v) => set('notes', v)}
            placeholder="How it works, when to use it, things to remember…"
            multiline
            style={styles.notes}
          />
          <FormField
            label="Tutorial link (optional)"
            value={form.link}
            onChangeText={(v) => set('link', v)}
            placeholder="https://…"
          />

          <PillButton
            style={styles.saveBtn}
            onPress={() => {
              saveTechnique(isNew ? null : id, {
                ...form,
                name: form.name.trim() || 'Untitled technique',
              });
              goBackOr(router, '/library');
            }}>
            <ThemedText type="smallBold" themeColor="white">
              Save
            </ThemedText>
          </PillButton>

          {!isNew && (
            <DeleteButton
              onPress={() => {
                deleteTechnique(id);
                goBackOr(router, '/library');
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
  notes: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  saveBtn: {
    marginTop: Spacing.two,
  },
});
