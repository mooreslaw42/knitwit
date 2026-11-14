import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { CardLink } from '@/components/card-link';
import { KnitIcon } from '@/components/icons/KnitIcon';
import { Card, Chip, InputStyle, PillButton, ReadOnlyField, RowSurface } from '@/components/knitwit-ui';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { usePageTitle } from '@/lib/use-page-title';
import { Colors, Spacing } from '@/constants/theme';
import { AccountSection } from '@/components/account-section';
import { SignOutSection } from '@/components/sign-out-section';
import { DeleteAccountSection } from '@/components/delete-account-section';
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
  const savedFee = useKnitwitStore((state) => state.settings.hourlyFee);
  const [fee, setFee] = useState(savedFee == null ? '' : String(savedFee));
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

  const saveFee = () => {
    const n = parseFloat(fee.replace(',', '.'));
    updateSettings({
      hourlyFee: fee.trim() && Number.isFinite(n) && n >= 0 ? n : undefined,
    });
  };
  const feeChanged = fee.trim() !== (savedFee == null ? '' : String(savedFee));

  // Settings, in groups.
  //
  // This screen was one unbroken column: eight headings at the same weight, each followed by a
  // paragraph and a button, with nothing to say where one subject ended and the next began. The
  // content is the same. It is in cards now — who you are, how the app behaves, your data, the
  // small print, and leaving — so the eye can find "sign out" without reading about gauge units
  // on the way.
  return (
    <Screen kind="pushed">
      <ThemedText type="title" heading={1}>
        Account
      </ThemedText>

      <Card style={styles.group}>
        <AccountSection />

        <View style={styles.divider} />

        {displayName && !editingName ? (
          <ReadOnlyField
            label="Name"
            value={displayName}
            action={{
              label: 'Change',
              onPress: () => {
                setName(displayName);
                setEditingName(true);
              },
            }}
          />
        ) : (
          <View style={styles.field}>
            <ThemedText type="smallBold">Name</ThemedText>
            <ThemedText type="caption" themeColor="inkSoft">
              What Knitwit calls you. Not what you sign in with.
            </ThemedText>
            <View style={styles.inline}>
              <TextInput
                value={name}
                onChangeText={setName}
                style={[styles.input, styles.grow]}
                placeholder="Your name"
                placeholderTextColor={Colors.inkSoft}
                accessibilityLabel="Your name"
                returnKeyType="done"
                onSubmitEditing={() => {
                  updateSettings({ displayName: name.trim() });
                  setEditingName(false);
                }}
              />
              <PillButton
                disabled={!name.trim()}
                onPress={() => {
                  updateSettings({ displayName: name.trim() });
                  setEditingName(false);
                }}
                style={styles.inlineBtn}>
                <ThemedText type="smallBold" themeColor="white">
                  Save
                </ThemedText>
              </PillButton>
            </View>
          </View>
        )}
      </Card>

      <CardLink href="/awards" style={styles.linkRow} accessibilityLabel={`Awards. Level ${level.level}, ${earned} earned.`}>
        <View style={styles.linkIcon}>
          <KnitIcon name="celebrate" size={22} color={Colors.coralDeep} accent={Colors.coral} />
        </View>
        <View style={styles.grow}>
          <ThemedText type="default">Awards</ThemedText>
          <ThemedText type="caption" themeColor="inkSoft">
            Level {level.level} · {earned} earned
          </ThemedText>
        </View>
        <KnitIcon name="forward" size={18} color={Colors.inkSoft} />
      </CardLink>

      <ThemedText type="overline" themeColor="inkSoft" style={styles.groupLabel}>
        Preferences
      </ThemedText>
      <Card style={styles.group}>
        <View style={styles.field}>
          <ThemedText type="smallBold">Measurements</ThemedText>
          <ThemedText type="caption" themeColor="inkSoft">
            New gauges start in this unit, and the ones you&apos;ve recorded are shown in it. A
            pattern written in the other unit keeps its own numbers — nothing is rewritten, only
            converted for reading.
          </ThemedText>
          <View style={styles.inline}>
            {UNITS.map((u) => (
              <Chip
                key={u.id}
                label={u.label}
                selected={settings.gaugeUnit === u.id}
                onPress={() => updateSettings({ gaugeUnit: u.id })}
              />
            ))}
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.field}>
          <ThemedText type="smallBold">Your time</ThemedText>
          <ThemedText type="caption" themeColor="inkSoft">
            What an hour of your knitting is worth, in euros. A project works out its estimated
            labour cost from this and your pace. Leave it blank and a project shows its yarn and
            the time on the clock, with no figure put on your hours.
          </ThemedText>
          <View style={styles.inline}>
            <ThemedText type="default" themeColor="inkSoft">
              €
            </ThemedText>
            <TextInput
              value={fee}
              onChangeText={setFee}
              style={[styles.input, styles.feeInput]}
              placeholder="0"
              placeholderTextColor={Colors.inkSoft}
              keyboardType="decimal-pad"
              accessibilityLabel="Your hourly fee in euros"
              onSubmitEditing={saveFee}
            />
            <ThemedText type="caption" themeColor="inkSoft" style={styles.grow}>
              per hour
            </ThemedText>
            {/* Only while there is something to save. A Save button beside a value that is
                already saved asks the knitter to confirm something that already happened. */}
            {feeChanged ? (
              <PillButton onPress={saveFee} style={styles.inlineBtn}>
                <ThemedText type="smallBold" themeColor="white">
                  Save
                </ThemedText>
              </PillButton>
            ) : null}
          </View>
        </View>
      </Card>

      <ThemedText type="overline" themeColor="inkSoft" style={styles.groupLabel}>
        Your data
      </ThemedText>
      <Card style={styles.group}>
        <ThemedText type="caption" themeColor="inkSoft">
          Everything — projects, patterns, stash, row counts, awards — is kept on this device and
          in your Knitwit account, so it follows you to any device you sign in on. A backup is a
          copy you hold yourself: worth taking before you restore, and the only one that is not in
          Knitwit&apos;s hands.
        </ThemedText>

        <PillButton variant="secondary" onPress={() => void exportBackup()} style={styles.startBtn}>
          <ThemedText type="smallBold" themeColor="ink">
            Download a backup
          </ThemedText>
        </PillButton>

        {confirmingRestore ? (
          <View style={styles.confirmRow}>
            <ThemedText type="caption" themeColor="coralDeep">
              Restoring replaces everything on this device. Download a backup first if you have not.
            </ThemedText>
            <View style={styles.inline}>
              <PillButton onPress={() => void importBackup()} style={styles.inlineBtn}>
                <ThemedText type="smallBold" themeColor="white">
                  Choose a backup file
                </ThemedText>
              </PillButton>
              <Pressable onPress={() => setConfirmingRestore(false)} style={styles.cancelBtn}>
                <ThemedText type="smallBold" themeColor="ink">
                  Cancel
                </ThemedText>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable onPress={() => setConfirmingRestore(true)} hitSlop={6} style={styles.restoreLink}>
            <ThemedText type="smallBold" themeColor="sageDeep">
              Restore from a backup
            </ThemedText>
          </Pressable>
        )}

        {backupNote ? (
          <ThemedText type="caption" themeColor="inkSoft">
            {backupNote}
          </ThemedText>
        ) : null}
      </Card>

      <ThemedText type="overline" themeColor="inkSoft" style={styles.groupLabel}>
        The small print
      </ThemedText>
      <Card style={styles.listCard}>
        {[
          { href: '/privacy' as const, label: 'Privacy' },
          { href: '/terms' as const, label: 'Terms' },
          { href: '/accessibility' as const, label: 'Accessibility' },
        ].map((page, i) => (
          <Pressable
            key={page.href}
            accessibilityRole="link"
            onPress={() => router.push(page.href)}
            style={({ pressed }) => [styles.listRow, i > 0 && styles.listRowDivided, pressed && styles.pressed]}>
            <ThemedText type="default" style={styles.grow}>
              {page.label}
            </ThemedText>
            <KnitIcon name="forward" size={18} color={Colors.inkSoft} />
          </Pressable>
        ))}
      </Card>

      <Card style={styles.group}>
        <SignOutSection />
        <View style={styles.divider} />
        <DeleteAccountSection />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.three },
  groupLabel: { marginTop: Spacing.two, marginLeft: Spacing.one },
  divider: { height: 1, backgroundColor: Colors.creamDeep },
  field: { gap: Spacing.one },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  grow: { flex: 1 },
  input: InputStyle,
  feeInput: { width: 96 },
  inlineBtn: { paddingHorizontal: Spacing.four },
  startBtn: { alignSelf: 'flex-start', paddingHorizontal: Spacing.four },
  confirmRow: { gap: Spacing.two },
  cancelBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  restoreLink: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  linkRow: {
    ...RowSurface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  linkIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.creamDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Rows run edge to edge inside the card, so the card gives up its own padding to them.
  listCard: { padding: 0, overflow: 'hidden' },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  listRowDivided: { borderTopWidth: 1, borderTopColor: Colors.creamDeep },
  pressed: { opacity: 0.6 },
});
