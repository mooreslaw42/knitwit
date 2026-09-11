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
import { DefaultTheme, Stack, ThemeProvider, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View } from 'react-native';

import AppHeader from '@/components/app-header';
import { Colors } from '@/constants/theme';
import { useKnitwitStore } from '@/store/useKnitwitStore';

SplashScreen.preventAutoHideAsync();

// The tab screens already render their own navigation; everything else is pushed onto this stack
// and needs the shared header so navigation stays reachable while editing.
const TAB_ROUTES = ['/', '/projects', '/library', '/counter', '/materials', '/account'];

export default function RootLayout() {
  // Saved projects are read off the device asynchronously; hold the splash screen until they
  // land so the app never renders seed data over the user's real work.
  const hasHydrated = useKnitwitStore((state) => state.hasHydrated);
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

  if (!ready) {
    return null;
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
        <Stack.Screen name="pattern/[id]/index" options={{ headerShown: true, title: '' }} />
        <Stack.Screen
          name="pattern/[id]/section/[index]"
          options={{ headerShown: true, title: '' }}
        />
        <Stack.Screen name="project/[key]/index" options={{ headerShown: true, title: '' }} />
        <Stack.Screen name="project/[key]/edit" options={{ headerShown: true, title: '' }} />
        <Stack.Screen
          name="project/[key]/section/new"
          options={{ headerShown: true, title: '' }}
        />
        <Stack.Screen
          name="project/[key]/section/[index]"
          options={{ headerShown: true, title: '' }}
        />
        <Stack.Screen name="material/[id]" options={{ headerShown: true, title: '' }} />
        <Stack.Screen name="tool/[id]" options={{ headerShown: true, title: '' }} />
        <Stack.Screen name="technique/[id]" options={{ headerShown: true, title: '' }} />
        </Stack>
      </View>
    </ThemeProvider>
  );
}
