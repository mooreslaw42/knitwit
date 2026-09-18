import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PillButton } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { accountStateOf, signOut, type AccountState } from '@/lib/auth';
import { currentSession, onSessionChange } from '@/lib/session';
import { clearLocalAccountData, describeLocalWork } from '@/lib/switch-account';
import { useKnitwitStore } from '@/store/useKnitwitStore';

// Leaving, kept apart from every way of arriving.
//
// It lives at the foot of the whole page rather than inside the account section because it is not
// one of that section's options — those are all ways *into* an account. Put among them it gets
// offered to a knitter who came to change their name, which is how people sign out of things they
// meant to stay signed into.
//
// ## Why it asks first
//
// Signing out empties this device: that is the point of it, and it is also what makes it look like
// data loss. The work is safe on the server and comes back on the next sign-in, but nothing on
// screen says so at the moment the projects vanish. So the warning names what is about to go and
// says it is coming back — before, while it can still be called off.
//
// Offered only to an account that can be signed back into. An anonymous one has no email, no
// password and no provider, so this would not end a session, it would abandon an identity — and
// every project behind it becomes unreachable on a server the knitter cannot name.

export function SignOutSection() {
  const [account, setAccount] = useState<AccountState>(() =>
    accountStateOf(currentSession().session),
  );
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const projects = useKnitwitStore((s) => s.projects);
  const patterns = useKnitwitStore((s) => s.patterns);
  const materials = useKnitwitStore((s) => s.materials);
  const local = describeLocalWork({
    projects: Object.keys(projects).length,
    patterns: Object.keys(patterns).length,
    materials: Object.keys(materials).length,
  });

  useEffect(() => onSessionChange((s) => setAccount(accountStateOf(s.session))), []);

  if (!account.signedIn || account.anonymous) return null;

  const handleSignOut = async () => {
    setBusy(true);
    const result = await signOut();
    // Only once the session is actually gone. Clearing first and then failing would leave a knitter
    // signed in and looking at nothing.
    if (result.ok) await clearLocalAccountData();
    setBusy(false);
    setConfirming(false);
    setProblem(result.ok ? null : result.message);
  };

  return (
    <View style={styles.wrap}>
      {confirming ? (
        <View style={styles.confirm}>
          <ThemedText type="small" themeColor="coralDeep">
            Signing out clears {local} from this device. It stays in your account and comes back
            when you sign in again.
          </ThemedText>
          <View style={styles.row}>
            <Pressable onPress={() => setConfirming(false)} style={styles.cancel}>
              <ThemedText type="smallBold" themeColor="ink">
                Cancel
              </ThemedText>
            </Pressable>
            <PillButton style={styles.btn} onPress={() => void handleSignOut()}>
              <ThemedText type="smallBold" themeColor="white">
                {busy ? 'Signing out…' : 'Sign out'}
              </ThemedText>
            </PillButton>
          </View>
        </View>
      ) : (
        <PillButton variant="secondary" style={styles.btn} onPress={() => setConfirming(true)}>
          <ThemedText type="smallBold" themeColor="ink">
            Sign out
          </ThemedText>
        </PillButton>
      )}

      {problem ? (
        <ThemedText type="small" themeColor="inkSoft">
          {problem}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: Spacing.six, gap: Spacing.two },
  confirm: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  cancel: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  btn: { alignSelf: 'flex-start', paddingHorizontal: Spacing.five },
});
