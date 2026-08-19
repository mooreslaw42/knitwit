# Knitwit

A knitting/crochet companion app — row/stitch counter, pattern library, project tracker,
gauge calculator, and materials/tools manager. One Expo (React Native + React Native Web)
codebase, targeting iOS (via TestFlight) and web.

See [AGENTS.md](./AGENTS.md) for project conventions and layout, and the build-out plan at
`/Users/pim/.claude/plans/currently-knitwit-is-just-noble-umbrella.md` for the phased roadmap
(TestFlight milestone → Supabase backend → environments → GreenPT-powered AI pattern
generation/import → web deploy).

## Getting started

```bash
npm install
npm run web    # or: npm run ios / npm run android
```

## Commands

- `npm run typecheck` — TypeScript, no emit
- `npm run lint` — ESLint
- `npm test` — Jest
- `npx expo export --platform web` — static web build (what gets deployed to Vercel)
- `npx eas-cli@latest build --profile <development|preview|production>` — cloud iOS build (`eas login` required first)

## Reference

`reference/` holds the original static HTML/CSS/JS demo this app is being ported from — kept
for screen-by-screen visual/functional parity checks, not served or built.
