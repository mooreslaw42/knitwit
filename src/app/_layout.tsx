import {
  Quicksand_500Medium,
  Quicksand_600SemiBold,
  Quicksand_700Bold,
} from '@expo-google-fonts/quicksand';
import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/nunito';
import {
  DefaultTheme,
  type ErrorBoundaryProps,
  Stack,
  ThemeProvider,
  usePathname,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import AppHeader from '@/components/app-header';
import { Colors } from '@/constants/theme';
import { CrashScreen } from '@/components/crash-screen';
import { useKnitwitStore } from '@/store/useKnitwitStore';
import { migratePhotos } from '@/lib/migrate-photos';
import { currentSession, ensureSession, onSessionChange, watchSession } from '@/lib/session';
import { accountStateOf } from '@/lib/auth';
import { SignInGate } from '@/components/sign-in-gate';
import { SetNewPassword } from '@/components/set-new-password';
import { startSync } from '@/lib/sync';

SplashScreen.preventAutoHideAsync();

// The tab screens already render their own navigation; everything else is pushed onto this stack
// and needs the shared header so navigation stays reachable while editing.
const TAB_ROUTES = ['/', '/projects', '/library', '/counter', '/calculator', '/account'];

// Readable without an account, and deliberately so.
//
// Somebody being asked to create an account has to be able to read what they are agreeing to
// first — offering terms you can only see after accepting them is not offering them. It also keeps
// knitwit.eu/privacy reachable by anyone, which is what the App Store asks for and what a
// regulator would expect.
const PUBLIC_ROUTES = ['/privacy', '/terms', '/accessibility'];

// Anything a screen throws while rendering lands here instead of taking the app down with it.
//
// Expo Router looks for this export by name. Without one, a render error unmounts the tree and
// leaves a knitter staring at nothing, with no way to reach their data and every reason to start
// deleting things.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <CrashScreen
      title="Knitwit hit a snag"
      detail={`${error.name}: ${error.message}\n\n${error.stack ?? ''}`}
      onRetry={() => void retry()}
    />
  );
}

export default function RootLayout() {
  // Saved projects are read off the device asynchronously; hold the splash screen until they
  // land so the app never renders seed data over the user's real work.
  const hasHydrated = useKnitwitStore((state) => state.hasHydrated);
  const hydrationError = useKnitwitStore((state) => state.hydrationError);
  const [fontsLoaded] = useFonts({
    Quicksand_500Medium,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  const pathname = usePathname();

  // Who is signed in, watched here because the whole app is behind it.
  const [session, setSession] = useState(() => currentSession());
  useEffect(() => onSessionChange(setSession), []);
  const account = accountStateOf(session.session);

  // `settled` and not merely `session` — until the first attempt has finished, "no session" and
  // "not asked yet" look identical, and showing the gate on the second would flash a sign-in form
  // at somebody who is already signed in, on every single launch.
  const ready = fontsLoaded && hasHydrated && session.settled;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  // Who is signed in, and everything that follows from it.
  //
  // This used to be deliberately non-blocking, because an account was made silently and the app was
  // entirely usable without one. It gates the app now — see sign-in-gate.tsx — so the restore has
  // to finish before anything renders, which is what `settled` above is waiting on.
  useEffect(() => {
    const stop = watchSession();
    void ensureSession();
    // Yarn only, for now. Background from end to end: started, never awaited, every failure a
    // warning. See docs/plans/multi-user.md.
    const stopSync = startSync();
    return () => {
      stop();
      stopSync();
    };
  }, []);

  // Photos saved before they had their own storage are moved out of the store, once, in the
  // background. After the splash is gone on purpose: it is housekeeping, and a knitter opening the
  // app to count a row should not wait on it. Safe to interrupt — see migrate-photos.ts.
  useEffect(() => {
    if (!hasHydrated) return;
    void migratePhotos();
  }, [hasHydrated]);

  if (!ready) {
    return null;
  }

  // The saved data could not be read. The app is running and empty, which looks exactly like a
  // fresh install — so say plainly that it is not one, before anyone tidies up.
  if (hydrationError) {
    return (
      <ThemeProvider value={DefaultTheme}>
        <CrashScreen title="Knitwit couldn’t read your saved data" detail={hydrationError} />
      </ThemeProvider>
    );
  }

  // Before the wall, because a recovery link has already let them past it. They hold a real session
  // and would otherwise walk straight into the app without ever setting the password they came here
  // to set — rescued in appearance only, locked out again when it expires.
  if (session.recovering) {
    return (
      <ThemeProvider value={DefaultTheme}>
        <SetNewPassword />
      </ThemeProvider>
    );
  }

  // The wall. An anonymous session counts as signed out: it is an account nobody can return to,
  // which is the thing this screen exists to stop happening.
  if ((!account.signedIn || account.anonymous) && !PUBLIC_ROUTES.includes(pathname)) {
    return (
      <ThemeProvider value={DefaultTheme}>
        <SignInGate />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider value={DefaultTheme}>
      <View style={{ flex: 1, backgroundColor: Colors.cream }}>
        {!TAB_ROUTES.includes(pathname) && <AppHeader />}
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.cream },
          }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="project/new" options={{ headerShown: false }} />
        <Stack.Screen name="pattern/new" options={{ headerShown: false }} />
        <Stack.Screen name="pattern/[id]/index" options={{ headerShown: true, headerTitle: () => null }} />
        <Stack.Screen
          name="pattern/[id]/section/[index]"
          options={{ headerShown: true, headerTitle: () => null }}
        />
        <Stack.Screen name="project/[key]/index" options={{ headerShown: true, headerTitle: () => null }} />
        <Stack.Screen name="project/[key]/edit" options={{ headerShown: true, headerTitle: () => null }} />
        <Stack.Screen
          name="project/[key]/section/new"
          options={{ headerShown: true, headerTitle: () => null }}
        />
        <Stack.Screen
          name="project/[key]/section/[index]"
          options={{ headerShown: true, headerTitle: () => null }}
        />
        <Stack.Screen name="material/[id]" options={{ headerShown: true, headerTitle: () => null }} />
        <Stack.Screen name="tool/[id]" options={{ headerShown: true, headerTitle: () => null }} />
        <Stack.Screen name="technique/[id]" options={{ headerShown: true, headerTitle: () => null }} />
        <Stack.Screen name="privacy" options={{ headerShown: true, headerTitle: () => null }} />
        <Stack.Screen name="terms" options={{ headerShown: true, headerTitle: () => null }} />
        <Stack.Screen name="accessibility" options={{ headerShown: true, headerTitle: () => null }} />
        </Stack>
      </View>
    </ThemeProvider>
  );
}
