import { useEffect, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { PillButton, ReadOnlyField } from "@/components/knitwit-ui";
import { ThemedText } from "@/components/themed-text";
import {
  Colors,
  Fonts,
  MaxNameLength,
  Radii,
  Spacing,
} from "@/constants/theme";
import {
  accountStateOf,
  attachProvider,
  describeProviderReturn,
  saveAccount,
  type AccountState,
} from "@/lib/auth";
import { currentSession, onSessionChange } from "@/lib/session";
import {
  describeLocalWork,
  switchToExistingAccount,
} from "@/lib/switch-account";
import { useKnitwitStore } from "@/store/useKnitwitStore";

// The only part of accounts a knitter ever sees.
//
// Everything behind it has been running silently for five milestones: they already have an account,
// it already holds their work, it already syncs. What it has never had is a way back into it, which
// is the one thing this is for.
//
// Signing out is deliberately not here — it is the foot of the page, in sign-out-section.tsx.
// Everything in this component is a way *into* an account, and leaving one is not; offering it
// alongside them puts it in front of a knitter who came to do something else entirely.

type Mode = "idle" | "save" | "signin";

export function AccountSection() {
  const [account, setAccount] = useState<AccountState>(() =>
    accountStateOf(currentSession().session),
  );
  const [mode, setMode] = useState<Mode>("idle");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  // Coming back from Apple or Google having been refused is the state this screen opens in, not
  // something that happens to it later: the page navigated away and returned, so there is no call
  // left to report through. The screen would otherwise look untouched — same buttons, still signed
  // out — with the only evidence in the address bar.
  const [note, setNote] = useState<string | null>(describeProviderReturn);

  const projects = useKnitwitStore((s) => s.projects);
  const patterns = useKnitwitStore((s) => s.patterns);
  const materials = useKnitwitStore((s) => s.materials);
  const local = describeLocalWork({
    projects: Object.keys(projects).length,
    patterns: Object.keys(patterns).length,
    materials: Object.keys(materials).length,
  });

  useEffect(
    () => onSessionChange((s) => setAccount(accountStateOf(s.session))),
    [],
  );

  const reset = () => {
    setMode("idle");
    setEmail("");
    setPassword("");
  };

  const handleSave = async () => {
    setBusy(true);
    setNote(null);
    const result = await saveAccount(email, password);
    setBusy(false);
    if (!result.ok) {
      setNote(result.message);
      return;
    }
    reset();
    setNote("Saved. You can sign back in with that email on any device.");
  };

  // The account being signed into is not the one on this device, so what is here belongs to the one
  // being left behind. Said plainly, with the work named, and a backup taken first.
  const handleSignIn = async () => {
    setBusy(true);
    setNote(null);
    const outcome = await switchToExistingAccount(email, password, {
      downloadBackupFirst: true,
    });
    setBusy(false);

    if (outcome.status === "backup-refused") {
      setNote(
        "Nothing was changed — the backup was not saved, so signing in was stopped.",
      );
      return;
    }
    if (outcome.status === "failed") {
      setNote(outcome.message);
      return;
    }
    reset();
    setNote("Signed in. Reload Knitwit to see that account.");
  };

  const handleProvider = async (provider: "apple" | "google") => {
    setBusy(true);
    setNote(null);
    // 'keep-this-account', unlike the sign-in gate. Somebody reaching this from inside the app is
    // already looking at their own knitting and wants Apple or Google to become a way back into
    // *it* — not a way into some other account, which would leave what they are looking at behind.
    const result = await attachProvider(provider, "keep-this-account");
    setBusy(false);
    if (!result.ok) setNote(result.message);
  };

  return (
    <View style={styles.wrap}>
      <ThemedText type="smallBold" style={styles.label}>
        Your account
      </ThemedText>

      {account.anonymous || !account.signedIn ? (
        <ThemedText type="small" themeColor="inkSoft">
          Your knitting is saved to this device and backed up to Knitwit, but
          there is no way to sign back in to it. Add an email and password and
          you can reach {local} from any device — and get it back if this one is
          lost.
        </ThemedText>
      ) : (
        <>
          <ThemedText type="small" themeColor="inkSoft">
            Your knitting follows you to any device you sign in on.
          </ThemedText>
          {/* Apple will hand back a relay address rather than a real one if the knitter asked it
              to, and a provider account may carry no address at all — so what this is labelled
              follows what is actually known. */}
          <ReadOnlyField
            label={account.email ? "Email" : "Signed in with"}
            value={
              account.email ?? (account.providers.join(", ") || "your account")
            }
          />
        </>
      )}

      {mode === "idle" ? (
        account.anonymous || !account.signedIn ? (
          <View style={styles.actions}>
            <PillButton style={styles.btn} onPress={() => setMode("save")}>
              <ThemedText type="smallBold" themeColor="white">
                Save my work to an account
              </ThemedText>
            </PillButton>
            <Pressable
              onPress={() => setMode("signin")}
              hitSlop={6}
              style={styles.link}
            >
              <ThemedText type="smallBold" themeColor="sageDeep">
                I already have an account →
              </ThemedText>
            </Pressable>
          </View>
        ) : null
      ) : (
        <View style={styles.form}>
          {mode === "signin" ? (
            <ThemedText type="small" themeColor="coralDeep">
              This signs into a different account.{" "}
              {local === "nothing yet"
                ? ""
                : `What is on this device — ${local} — stays with the account you have now. A backup downloads first, and then this device shows the account you sign into.`}
            </ThemedText>
          ) : null}

          <TextInput
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={Colors.inkSoft}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            maxLength={MaxNameLength}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={Colors.inkSoft}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />

          <View style={styles.row}>
            <Pressable onPress={reset} style={styles.cancel}>
              <ThemedText type="smallBold" themeColor="ink">
                Cancel
              </ThemedText>
            </Pressable>
            <PillButton
              style={styles.btn}
              onPress={() =>
                void (mode === "save" ? handleSave() : handleSignIn())
              }
            >
              <ThemedText type="smallBold" themeColor="white">
                {busy
                  ? "Working…"
                  : mode === "save"
                    ? "Save account"
                    : "Sign in"}
              </ThemedText>
            </PillButton>
          </View>
        </View>
      )}

      {/* Offered alongside, not instead. Apple and Google need credentials set up in Supabase before
          they do anything; until then they say so rather than failing silently. */}
      {account.anonymous || !account.signedIn ? (
        <View style={styles.row}>
          <Pressable
            onPress={() => void handleProvider("apple")}
            style={styles.provider}
          >
            <ThemedText type="smallBold" themeColor="ink">
              Apple
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => void handleProvider("google")}
            style={styles.provider}
          >
            <ThemedText type="smallBold" themeColor="ink">
              Google
            </ThemedText>
          </Pressable>
        </View>
      ) : null}

      {note ? (
        <ThemedText type="small" themeColor="inkSoft">
          {note}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  label: { marginTop: Spacing.four },
  actions: { gap: Spacing.two, alignItems: "flex-start" },
  form: { gap: Spacing.two },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  confirm: { gap: Spacing.two },
  btn: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.two },
  cancel: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  link: { paddingVertical: Spacing.one },
  provider: {
    backgroundColor: Colors.white,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  input: {
    backgroundColor: Colors.white,
    borderRadius: Radii.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontFamily: Fonts.bodySemibold,
    fontSize: 15,
    color: Colors.ink,
  },
});
