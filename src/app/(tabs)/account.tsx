import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PillButton } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { usePageTitle } from '@/lib/use-page-title';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { allProgress, standing } from '@/lib/awards';
import { useKnitwitStore } from '@/store/useKnitwitStore';
import type { LengthUnit } from '@/types/knitwit';

// Settings live on the device today and should follow the knitter between them once there are
// accounts — see UserSettings. Language belongs in this list when there is more than one.
const UNITS: { id: LengthUnit; label: string }[] = [
  { id: 'cm', label: 'Centimetres' },
  { id: 'inch', label: 'Inches' },
];

export default function AccountScreen() {
  usePageTitle('Account');
  const [name, setName] = useState('Pim');
  const [savedName, setSavedName] = useState('Pim');
  const router = useRouter();
  const achievements = useKnitwitStore((state) => state.achievements);
  const level = standing(achievements);
  const earned = allProgress(achievements).filter((p) => p.earned).length;
  const settings = useKnitwitStore((state) => state.settings);
  const updateSettings = useKnitwitStore((state) => state.updateSettings);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ThemedText type="title" heading={1}>Account</ThemedText>
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

        <ThemedText type="smallBold" style={styles.label}>
          Awards
        </ThemedText>
        <PillButton variant="secondary" onPress={() => router.push('/awards')} style={styles.saveBtn}>
          <ThemedText type="smallBold" themeColor="ink">
            Level {level.level} · {earned} awards →
          </ThemedText>
        </PillButton>

        <ThemedText type="smallBold" style={styles.label}>
          Measurements
        </ThemedText>
        <ThemedText type="small" themeColor="inkSoft">
          New gauges start in this unit, and gauges you&apos;ve already recorded are shown in it.
          A pattern written in the other unit keeps its own numbers — nothing is rewritten, only
          converted for reading.
        </ThemedText>
        <View style={styles.unitRow}>
          {UNITS.map((u) => {
            const on = settings.gaugeUnit === u.id;
            return (
              <Pressable
                key={u.id}
                onPress={() => updateSettings({ gaugeUnit: u.id })}
                style={[styles.unitChip, on && styles.unitChipOn]}>
                <ThemedText type="smallBold" themeColor={on ? 'white' : 'inkSoft'}>
                  {u.label}
                </ThemedText>
              </Pressable>
            );
          })}
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
    paddingTop: Spacing.six,
    gap: Spacing.two,
  },
  label: {
    marginTop: Spacing.three,
  },
  unitRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  unitChip: {
    backgroundColor: Colors.creamDeep,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  unitChipOn: {
    backgroundColor: Colors.blushDeep,
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
