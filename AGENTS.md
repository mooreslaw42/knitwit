# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Knitwit

A knitting/crochet companion app: row/stitch counter, pattern library, project tracker,
gauge calculator, materials & tools manager. One Expo (React Native + React Native Web)
codebase targets iOS (TestFlight via EAS Build), and web (static export via
`expo export --platform web`). Feature plans live in `docs/plans/`.

## Reference material

`reference/index.html` and `reference/knitwit-mockups.html` are the original static HTML/CSS/JS
demo this app is being ported from. They are not served or built — kept only so screens can be
diffed against the original for visual/functional parity, and so their existing data model
(`mkSec`/`mkR`/`mkG` builders for pattern sections/rows/stitch-groups, `materialCrafts` for
per-craft gauge) can be ported into TypeScript types rather than redesigned. `reference/example
pattern.pdf` (gitignored) is a sample real-world pattern, useful as a fixture once AI pattern
import is built.

`brand-kit/` is the design source of truth for the Knitwit identity: master logo SVGs, the 40
icons and 8 illustrations as loose SVGs, a `preview/brand-sheet.html` overview, and the Python
generators in `source/` that drew all of them. Like `reference/`, it is neither served nor built,
and it is excluded from `tsconfig.json` and ESLint — `source/handwritten/` holds generator inputs
that import data modules which only exist after codegen. The app-facing output already lives in
`assets/`, `public/` and `src/components/{logo,icons,illustrations,motion}/`; regenerating does
not update those, so copy changed files across by hand. See `brand-kit/IMPLEMENTATION.md`.

## Layout

- `src/app/` — Expo Router file-based routes. Router root is `src/app` (see `expo.router` config),
  not the top-level `app/` some older Expo docs assume.
- `src/components/` — shared UI. Platform-specific files use `.web.tsx` suffix (e.g.
  `app-tabs.tsx` for native, `app-tabs.web.tsx` for web) — Metro resolves the right one per platform.
- `src/constants/theme.ts` — Knitwit's design tokens (`Colors`, `Fonts`, `Spacing`, `Radii`),
  ported directly from `reference/index.html`'s CSS `:root` variables. Single fixed palette, no
  dark mode (the original never had one) — don't reintroduce light/dark branching.
- `supabase/migrations/` — versioned SQL schema, applied identically across local/staging/prod
  Supabase projects. `supabase/functions/` — Edge Functions, including the AI pattern parser.
  **The model is only ever called server-side**; the app ships to the web, so a client-side key
  would be public. Two providers sit behind one seam
  (`supabase/functions/parse-pattern/provider.ts`), picked with the `AI_PROVIDER` secret:
  **GreenPT (EU Router)**, the intended one, via its OpenAI-compatible endpoint; and the
  **Anthropic API**, which was built first. See `supabase/functions/README.md`.

## Screens and navigation

- **Five tabs: Home, Projects, Counter, Library, Calculator.** An iPhone tab bar holds five; a
  sixth is replaced by "More" and a system list. Don't add one. Account is a pushed screen
  (`src/app/account.tsx`) opened from the avatar on Home, and from the end of the nav bar on a
  wide web window. The web keeps the same five in the same order — `src/components/web-nav.tsx`
  is the one list, and it sits along the bottom below `PhoneNavBelow`, across the top above it.
- **Every screen stands in `Screen`** (`src/components/screen.tsx`): `kind="tab"` for the five
  tabs, `kind="pushed"` for everything on the root stack, `kind="wizard"` for the three wizards
  that draw their own top row with `WizardHeader`. It owns the safe area, the gutter, the max
  width and the scroll, so a new screen cannot get them subtly wrong. A tab's title is a
  `ScreenHeader`; a group heading is a `SectionHeader`. The only screens outside it are the
  counter (which lays itself out to the full height) and the sign-in gates.
- **From a pushed screen, the counter is reached with `goToCounter(router)`** (`src/lib/navigation.ts`),
  never `router.push('/counter')`. The counter is a tab; pushing it from the root stack stacks a
  second copy of the whole tab navigator. The root layout's `unstable_settings.anchor` keeps the
  tabs underneath a screen opened cold from a link.
- **A wizard passes its step to `Screen` as `scrollResetKey`** so each step opens at its top.
  `Screen`'s scroll view also keeps the focused field above the keyboard — don't add a second
  keyboard-avoiding wrapper inside it.
- **No photo means knitted, not blank**: `Thumb` and the detail heroes draw `KnitTexture` in the
  item's own colour when there is no picture.
- **The counter keeps the screen on** while it is focused (`useKeepAwakeWhileFocused`), unless
  the knitter turns it off in Account (`settings.keepScreenOn`).
