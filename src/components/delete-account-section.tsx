import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PillButton } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radii, Spacing } from '@/constants/theme';
import { accountStateOf, deleteAccount, signOut, type AccountState } from '@/lib/auth';
import { backupFilename, buildBackup } from '@/lib/backup';
import { saveTextFile } from '@/lib/save-file';
import { currentSession, onSessionChange } from '@/lib/session';
import { clearLocalAccountData, describeLocalWork } from '@/lib/switch-account';
import { useKnitwitStore } from '@/store/useKnitwitStore';

// The one button in Knitwit that cannot be undone.
//
// Signing out empties the device and the work comes back on the next sign-in. This does not. The
// rows are gone from the server, the photographs are gone from storage, the email is free to be
// registered again by somebody else, and there is no copy anywhere unless the knitter made one.
//
// So the dialog does three things, in this order: it says what is about to be destroyed, by name
// and by count; it offers a backup right there, because the moment somebody is about to lose
// everything is exactly the moment to hand them a copy and exactly the wrong moment to send them
// to another screen for it; and only then does it offer the button.
//
// Nothing here is styled to be inviting. It is the last thing on the page, below signing out,
// because somebody arriving to change their name should not pass it on the way.

export function DeleteAccountSection() {
  const [account, setAccount] = useState<AccountState>(() =>
    accountStateOf(currentSession().session),
  );
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [backedUp, setBackedUp] = useState(false);

  const projects = useKnitwitStore((s) => s.projects);
  const patterns = useKnitwitStore((s) => s.patterns);
  const materials = useKnitwitStore((s) => s.materials);
  const local = describeLocalWork({
    projects: Object.keys(projects).length,
    patterns: Object.keys(patterns).length,
    materials: Object.keys(materials).length,
  });

  useEffect(() => onSessionChange((s) => setAccount(accountStateOf(s.session))), []);

  if (!account.signedIn) return null;

  const takeBackup = async () => {
    setBusy('Saving…');
    setNote(null);
    try {
      const text = await buildBackup();
      if (!text) {
        setNote('There is nothing saved to back up.');
        setBusy(null);
        return;
      }
      const saved = await saveTextFile(backupFilename(), text);
      setBackedUp(saved);
      setNote(saved ? 'Saved. Keep it somewhere that is not this device.' : null);
    } catch {
      setNote('The backup could not be written.');
    }
    setBusy(null);
  };

  const destroy = async () => {
    setBusy('Deleting…');
    setNote(null);

    const result = await deleteAccount();
    if (!result.ok) {
      // Nothing was deleted — the function refuses partial destruction — so the account is intact
      // and saying so is the useful part.
      setBusy(null);
      setNote(result.message);
      return;
    }

    // The server no longer knows this person. What is still on the device would sync nowhere and
    // sit here looking like an account, so it goes too.
    await signOut();
    await clearLocalAccountData();
    setBusy(null);
    setOpen(false);
  };

  return (
    <View style={styles.wrap}>
      <ThemedText type="smallBold" style={styles.label}>
        Deleting your account
      </ThemedText>
      <ThemedText type="small" themeColor="inkSoft">
        This removes your account and everything in it, from this device and from Knitwit&apos;s
        servers. It cannot be undone.
      </ThemedText>

      <Pressable onPress={() => setOpen(true)} style={styles.trigger} hitSlop={6}>
        <ThemedText type="smallBold" themeColor="coralDeep">
          Delete my account
        </ThemedText>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => (busy ? null : setOpen(false))}>
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <ScrollView contentContainerStyle={styles.dialogInner}>
              <ThemedText type="subtitle" heading={2}>
                Delete your account?
              </ThemedText>

              <ThemedText type="default">
                This deletes {local === 'nothing yet' ? 'your account' : local}, along with every
                photo, row count and note, from this device and from Knitwit&apos;s servers.
              </ThemedText>
              <ThemedText type="small" themeColor="coralDeep">
                There is no undo, and we cannot get it back for you afterwards.
              </ThemedText>

              {/* Offered here rather than pointed at, because this is the moment it matters. */}
              <PillButton
                variant="secondary"
                style={styles.dialogBtn}
                onPress={() => void takeBackup()}
                disabled={Boolean(busy)}>
                <ThemedText type="smallBold" themeColor="ink">
                  {backedUp ? 'Download another copy' : 'Download a copy first'}
                </ThemedText>
              </PillButton>

              {note ? (
                <ThemedText type="small" themeColor={backedUp ? 'sageDeep' : 'coralDeep'}>
                  {note}
                </ThemedText>
              ) : null}

              <View style={styles.row}>
                <Pressable
                  onPress={() => setOpen(false)}
                  disabled={Boolean(busy)}
                  style={styles.cancel}>
                  <ThemedText type="smallBold" themeColor="ink">
                    Keep my account
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => void destroy()}
                  disabled={Boolean(busy)}
                  style={styles.destroy}>
                  <ThemedText type="smallBold" themeColor="white">
                    {busy ?? 'Delete everything'}
                  </ThemedText>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: Spacing.six, gap: Spacing.two },
  label: { color: Colors.coralDeep },
  trigger: { alignSelf: 'flex-start', paddingVertical: Spacing.two },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(74,59,56,0.45)',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  dialog: {
    backgroundColor: Colors.cream,
    borderRadius: Radii.large,
    maxHeight: '80%',
  },
  dialogInner: { padding: Spacing.five, gap: Spacing.three },
  dialogBtn: { alignSelf: 'flex-start', paddingHorizontal: Spacing.four },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.two },
  cancel: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.three },
  destroy: {
    backgroundColor: Colors.coralDeep,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
  },
});
