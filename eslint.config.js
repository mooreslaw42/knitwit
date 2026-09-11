// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // Edge Functions run on Deno — different globals, different module resolution. Linting them
    // with the Expo config only produces noise about imports it can't resolve.
    ignores: ["dist/*", "supabase/functions/*"],
  }
]);
