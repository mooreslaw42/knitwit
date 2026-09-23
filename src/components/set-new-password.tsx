import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PillButton } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { setNewPassword } from '@/lib/auth';
import { finishRecovery } from '@/lib/session';

// The end of the password-reset journey, and the only screen that can finish it.
//
// A recovery link hands over a real session before this renders — that is how the new password can
// be set without knowing the old one. Which means the knitter is, technically, already in. Without
// this screen standing in the way they would go straight to their knitting, never be asked for a
// password, and be locked out again the moment the session expired: apparently rescued, actually
// not.
//
// So it blocks, and it says why.

export function SetNewPassword() {
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const submit = async () => {
    // Checked here rather than by the server, which has no idea the second box exists. A typo in a
    // password you cannot see is the ordinary way to lock yourself out while trying not to.
    if (password !== again) {
      setProblem('Those two do not match.');
      return;
    }
    setBusy(true);
    setProblem(null);
    const result = await setNewPassword(password);
    setBusy(false);
    if (!result.ok) {
      setProblem(result.message);
      return;
    }
    // The session was already real; it is just no longer a recovery.
    finishRecovery();
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <ThemedText type="title" heading={1} style={styles.title}>
            Choose a new password
          </ThemedText>
          <ThemedText type="small" themeColor="inkSoft">
            Your knitting is where you left it. Pick a password and you are back in.
          </ThemedText>

          <TextInput
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            placeholder="New password"
            placeholderTextColor={Colors.inkSoft}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            secureTextEntry
          />
          <TextInput
            value={again}
            onChangeText={setAgain}
            style={styles.input}
            placeholder="And again"
            placeholderTextColor={Colors.inkSoft}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            secureTextEntry
            onSubmitEditing={() => void submit()}
          />

          <PillButton style={styles.primary} onPress={() => void submit()} disabled={busy}>
            <ThemedText type="smallBold" themeColor="white">
              {busy ? 'One moment…' : 'Save it and let me in'}
            </ThemedText>
          </PillButton>

          {problem ? (
            <ThemedText type="small" themeColor="coralDeep">
              {problem}
            </ThemedText>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  scroll: { padding: Spacing.five, gap: Spacing.three, flexGrow: 1, justifyContent: 'center' },
  title: { textAlign: 'center' },
  input: {
    backgroundColor: Colors.white,
    borderRadius: Radii.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontFamily: Fonts.bodySemibold,
    fontSize: 16,
    color: Colors.ink,
  },
  primary: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: Spacing.three },
});
