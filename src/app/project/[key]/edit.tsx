import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DeleteButton, FormField, PillButton, SelectField } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { goBackOr } from '@/lib/navigation';
import { useKnitwitStore } from '@/store/useKnitwitStore';

export default function ProjectEditScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const router = useRouter();

  const project = useKnitwitStore((state) => state.projects[key]);
  const patterns = useKnitwitStore((state) => state.patterns);
  const updateProject = useKnitwitStore((state) => state.updateProject);
  const deleteProject = useKnitwitStore((state) => state.deleteProject);

  const [name, setName] = useState(project?.name ?? '');
  const [started, setStarted] = useState(project?.started ?? '');
  const [patternId, setPatternId] = useState(project?.patternId ?? '');

  if (!project) return null;

  const patternOptions = [
    { value: '', label: "No pattern — I'll set it up myself" },
    ...Object.entries(patterns).map(([id, p]) => ({ value: id, label: p.name })),
  ];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="title">Edit project</ThemedText>

          <FormField label="Project name" value={name} onChangeText={setName} />
          <FormField label="Started" value={started} onChangeText={setStarted} />
          <SelectField
            label="Pattern"
            options={patternOptions}
            value={patternId}
            onChange={setPatternId}
          />

          <PillButton
            style={styles.saveBtn}
            onPress={() => {
              updateProject(key, { name, started, patternId: patternId || null });
              goBackOr(router, `/project/${key}`);
            }}>
            <ThemedText type="smallBold" themeColor="white">
              Save
            </ThemedText>
          </PillButton>

          <DeleteButton
            onPress={() => {
              deleteProject(key);
              // The project screen this came from no longer exists, so go home rather
              // than back to a dead route.
              router.replace('/');
            }}
          />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  scrollContent: {
    padding: Spacing.four,
    paddingBottom: Spacing.six * 2,
    gap: Spacing.three,
  },
  saveBtn: { marginTop: Spacing.two },
});
