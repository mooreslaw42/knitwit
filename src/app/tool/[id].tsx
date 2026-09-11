import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DeleteButton, FormField, PillButton, SelectField } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { goBackOr } from '@/lib/navigation';
import { inUseLabel } from '@/lib/knitwit-helpers';
import { TOOL_TYPE_LABELS } from '@/constants/catalogs';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useKnitwitStore } from '@/store/useKnitwitStore';
import type { Tool, ToolType } from '@/types/knitwit';

const BLANK: Tool = { type: 'circular', thickness: '', length: '', quantity: 1 };

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
  // Select the raw store slice (a stable reference) and derive the list in a
  // plain useMemo, rather than returning a freshly-computed array straight from
  // the Zustand selector — the latter breaks useSyncExternalStore's snapshot
  // caching and causes an infinite render loop.
  const projects = useKnitwitStore((state) => state.projects);
  const activeUsage = useMemo(() => {
    if (isNew) return [];
    return Object.values(projects).flatMap((p) =>
      p.sections
        .filter((s) => s.toolId === id && !s.complete)
        .map((s) => ({ projectName: p.name, sectionName: s.name })),
    );
  }, [isNew, projects, id]);

  const [form, setForm] = useState<Tool>(existing ?? BLANK);
  const set = <K extends keyof Tool>(key: K, value: Tool[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  // Quantity is edited as free text so it can be cleared mid-typing; it is parsed on save.
  const [qty, setQty] = useState(String(existing?.quantity ?? 1));

  const inUse = activeUsage.length;
  const owned = Math.max(1, parseInt(qty, 10) || 1);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="title">{isNew ? 'New tool' : 'Edit tool'}</ThemedText>

          <SelectField
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
          <FormField
            label="How many you have"
            value={qty}
            onChangeText={setQty}
            keyboardType="numeric"
            placeholder="1"
          />

          {!isNew && (
            <>
              <ThemedText type="smallBold" themeColor={inUse ? 'coralDeep' : 'sageDeep'}>
                {inUse >= owned && inUse > 0
                  ? `${inUseLabel(inUse)} — all of your ${owned}`
                  : `${owned} in your stash · ${inUseLabel(inUse)}`}
              </ThemedText>
              {inUse > 0 && (
                <ThemedText type="small" themeColor="inkSoft">
                  {activeUsage.map((u) => `${u.projectName} (${u.sectionName})`).join(', ')}
                </ThemedText>
              )}
            </>
          )}

          <PillButton
            style={styles.saveBtn}
            onPress={() => {
              saveTool(isNew ? null : id, {
                ...form,
                thickness: form.thickness || '—',
                length: form.length || '—',
                quantity: owned,
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
                deleteTool(id);
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
