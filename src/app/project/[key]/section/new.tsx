import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormField, PillButton } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { goBackOr } from '@/lib/navigation';
import { useKnitwitStore } from '@/store/useKnitwitStore';

export default function NewSectionScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const router = useRouter();
  const addSection = useKnitwitStore((state) => state.addSection);

  const [name, setName] = useState('');
  const [totalRows, setTotalRows] = useState('60');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="title">Add a section</ThemedText>
          <ThemedText type="small" themeColor="inkSoft">
            Sections split a project into the parts you knit one at a time — a body, a sleeve, a
            collar — each with its own row count and timer.
          </ThemedText>

          <FormField
            label="Section name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Left sleeve"
          />
          <FormField
            label="Rows"
            value={totalRows}
            onChangeText={setTotalRows}
            keyboardType="numeric"
            placeholder="60"
          />

          <PillButton
            style={styles.saveBtn}
            onPress={() => {
              addSection(key, { name, totalRows: parseInt(totalRows, 10) || 60 });
              goBackOr(router, `/project/${key}`);
            }}>
            <ThemedText type="smallBold" themeColor="white">
              Add section
            </ThemedText>
          </PillButton>
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
