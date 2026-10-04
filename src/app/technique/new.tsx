import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, FormField, PillButton, SelectField } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CRAFT_LABELS, CRAFT_ORDER } from '@/constants/catalogs';
import { MaxContentWidth, MaxNameLength, Spacing } from '@/constants/theme';
import { goBackOr } from '@/lib/navigation';
import { usePageTitle } from '@/lib/use-page-title';
import { useKnitwitStore } from '@/store/useKnitwitStore';
import type { TechniqueCraft } from '@/types/knitwit';

// A technique the catalogue doesn't have.
//
// The library already offered this — "+ Add a technique to your library", on every section's kit
// picker — and the screen it pointed at was never built. The link fell through to the technique
// *detail* route with "new" as the slug, which read as a technique literally called "new" and
// wrote one into the library the moment a status was tapped. So this screen is the missing half of
// a link that has been live all along, and the fix for the junk it was making.
//
// Deliberately plain, and deliberately last: the catalogue has ninety-odd entries and a pattern
// can only ever be matched against those, so a knitter is better served finding the real one than
// writing their own. Hence the note rather than a prominent form.

const CRAFT_OPTIONS: { value: TechniqueCraft; label: string }[] = CRAFT_ORDER.map((c) => ({
  value: c,
  label: CRAFT_LABELS[c],
}));

export default function NewTechniqueScreen() {
  usePageTitle('New technique');
  const router = useRouter();
  const addCustomTechnique = useKnitwitStore((state) => state.addCustomTechnique);

  const [name, setName] = useState('');
  const [craft, setCraft] = useState<TechniqueCraft>('both');
  const [abbr, setAbbr] = useState('');

  const named = name.trim().length > 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="title" heading={1}>Add a technique</ThemedText>

          <Card style={styles.card}>
            <ThemedText type="small" themeColor="inkSoft">
              For something the catalogue doesn&apos;t have. A technique you add is yours alone: it
              sorts below the catalogue&apos;s, and a pattern that names it will never match it
              automatically. Worth a look in <ThemedText type="smallBold">Browse all</ThemedText>{' '}
              first.
            </ThemedText>
          </Card>

          <FormField
            label="Name"
            value={name}
            onChangeText={setName}
            maxLength={MaxNameLength}
            placeholder="e.g. Nan's edging"
          />
          <SelectField
            label="Craft"
            options={CRAFT_OPTIONS}
            value={craft}
            onChange={(v) => setCraft(v)}
          />
          {/* Optional, and usually empty: a technique nobody else has a name for rarely has a
              short form either. */}
          <FormField
            label="Abbreviation (optional)"
            value={abbr}
            onChangeText={setAbbr}
            placeholder="e.g. NE"
          />

          <PillButton
            style={styles.saveBtn}
            disabled={!named}
            onPress={() => {
              const id = addCustomTechnique(name, craft, abbr);
              // Replace rather than push: going back from the technique should land on the library
              // the knitter came from, not on an empty form for one they have just made.
              router.replace(`/technique/${id}`);
            }}>
            <ThemedText type="smallBold" themeColor="white">
              Add to my library
            </ThemedText>
          </PillButton>

          <PillButton
            variant="secondary"
            style={styles.cancelBtn}
            onPress={() => goBackOr(router, '/library')}>
            <ThemedText type="smallBold" themeColor="ink">
              Cancel
            </ThemedText>
          </PillButton>
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
  card: { gap: Spacing.two },
  saveBtn: { marginTop: Spacing.two },
  cancelBtn: { alignSelf: 'flex-start' },
});
