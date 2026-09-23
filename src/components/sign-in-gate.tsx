import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PillButton } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import {
  accountStateOf,
  attachProvider,
  createAccount,
  describeProviderReturn,
  signInExisting,
} from '@/lib/auth';
import { currentSession, onSessionChange } from '@/lib/session';
import { describeLocalWork } from '@/lib/switch-account';
import { useKnitwitStore } from '@/store/useKnitwitStore';

// The door. Nobody reaches the app without coming through it.
//
// This reverses what the app did for its first five milestones, where an account was made silently
// on first launch and a knitter never met a form. Worth being honest about what the reversal costs,
// because it is not nothing:
//
//   - A new knitter cannot use Knitwit at all without a network. There is no local-only mode behind
//     this screen any more; the counter genuinely does wait for a token now.
//   - The first thing anybody meets is a form, before they have any reason to want an account.
//
// What it buys is that every knitter can get back into their work from another device, and that
// there is no such thing as an account nobody can sign into. Someone already signed in keeps
// working offline as before — the session is restored from storage and only refreshed when there
// is a network to refresh it against.
//
// ## The knitters who were already here
//
// Some devices hold an anonymous account from before this screen existed, with a real stash inside
// it. For them this is not a sign-up, it is a rescue: creating an account upgrades the one they
// have rather than making a second, so nothing moves. The screen says so, naming what is at stake,
// because "Create an account" on top of a year of knitting reads like a threat otherwise.

type Mode = 'create' | 'signin';

export function SignInGate() {
  const [account, setAccount] = useState(() => accountStateOf(currentSession().session));
  const [mode, setMode] = useState<Mode>('create');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(() => describeProviderReturn());

  const projects = useKnitwitStore((s) => s.projects);
  const patterns = useKnitwitStore((s) => s.patterns);
  const materials = useKnitwitStore((s) => s.materials);
  const local = describeLocalWork({
    projects: Object.keys(projects).length,
    patterns: Object.keys(patterns).length,
    materials: Object.keys(materials).length,
  });

  // Work sitting on an anonymous account from before the wall. Worth naming, because creating an
  // account is what saves it rather than what risks it.
  const stranded = account.anonymous && local !== 'nothing yet';

  useEffect(() => onSessionChange((s) => setAccount(accountStateOf(s.session))), []);

  const submit = async () => {
    setBusy(true);
    setNote(null);
    const result =
      mode === 'create'
        ? await createAccount(email, password)
        : await signInExisting(email, password);
    setBusy(false);
    if (!result.ok) {
      setNote(result.message);
      return;
    }
    // Nothing else to do: the session change propagates and this screen unmounts itself.
    setPassword('');
  };

  const provider = async (which: 'apple' | 'google') => {
    setBusy(true);
    setNote(null);
    const result = await attachProvider(which);
    setBusy(false);
    if (!result.ok && result.message) setNote(result.message);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <ThemedText type="title" heading={1} style={styles.title}>
            Knitwit
          </ThemedText>

          {stranded ? (
            <ThemedText type="small" themeColor="coralDeep">
              You have {local} saved on this device from before. Creating an account keeps it — it
              moves with you and nothing is lost.
            </ThemedText>
          ) : (
            <ThemedText type="small" themeColor="inkSoft">
              {mode === 'create'
                ? 'Your patterns, projects and stash live in your account, so they follow you to any device you sign in on.'
                : 'Welcome back.'}
            </ThemedText>
          )}

          <TextInput
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={Colors.inkSoft}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            placeholder={mode === 'create' ? 'Choose a password' : 'Password'}
            placeholderTextColor={Colors.inkSoft}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
            secureTextEntry
            onSubmitEditing={() => void submit()}
          />

          <PillButton style={styles.primary} onPress={() => void submit()} disabled={busy}>
            <ThemedText type="smallBold" themeColor="white">
              {busy
                ? 'One moment…'
                : mode === 'create'
                  ? stranded
                    ? 'Create an account and keep my knitting'
                    : 'Create my account'
                  : 'Sign in'}
            </ThemedText>
          </PillButton>

          <View style={styles.providers}>
            <Pressable onPress={() => void provider('apple')} style={styles.provider} disabled={busy}>
              <ThemedText type="smallBold" themeColor="ink">
                 Apple
              </ThemedText>
            </Pressable>
            <Pressable onPress={() => void provider('google')} style={styles.provider} disabled={busy}>
              <ThemedText type="smallBold" themeColor="ink">
                Google
              </ThemedText>
            </Pressable>
          </View>

          {note ? (
            <ThemedText type="small" themeColor="coralDeep">
              {note}
            </ThemedText>
          ) : null}

          <Pressable
            onPress={() => {
              setMode((m) => (m === 'create' ? 'signin' : 'create'));
              setNote(null);
            }}
            hitSlop={6}
            style={styles.swap}>
            <ThemedText type="smallBold" themeColor="sageDeep">
              {mode === 'create' ? 'I already have an account →' : 'I need an account →'}
            </ThemedText>
          </Pressable>
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
  providers: { flexDirection: 'row', gap: Spacing.two, justifyContent: 'center' },
  provider: {
    backgroundColor: Colors.white,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
  },
  swap: { alignSelf: 'center', paddingVertical: Spacing.two },
});
