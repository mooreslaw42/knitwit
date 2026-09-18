import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

// The client is built on first use, not at import time.
//
// Expo Router renders web routes in Node during dev and during `expo export`, where there is no
// `window`. Constructing the client eagerly makes supabase-js try to restore its session from
// storage as a side effect of the import, which reaches for `window.localStorage` and takes the
// whole render down. Nothing may run at module scope here for that reason — keep this file free
// of side effects.
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — see .env.example.',
    );
  }

  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // The code comes back in the query string and is redeemed against a secret this device kept,
      // so a copied URL is not a session. The alternative hands the token itself to the browser's
      // address bar, its history, and any referrer that follows.
      flowType: 'pkce',
      // Apple and Google return a knitter to a URL with a code on it, and only the web has a URL to
      // read it from. Left off, the browser would come back from Apple having signed in and the app
      // would never notice — the one failure with nothing at all to see. On a phone the sheet hands
      // the URL back instead; see src/lib/auth-return.ts.
      detectSessionInUrl: Platform.OS === 'web',
    },
  });
  return client;
}
