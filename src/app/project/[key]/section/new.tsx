import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { FormField, PillButton } from '@/components/knitwit-ui';
import { EMPTY_KIT, SectionKitEditor } from '@/components/stash-picker';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { usePageTitle } from '@/lib/use-page-title';
import { Spacing } from '@/constants/theme';
import { goBackOr } from '@/lib/navigation';
import { useKnitwitStore } from '@/store/useKnitwitStore';

export default function NewSectionScreen() {
  usePageTitle('Add a section');
  const { key } = useLocalSearchParams<{ key: string }>();
  const router = useRouter();
  const addSection = useKnitwitStore((state) => state.addSection);

  const [name, setName] = useState('');
  const [totalRows, setTotalRows] = useState('60');
  const [kit, setKit] = useState(EMPTY_KIT);

  return (
    <Screen kind="pushed">
          <ThemedText type="title" heading={1}>Add a section</ThemedText>
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

          {/* Offered here as well as on the section itself, because a sleeve knitted in the
              contrast colour on smaller needles is something you know when you add it, not
              something you go back and fill in afterwards. */}
          <SectionKitEditor value={kit} onChange={setKit} />

          <PillButton
            style={styles.saveBtn}
            onPress={() => {
              addSection(key, { name, totalRows: parseInt(totalRows, 10) || 60, ...kit });
              goBackOr(router, `/project/${key}`);
            }}>
            <ThemedText type="smallBold" themeColor="white">
              Add section
            </ThemedText>
          </PillButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  saveBtn: { marginTop: Spacing.two },
});
