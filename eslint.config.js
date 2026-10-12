// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // Edge Functions run on Deno — different globals, different module resolution. Linting them
    // with the Expo config only produces noise about imports it can't resolve.
    // The brand kit is design source, not app code: generator inputs that don't resolve until
    // it has run (see tsconfig.json).
    ignores: ["dist/*", "supabase/functions/*", "brand-kit/*"],
  }
]);
