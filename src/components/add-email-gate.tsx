import { useEffect, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PillButton } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import {
  accountStateOf,
  addRecoveryEmail,
  deleteAccount,
  recheckEmail,
  signOut,
} from '@/lib/auth';
import { currentSession, onSessionChange } from '@/lib/session';
import { clearLocalAccountData } from '@/lib/switch-account';

// The second half of signing up with Ravelry: an address to come back with.
//
// Ravelry tells Knitwit who somebody is and nothing about how to reach them — there is no email in
// anything its API returns. An account made from that alone has exactly one door, and it is a door
// Knitwit does not own: lose the Ravelry login, or Ravelry change its mind about Knitwit, and the
// knitting behind it is unreachable. That is the anonymous-account problem the sign-in wall was
// built to end, arriving by a different route.
//
// So a Ravelry sign-in that makes a new account stops here, before the app, until it has a
// confirmed address. Nothing has been knitted into it yet, which is the point: asking afterwards
// would be asking somebody to rescue work, asking now is one field.
//
// Not reached by anybody who already had an account. Signing in with a Ravelry login that is
// already connected to one goes straight through, because that account has its email already.

type Stage =
  | { kind: 'ask' }
  | { kind: 'sent'; to: string }
  // The address belongs to somebody's existing Knitwit account — very likely their own.
  | { kind: 'taken'; address: string };

