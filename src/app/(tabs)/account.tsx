import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PillButton, ReadOnlyField } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { usePageTitle } from '@/lib/use-page-title';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { AccountSection } from '@/components/account-section';
import { SignOutSection } from '@/components/sign-out-section';
import { allProgress, standing } from '@/lib/awards';
import { backupFilename, buildBackup, readBackup, restoreMessage, writeBackup } from '@/lib/backup';
import { openTextFile } from '@/lib/open-file';
import { saveTextFile } from '@/lib/save-file';
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
  const displayName = useKnitwitStore((state) => state.settings.displayName ?? '');
  const [name, setName] = useState(displayName);
  // A name already given is a settled thing, not a question still being asked. It goes back to
  // being a field only when the knitter says so.
  const [editingName, setEditingName] = useState(false);
  const router = useRouter();
  const achievements = useKnitwitStore((state) => state.achievements);
  const level = standing(achievements);
  const earned = allProgress(achievements).filter((p) => p.earned).length;
  const settings = useKnitwitStore((state) => state.settings);
  const updateSettings = useKnitwitStore((state) => state.updateSettings);
  const [backupNote, setBackupNote] = useState<string | null>(null);
  const [confirmingRestore, setConfirmingRestore] = useState(false);

  const exportBackup = async () => {
    setBackupNote(null);
    try {
      const text = await buildBackup();
      if (!text) {
        setBackupNote('There is nothing saved yet to back up.');
        return;
      }
      const saved = await saveTextFile(backupFilename(), text);
      if (saved) {
        setBackupNote(`Saved ${Math.round(text.length / 1024)} KB — keep it somewhere that is not this device.`);
      }
    } catch {
      setBackupNote("Couldn't write the backup file.");
    }
  };

  // Replaces everything, so it asks first and only then opens the picker. A knitter who taps this
  // by accident should meet a question, not a file browser.
  const importBackup = async () => {
    setBackupNote(null);
    setConfirmingRestore(false);
    try {
      const file = await openTextFile();
      if (!file) return;

      const result = readBackup(file.text);
      if ('status' in result) {
        setBackupNote(restoreMessage(result));
        return;
      }

      await writeBackup(result.store);
      // The store is read once at launch, so the app has to start again to see the restored data.
      // Saying so is better than leaving the old data on screen and looking as though nothing
      // happened.
      setBackupNote(
        `Restored the backup from ${result.exportedAt.slice(0, 10) || 'that file'}. Reload Knitwit to see it.`,
      );
    } catch {
      setBackupNote("Couldn't read that file.");
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scroll}>
        <ThemedText type="title" heading={1}>Account</ThemedText>
        <AccountSection />

        {displayName && !editingName ? (
          <ReadOnlyField
            label="Name"
            value={displayName}
            action={{
              label: 'Change →',
              onPress: () => {
                setName(displayName);
                setEditingName(true);
              },
            }}
          />
        ) : (
          <>
            <ThemedText type="smallBold" style={styles.label}>
              Name
            </ThemedText>
            <ThemedText type="small" themeColor="inkSoft">
              What Knitwit calls you. Not what you sign in with.
            </ThemedText>
            <TextInput
              value={name}
              onChangeText={setName}
              style={styles.input}
              placeholder="Your name"
              placeholderTextColor={Colors.inkSoft}
            />

            <PillButton
              onPress={() => {
                updateSettings({ displayName: name.trim() });
                setEditingName(false);
              }}
              style={styles.saveBtn}>
              <ThemedText type="smallBold" themeColor="white">
                Save
              </ThemedText>
            </PillButton>
          </>
        )}

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

        <ThemedText type="smallBold" style={styles.label}>
          Your data
        </ThemedText>
        <ThemedText type="small" themeColor="inkSoft">
          Everything — projects, patterns, stash, row counts, awards — is kept on this device and
          in your Knitwit account, so it follows you to any device you sign in on. A backup is a
          copy you hold yourself: worth taking before you restore, and the only one that is not in
          Knitwit&apos;s hands.
        </ThemedText>

        <PillButton variant="secondary" onPress={() => void exportBackup()} style={styles.saveBtn}>
          <ThemedText type="smallBold" themeColor="ink">
            Download a backup
          </ThemedText>
        </PillButton>

        {confirmingRestore ? (
          <View style={styles.confirmRow}>
            <ThemedText type="small" themeColor="coralDeep">
              Restoring replaces everything on this device. Download a backup first if you have not.
            </ThemedText>
            <View style={styles.confirmBtns}>
              <Pressable onPress={() => setConfirmingRestore(false)} style={styles.cancelBtn}>
                <ThemedText type="smallBold" themeColor="ink">
                  Cancel
                </ThemedText>
              </Pressable>
              <PillButton onPress={() => void importBackup()} style={styles.saveBtn}>
                <ThemedText type="smallBold" themeColor="white">
                  Choose a backup file
                </ThemedText>
              </PillButton>
            </View>
          </View>
        ) : (
          <Pressable onPress={() => setConfirmingRestore(true)} hitSlop={6} style={styles.restoreLink}>
            <ThemedText type="smallBold" themeColor="sageDeep">
              Restore from a backup →
            </ThemedText>
          </Pressable>
        )}

        {backupNote ? (
          <ThemedText type="small" themeColor="inkSoft">
            {backupNote}
          </ThemedText>
        ) : null}

        <ThemedText type="smallBold" style={styles.label}>
          The small print
        </ThemedText>
        <View style={styles.legalRow}>
          {[
            { href: '/privacy' as const, label: 'Privacy' },
            { href: '/terms' as const, label: 'Terms' },
            { href: '/accessibility' as const, label: 'Accessibility' },
          ].map((page) => (
            <Pressable key={page.href} onPress={() => router.push(page.href)} hitSlop={6}>
              <ThemedText type="smallBold" themeColor="sageDeep">
                {page.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <SignOutSection />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: Spacing.six * 2,
  },
  confirmRow: {
    gap: Spacing.two,
  },
  confirmBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  cancelBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  restoreLink: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
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
  legalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.four, marginTop: Spacing.one },
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
