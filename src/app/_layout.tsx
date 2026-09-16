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
import { useEffect } from 'react';
import { View } from 'react-native';

import AppHeader from '@/components/app-header';
import { Colors } from '@/constants/theme';
import { CrashScreen } from '@/components/crash-screen';
import { useKnitwitStore } from '@/store/useKnitwitStore';
import { migratePhotos } from '@/lib/migrate-photos';
import { ensureSession, watchSession } from '@/lib/session';

SplashScreen.preventAutoHideAsync();

// The tab screens already render their own navigation; everything else is pushed onto this stack
// and needs the shared header so navigation stays reachable while editing.
const TAB_ROUTES = ['/', '/projects', '/library', '/counter', '/calculator', '/account'];

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
  const ready = fontsLoaded && hasHydrated;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  // An account, established quietly in the background.
  //
  // Deliberately not awaited and deliberately not gating anything: the app is entirely local until
  // sync arrives, and a knitter with no signal must still be able to count rows. A failure here is
  // a warning in the console and nothing else.
  useEffect(() => {
    const stop = watchSession();
    void ensureSession();
    return stop;
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
        </Stack>
      </View>
    </ThemeProvider>
  );
}