export function AddEmailGate() {
  const [account, setAccount] = useState(() => accountStateOf(currentSession().session));
  const [stage, setStage] = useState<Stage>(() =>
    account.pendingEmail ? { kind: 'sent', to: account.pendingEmail } : { kind: 'ask' },
  );
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => onSessionChange((s) => setAccount(accountStateOf(s.session))), []);

  // The link is usually opened somewhere else — the mail app, a laptop — and nothing tells this
  // device when it has been. Coming back to Knitwit is the natural moment to ask.
  useEffect(() => {
    if (stage.kind !== 'sent') return;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void recheckEmail();
    });
    return () => subscription.remove();
  }, [stage.kind]);

  const send = async (address: string) => {
    setBusy(true);
    setNote(null);
    try {
      const result = await addRecoveryEmail(address);
      if (!result.ok) {
        if (result.taken) setStage({ kind: 'taken', address: address.trim() });
        else setNote(result.message);
        return;
      }
      // Confirmation switched off: the address is on the account already, the session change
      // propagates, and this screen unmounts itself.
      if (result.confirmEmail) setStage({ kind: 'sent', to: address.trim() });
    } finally {
      setBusy(false);
    }
  };

  const confirmed = async () => {
    setBusy(true);
    setNote(null);
    try {
      const done = await recheckEmail();
      if (!done) setNote('Not yet — the link in that email has not been opened. It can take a minute to arrive.');
    } finally {
      setBusy(false);
    }
  };

  // The address is already somebody's Knitwit account, and the Ravelry login is now attached to
  // this new, empty one. Connecting Ravelry to the right account means freeing it first, and the
  // only way to free it is to remove the account it is on. Safe here and nowhere else: an account
  // held at this screen has never reached the app, so there is nothing in it to lose.
  const goToExistingAccount = async () => {
    setBusy(true);
    setNote(null);
    try {
      const removed = await deleteAccount();
      if (!removed.ok) {
        setNote(removed.message);
        return;
      }
      await signOut().catch(() => undefined);
      await clearLocalAccountData();
    } finally {
      setBusy(false);
    }
  };

  // Leaving is allowed. The account stays, held here; signing in with Ravelry again comes back to
  // this same question rather than making a second one.
  const later = async () => {
    setBusy(true);
    try {
      const result = await signOut();
      if (result.ok) await clearLocalAccountData();
      else setNote(result.message);
    } finally {
      setBusy(false);
    }
  };

  const name = account.providers.includes('custom:ravelry') ? 'Ravelry' : 'that sign-in';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {stage.kind === 'ask' ? (
            <>
              <ThemedText type="title" heading={1} style={styles.title}>
                One more thing: your email
              </ThemedText>
              <ThemedText type="default">
                You are signed in with {name}. Knitwit also needs an email address, so you can always get back to
                your knitting — even if you lose your {name} login.
              </ThemedText>
              <ThemedText type="small" themeColor="inkSoft">
                We send one link to check it is yours. We will not use it for anything else without asking.
              </ThemedText>

              <TextInput
                value={email}
                onChangeText={setEmail}
                style={styles.input}
                accessibilityLabel="Email address"
                placeholder="you@example.com"
                placeholderTextColor={Colors.inkSoft}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                keyboardType="email-address"
                onSubmitEditing={() => void send(email)}
              />

              <PillButton style={styles.primary} onPress={() => void send(email)} disabled={busy}>
                <ThemedText type="smallBold" themeColor="white">
                  {busy ? 'One moment…' : 'Send the link'}
                </ThemedText>
              </PillButton>
            </>
          ) : null}

          {stage.kind === 'sent' ? (
            <>
              <ThemedText type="title" heading={1} style={styles.title}>
                Check your inbox
              </ThemedText>
              <ThemedText type="default">
                We have sent a link to <ThemedText type="smallBold">{stage.to}</ThemedText>. Open it — on this
                device or any other — and then come back here.
              </ThemedText>
              <ThemedText type="small" themeColor="inkSoft">
                If it has not arrived in a few minutes, look in your spam folder.
              </ThemedText>

              <PillButton style={styles.primary} onPress={() => void confirmed()} disabled={busy}>
                <ThemedText type="smallBold" themeColor="white">
                  {busy ? 'One moment…' : 'I have opened the link'}
                </ThemedText>
              </PillButton>

              <View style={styles.links}>
                <Pressable onPress={() => void send(stage.to)} disabled={busy} hitSlop={6} style={styles.link}>
                  <ThemedText type="smallBold" themeColor="sageDeep">
                    Send it again
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setStage({ kind: 'ask' });
                    setNote(null);
                  }}
                  disabled={busy}
                  hitSlop={6}
                  style={styles.link}
                >
                  <ThemedText type="smallBold" themeColor="sageDeep">
                    Use a different address
                  </ThemedText>
                </Pressable>
              </View>
            </>
          ) : null}

          {stage.kind === 'taken' ? (
            <>
              <ThemedText type="title" heading={1} style={styles.title}>
                You already have an account
              </ThemedText>
              <ThemedText type="default">
                <ThemedText type="smallBold">{stage.address}</ThemedText> already has a Knitwit account. Sign in to
                that one, and connect {name} to it from your Account page.
              </ThemedText>
              <ThemedText type="small" themeColor="inkSoft">
                This removes the new, empty account {name} just made, so {name} can be connected to the one you
                already have. Nothing you have knitted is in it.
              </ThemedText>

              <PillButton style={styles.primary} onPress={() => void goToExistingAccount()} disabled={busy}>
                <ThemedText type="smallBold" themeColor="white">
                  {busy ? 'One moment…' : 'Go to my existing account'}
                </ThemedText>
              </PillButton>
              <Pressable
                onPress={() => {
                  setStage({ kind: 'ask' });
                  setNote(null);
                }}
                disabled={busy}
                hitSlop={6}
                style={styles.link}
              >
                <ThemedText type="smallBold" themeColor="sageDeep">
                  Use a different address
                </ThemedText>
              </Pressable>
            </>
          ) : null}

          {note ? (
            <ThemedText type="small" themeColor="coralDeep" accessibilityLiveRegion="polite">
              {note}
            </ThemedText>
          ) : null}

          <Pressable onPress={() => void later()} disabled={busy} hitSlop={6} style={styles.link}>
            <ThemedText type="small" themeColor="inkSoft">
              Not now — sign out
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
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.four },
  link: { alignSelf: 'center', paddingVertical: Spacing.two },
});
