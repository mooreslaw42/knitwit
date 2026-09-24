import { Link } from "expo-router";
import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PillButton } from "@/components/knitwit-ui";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  Colors,
  Fonts,
  MaxContentWidth,
  Radii,
  Spacing,
} from "@/constants/theme";
import {
  accountStateOf,
  createAccount,
  describeProviderReturn,
  readable,
  requestPasswordReset,
  signInExisting,
} from "@/lib/auth";
import { currentSession, onSessionChange } from "@/lib/session";
import {
  describeLocalWork,
  switchToExistingAccount,
  switchToProviderAccount,
} from "@/lib/switch-account";
import { useKnitwitStore } from "@/store/useKnitwitStore";

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

type Mode = "create" | "signin";

// SwitchOutcome carries a third state that the gate has its own handling for; this flattens the
// other two so the submit path reads as one thing.
function asAuthResult(outcome: { status: string; message?: string }): {
  ok: boolean;
  message: string;
} {
  if (outcome.status === "switched") return { ok: true, message: "" };
  if (outcome.status === "backup-refused") {
    return { ok: false, message: "Nothing was changed. Try again." };
  }
  return { ok: false, message: outcome.message ?? "That did not work." };
}

export function SignInGate() {
  const [account, setAccount] = useState(() =>
    accountStateOf(currentSession().session),
  );
  const [mode, setMode] = useState<Mode>("create");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  // Which provider is waiting on an answer about the knitting already on this device.
  const [asking, setAsking] = useState<"apple" | "google" | null>(null);
  const [note, setNote] = useState<string | null>(() =>
    describeProviderReturn(),
  );

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
  const stranded = account.anonymous && local !== "nothing yet";

  useEffect(
    () => onSessionChange((s) => setAccount(accountStateOf(s.session))),
    [],
  );

  // try/finally around every one of these, because `busy` is the only thing standing between a
  // knitter and a button that says "One moment…" for the rest of the session. An auth call that
  // throws rather than returning — an unconfigured project does exactly that — skips straight past
  // the line that would have cleared it, and the screen never recovers.
  const submit = async () => {
    setBusy(true);
    setNote(null);
    try {
      // Signing in to a different account has to clear this one, whichever door it came through.
      // Leaving it produces a union: one account's projects under another's name, with no way to
      // tell which is which and — the outbox being per account — no way for the old ones to sync
      // anywhere ever again. The copy is offered on the way past, not demanded.
      const result =
        mode === "create"
          ? await createAccount(email, password)
          : stranded
            ? asAuthResult(
                await switchToExistingAccount(email, password, {
                  downloadBackupFirst: false,
                }),
              )
            : await signInExisting(email, password);
      if (!result.ok) {
        setNote(result.message);
        return;
      }
      // Nothing else to do: the session change propagates and this screen unmounts itself.
      setPassword("");
    } catch (error) {
      setNote(readable(error instanceof Error ? error.message : ""));
    } finally {
      setBusy(false);
    }
  };

  const forgotten = async () => {
    if (!email.trim()) {
      setNote("Type your email address first, then ask again.");
      return;
    }
    setBusy(true);
    const result = await requestPasswordReset(email);
    setBusy(false);
    // Says the same thing either way, on purpose — see requestPasswordReset. A knitter whose
    // address is not registered learns nothing here, and neither does anybody guessing.
    setNote(
      result.ok
        ? `If ${email.trim()} has a Knitwit account, a link to set a new password is on its way.`
        : result.message,
    );
  };

  // Apple and Google mean *sign in*, because that is what the button says on a screen whose whole
  // purpose is getting in. Attaching a provider to the account already on the device is a different
  // act with a different consequence, and it lives on the Account screen where it belongs.
  const provider = async (which: "apple" | "google") => {
    // Work on this device belongs to the anonymous account being left behind, and signing in
    // abandons it. That is a question with two real answers, so it is asked as one — a note and a
    // second press is not a choice, it is a guess about what the second press means.
    if (stranded) {
      setNote(null);
      setAsking(which);
      return;
    }
    await runProviderSwitch(which, false);
  };

  // Offered, not imposed. The copy exists because the knitting on this device is about to become
  // unreachable, and that is worth one deliberate question — but it is the knitter's work and
  // theirs to walk away from. Requiring the file turned "I want to sign in" into a door that only
  // opened for people willing to save something they had already decided they did not want.
  const runProviderSwitch = async (
    which: "apple" | "google",
    withBackup: boolean,
  ) => {
    setBusy(true);
    setNote(null);
    try {
      const outcome = await switchToProviderAccount(which, {
        downloadBackupFirst: withBackup,
      });

      if (outcome.status === "backup-refused") {
        // The sheet was dismissed. Left open, with the other answer still on it.
        setNote("The copy was not saved, so nothing has changed yet.");
        return;
      }
      setAsking(null);
      if (outcome.status === "failed" && outcome.message)
        setNote(outcome.message);
    } catch (error) {
      setNote(readable(error instanceof Error ? error.message : ""));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView
        style={styles.safe}
        edges={["top", "left", "right", "bottom"]}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <ThemedText type="title" heading={1} style={styles.title}>
            Knitwit
          </ThemedText>

          {stranded ? (
            <ThemedText type="small" themeColor="coralDeep">
              You have {local} saved on this device from before. Creating an
              account keeps it — it moves with you and nothing is lost.
            </ThemedText>
          ) : (
            <ThemedText type="small" themeColor="inkSoft">
              {mode === "create"
                ? "Your patterns, projects and stash live in your account, so they follow you to any device you sign in on."
                : "Welcome back."}
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
            placeholder={mode === "create" ? "Choose a password" : "Password"}
            placeholderTextColor={Colors.inkSoft}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete={
              mode === "create" ? "new-password" : "current-password"
            }
            secureTextEntry
            onSubmitEditing={() => void submit()}
          />

          <PillButton
            style={styles.primary}
            onPress={() => void submit()}
            disabled={busy}
          >
            <ThemedText type="smallBold" themeColor="white">
              {busy
                ? "One moment…"
                : mode === "create"
                  ? stranded
                    ? "Create an account and keep my knitting"
                    : "Create my account"
                  : "Sign in"}
            </ThemedText>
          </PillButton>

          <View style={styles.providers}>
            <Pressable
              onPress={() => void provider("apple")}
              style={styles.provider}
              disabled={busy}
            >
              <ThemedText type="smallBold" themeColor="ink">
                Apple
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => void provider("google")}
              style={styles.provider}
              disabled={busy}
            >
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

          <Modal
            visible={asking !== null}
            transparent
            animationType="fade"
            onRequestClose={() => (busy ? null : setAsking(null))}
          >
            <View style={styles.backdrop}>
              <View style={styles.dialog}>
                <ThemedText type="subtitle" heading={2}>
                  Keep a copy first?
                </ThemedText>
                <ThemedText type="default">
                  The {local} on this device belongs to the account you have
                  now. Signing in with {asking === "apple" ? "Apple" : "Google"}{" "}
                  takes you to a different one, and leaves this behind.
                </ThemedText>
                <ThemedText type="small" themeColor="coralDeep">
                  That account has no email and no password, so nothing can sign
                  back into it. A copy is the only way this knitting survives.
                </ThemedText>

                {note ? (
                  <ThemedText type="small" themeColor="coralDeep">
                    {note}
                  </ThemedText>
                ) : null}

                <PillButton
                  style={styles.dialogPrimary}
                  onPress={() => asking && void runProviderSwitch(asking, true)}
                  disabled={busy}
                >
                  <ThemedText type="smallBold" themeColor="white">
                    {busy ? "One moment…" : "Save a copy, then sign in"}
                  </ThemedText>
                </PillButton>

                <Pressable
                  onPress={() =>
                    asking && void runProviderSwitch(asking, false)
                  }
                  disabled={busy}
                  style={styles.dialogSkip}
                >
                  <ThemedText type="smallBold" themeColor="ink">
                    Sign in without saving
                  </ThemedText>
                </Pressable>

                <Pressable
                  onPress={() => setAsking(null)}
                  disabled={busy}
                  style={styles.dialogSkip}
                >
                  <ThemedText type="small" themeColor="inkSoft">
                    Cancel
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </Modal>

          <Pressable
            onPress={() => {
              setMode((m) => (m === "create" ? "signin" : "create"));
              setNote(null);
            }}
            hitSlop={6}
            style={styles.swap}
          >
            <ThemedText type="smallBold" themeColor="sageDeep">
              {mode === "create"
                ? "I already have an account →"
                : "I need an account →"}
            </ThemedText>
          </Pressable>

          {/* Reachable before agreeing to them, which is the only way offering them means anything.
              These three routes are allow-listed past the wall in _layout.tsx. */}
          {mode === "create" ? (
            <ThemedText type="small" themeColor="inkSoft" style={styles.legal}>
              By creating an account you agree to our{" "}
              <Link href="/terms" style={styles.legalLink}>
                terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy" style={styles.legalLink}>
                privacy statement
              </Link>
              .
            </ThemedText>
          ) : null}

          {/* Only when signing in. Offering it beside "create an account" would be answering a
              question nobody has asked yet. */}
          {mode === "signin" ? (
            <Pressable
              onPress={() => void forgotten()}
              hitSlop={6}
              style={styles.swap}
              disabled={busy}
            >
              <ThemedText type="small" themeColor="inkSoft">
                I have forgotten my password
              </ThemedText>
            </Pressable>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center" },
  safe: { flex: 1, width: "100%", maxWidth: MaxContentWidth },
  scroll: {
    padding: Spacing.five,
    gap: Spacing.three,
    flexGrow: 1,
    justifyContent: "center",
  },
  title: { textAlign: "center" },
  input: {
    backgroundColor: Colors.white,
    borderRadius: Radii.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontFamily: Fonts.bodySemibold,
    fontSize: 16,
    color: Colors.ink,
  },
  primary: {
    alignSelf: "stretch",
    alignItems: "center",
    paddingVertical: Spacing.three,
  },
  providers: {
    flexDirection: "row",
    gap: Spacing.two,
    justifyContent: "center",
  },
  provider: {
    backgroundColor: Colors.white,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
  },
  swap: { alignSelf: "center", paddingVertical: Spacing.two },
  legal: { textAlign: "center" },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(74,59,56,0.45)",
    justifyContent: "center",
    padding: Spacing.four,
  },
  dialog: {
    backgroundColor: Colors.cream,
    borderRadius: Radii.large,
    padding: Spacing.five,
    gap: Spacing.three,
  },
  dialogPrimary: {
    alignSelf: "stretch",
    alignItems: "center",
    paddingVertical: Spacing.three,
  },
  dialogSkip: { alignSelf: "center", paddingVertical: Spacing.two },
  legalLink: { color: Colors.sageDeep, textDecorationLine: "underline" },
});
