import { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PillButton } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts, MaxContentWidth, Radii, Spacing } from '@/constants/theme';

export default function AccountScreen() {
  const [name, setName] = useState('Pim');
  const [savedName, setSavedName] = useState('Pim');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ThemedText type="title">Account</ThemedText>
        <ThemedText type="default" themeColor="inkSoft">
          Currently saved as “{savedName}”. Sign-in isn&apos;t wired up yet — this just renames
          you locally.
        </ThemedText>

        <ThemedText type="smallBold" style={styles.label}>
          Name
        </ThemedText>
        <TextInput
          value={name}
          onChangeText={setName}
          style={styles.input}
          placeholder="Your name"
          placeholderTextColor={Colors.inkSoft}
        />

        <PillButton onPress={() => setSavedName(name.trim() || 'Knitter')} style={styles.saveBtn}>
          <ThemedText type="smallBold" themeColor="white">
            Save
          </ThemedText>
        </PillButton>
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
    paddingTop: Spacing.six,
    gap: Spacing.two,
  },
  label: {
    marginTop: Spacing.three,
  },
  input: {
    backgroundColor: Colors.white,
    borderRadius: Radii.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontFamily: Fonts.bodySemibold,
    fontSize: 16,
    color: Colors.ink,
  },
  saveBtn: {
    marginTop: Spacing.three,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.five,
  },
});
