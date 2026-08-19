# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Knitwit

A knitting/crochet companion app: row/stitch counter, pattern library, project tracker,
gauge calculator, materials & tools manager. One Expo (React Native + React Native Web)
codebase targets iOS (TestFlight via EAS Build), and web (static export via
`expo export --platform web`). See `/Users/pim/.claude/plans/currently-knitwit-is-just-noble-umbrella.md`
for the full build-out plan and phase sequencing.

## Reference material

`reference/index.html` and `reference/knitwit-mockups.html` are the original static HTML/CSS/JS
demo this app is being ported from. They are not served or built — kept only so screens can be
diffed against the original for visual/functional parity, and so their existing data model
(`mkSec`/`mkR`/`mkG` builders for pattern sections/rows/stitch-groups, `materialCrafts` for
per-craft gauge) can be ported into TypeScript types rather than redesigned. `reference/example
pattern.pdf` (gitignored) is a sample real-world pattern, useful as a fixture once AI pattern
import is built.

## Layout

- `src/app/` — Expo Router file-based routes. Router root is `src/app` (see `expo.router` config),
  not the top-level `app/` some older Expo docs assume.
- `src/components/` — shared UI. Platform-specific files use `.web.tsx` suffix (e.g.
  `app-tabs.tsx` for native, `app-tabs.web.tsx` for web) — Metro resolves the right one per platform.
- `src/constants/theme.ts` — Knitwit's design tokens (`Colors`, `Fonts`, `Spacing`, `Radii`),
  ported directly from `reference/index.html`'s CSS `:root` variables. Single fixed palette, no
  dark mode (the original never had one) — don't reintroduce light/dark branching.
- `supabase/migrations/` — versioned SQL schema, applied identically across local/staging/prod
  Supabase projects. `supabase/functions/` — Edge Functions (e.g. the future GreenPT-backed
  AI pattern generation/import endpoints — must stay server-side, never call GreenPT from the client).

## Conventions

- TypeScript strict mode is on — keep it on.
- Path alias `@/*` maps to `src/*` (see `tsconfig.json`).
- Use `ThemedText`/`ThemedView` (`src/components/themed-*.tsx`) for anything that should follow
  the Knitwit palette/type scale, rather than hardcoding colors or fonts inline.
- Screen scaffolds under `src/app/*.tsx` are currently placeholders (`PlaceholderScreen`) for
  Library, Counter, Materials, Account — replace their contents with real features screen by
  screen; don't restructure the route files themselves without reason.

## Commands

- `npm run typecheck` — `tsc --noEmit`, run after any non-trivial change.
- `npm run lint` — ESLint via `expo lint`.
- `npm test` — Jest (`jest-expo` preset + `@testing-library/react-native`); prioritize testing
  pure logic (counter math, gauge calculations) over UI snapshot tests.
- `npm run web` — local dev server. `npx expo export --platform web` — static build (what Vercel
  deploys) — good smoke test that routing/rendering actually works end to end.
- `npx eas-cli@latest build --profile <development|preview|production>` — cloud iOS build (see
  `eas.json`). Requires `eas login` first (interactive; not something an agent can do headlessly).
