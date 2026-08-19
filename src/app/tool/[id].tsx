import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChipPicker, DeleteButton, FormField, PillButton } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TOOL_TYPE_LABELS } from '@/constants/catalogs';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useKnitwitStore } from '@/store/useKnitwitStore';
import type { Tool, ToolType } from '@/types/knitwit';

const BLANK: Tool = { type: 'circular', thickness: '', length: '' };

const TYPE_OPTIONS: { value: ToolType; label: string }[] = Object.entries(TOOL_TYPE_LABELS).map(
  ([value, label]) => ({ value: value as ToolType, label }),
);

export default function ToolEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const router = useRouter();

  const existing = useKnitwitStore((state) => (isNew ? null : state.tools[id]));
  const saveTool = useKnitwitStore((state) => state.saveTool);
  const deleteTool = useKnitwitStore((state) => state.deleteTool);
  const activeUsage = useKnitwitStore((state) =>
    isNew
      ? []
      : Object.entries(state.projects).flatMap(([, p]) =>
          p.sections.filter((s) => s.toolId === id && !s.complete).map((s) => ({
            projectName: p.name,
            sectionName: s.name,
          })),
        ),
  );

  const [form, setForm] = useState<Tool>(existing ?? BLANK);
  const set = <K extends keyof Tool>(key: K, value: Tool[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="title">{isNew ? 'New tool' : 'Edit tool'}</ThemedText>

          <ChipPicker
            label="Type"
            options={TYPE_OPTIONS}
            value={form.type}
            onChange={(v) => set('type', v)}
          />
          <FormField
            label="Thickness"
            value={form.thickness}
            onChangeText={(v) => set('thickness', v)}
            placeholder="e.g. 4.5mm"
          />
          <FormField
            label="Length / set"
            value={form.length}
            onChangeText={(v) => set('length', v)}
            placeholder="e.g. 80cm, or set of 5"
          />

          {!isNew && (
            <ThemedText type="small" themeColor={activeUsage.length ? 'coralDeep' : 'sageDeep'}>
              {activeUsage.length
                ? `In use — ${activeUsage.map((u) => `${u.projectName} (${u.sectionName})`).join(', ')}`
                : 'Available'}
            </ThemedText>
          )}

          <PillButton
            style={styles.saveBtn}
            onPress={() => {
              saveTool(isNew ? null : id, {
                ...form,
                thickness: form.thickness || '—',
                length: form.length || '—',
              });
              router.back();
            }}>
            <ThemedText type="smallBold" themeColor="white">
              Save
            </ThemedText>
          </PillButton>

          {!isNew && (
            <DeleteButton
              onPress={() => {
                deleteTool(id);
                router.back();
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