- **A pushed screen has the native header by default** (`DETAIL_SCREEN` in `src/app/_layout.tsx`).
  Only screens that draw their own top row opt out, by name, with `NO_HEADER`. It used to be the
  other way round and four screens were missed.
- **One primary action per screen.** The filled pink `PillButton` is "the thing to do next":
  Continue knitting on Home and on a project, Start a project on a pattern, the pinned
  Continue counting on a section. "Add" in a tab header is the round `IconButton`; an action in a
  section heading is text. Filters are `Chip`s in a `ChipRow` and are ink when selected — never
  the primary pink. A chip that has to be drawn by hand wears `ChipStyle`/`ChipSelectedStyle`.
- **A project's state has one set of words**: `PROJECT_STATUS_LABELS` (On the needles, Finished,
  Frogged), read through `projectState()`. Badges, filters and the hero all use them.
- Type scale is in `ThemedText`: `largeTitle` names a tab, `title` a pushed screen, `subtitle` a
  group; `body`/`default` are read; `caption` is supporting copy of a sentence or more; `small`
  is a one-line detail; `overline` labels a group. List rows wear `RowSurface`; depth comes from
  `Shadows` in the theme, not from ad-hoc borders.

## Conventions

- TypeScript strict mode is on — keep it on.
- Path alias `@/*` maps to `src/*` (see `tsconfig.json`).
- Use `ThemedText`/`ThemedView` (`src/components/themed-*.tsx`) for anything that should follow
  the Knitwit palette/type scale, rather than hardcoding colors or fonts inline.
- Every screen is built — Library, Counter, Projects, Calculator, Account and the detail routes
  under them. Don't restructure the route files without reason.
- A route named `new` needs its own file. `material/new.tsx` and `technique/new.tsx` exist because
  `[id].tsx` would otherwise catch `/material/new` and treat "new" as an id — which is exactly
  what happened to techniques, and it wrote a technique called "new" into people's libraries.
  `tool/[id].tsx` handles it the other way, with an `isNew` branch; either is fine, neither being
  present is not.
- Charts, the counter and the stitch editor read `section.rows` for the drawing and
  `section.totalRows` for the count. They are separate fields on purpose (a pattern may chart an
  8-row repeat of a 60-row section), but the count is never allowed below the chart — see
  `atLeastCharted`.

## Working in Claude Code

- `.claude/settings.json` is shared: the Expo plugin, an allowlist for the check commands, and a
  SessionStart hook that runs `npm install` when `node_modules` is missing (a fresh worktree).
- `.worktreeinclude` lists the gitignored files a new worktree still needs (`.env*`,
  `.claude/settings.local.json`, `.vercel/`). Without the Supabase env the app cannot sign in.
- `.claude/launch.json` defines the `web` dev server for the Browser pane.
- **There is no iOS Simulator unless full Xcode is installed** (Command Line Tools are not
  enough). Without it, check UI in the web build at phone width — the bottom nav and the layout
  are the same components — and bundle for iOS with `npx expo export --platform ios` to catch
  anything that only breaks under the native file resolution.

## Commands

- `npm run typecheck` — `tsc --noEmit`, run after any non-trivial change.
- `npm run lint` — ESLint via `expo lint`.
- `npm test` — Jest (`jest-expo` preset + `@testing-library/react-native`); prioritize testing
  pure logic (counter math, gauge calculations) over UI snapshot tests. Device storage is mocked
  once in `jest.setup.js`, so a test can import the UI kit without mocking the photo store. Render tests earn their
  place where a mistake is only visible on screen — see `charts.test.tsx` and
  `src/__tests__/app/pattern/new.test.tsx`. Tests sit beside what they test, **except tests of a
  route screen**, which mirror the route path under `src/__tests__/app/` — anything ending `.tsx`
  under `src/app` becomes a route (Expo Router only excludes `+api`/`+middleware`/`+html`/
  `+native-intent`), and a test file as a route breaks `npm run web` outright. Two things bite:
  **`render` is async here**, so `await render(...)`
  or `screen` stays empty and every query fails with "render function has not been called"; and
  anything reaching `knitwit-ui` pulls in Reanimated, which needs the
  `react-native-worklets/jest/resolver.js` resolver already set in `package.json` — without it Jest
  loads worklets' `.native.ts` files and the import throws.
- `npm run web` — local dev server. `npx expo export --platform web` — static build (what Vercel
  deploys) — good smoke test that routing/rendering actually works end to end.
- `npx eas-cli@latest build --profile <development|preview|production>` — cloud iOS build (see
  `eas.json`). Requires `eas login` first (interactive; not something an agent can do headlessly).
