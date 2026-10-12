# Knitwit brand kit

This kit swaps Expo's template icons for a real Knitwit identity and adds icons, illustrations and animations. It is built on the existing palette in `src/constants/theme.ts`. The app's UI fonts and colours stay as they are; only the logo uses a new typeface, and it's converted to outlines, so the app doesn't load an extra font.

**The idea: arts & crafts, not cute.**

- **The mark is a swatch.** A knit stitch is a V made of two loops. Columns of Vs make stockinette, the fabric most sweaters are made of. The mark is a 2 × 3 swatch of it: cream stitches carved out of madder red (`coralDeep`), like a linoblock print.
- **The wordmark** is set in Young Serif, a sturdy woodtype-style serif, and converted to outlines.
- **A woven label**, like the tags knitters sew into finished pieces, works as a badge for merch, the link preview and the website.
- **Illustrations** are linocut-style still lifes of the tools of the trade, in flat natural-dye colours with carved highlights. There are no faces and no hearts.

Open `preview/brand-sheet.html` in a browser to see everything, including the live animations.


---

## 1. Status: applied

This kit is **already applied to the app**. The identity, icons, illustrations and motion
components all live in `src/` and `assets/`, and `expo-haptics` is in `package.json`. There is
nothing to run — the sections below are reference for working with what's there.

What this directory keeps is the **design source of truth**: the master logo files, the loose
icon and illustration SVGs, the preview sheet, and the generators that drew all of it. Nothing
here is served or built, the same arrangement as `reference/`.

The kit originally shipped a `repo/` folder and a `knitwit-brand.patch`. Both are gone: the
files in `repo/` are in their real places in the repo now, and the patch was written against an
older checkout and no longer applied cleanly — the edits were ported by hand instead. Section 3
describes what they became.

---

## 2. What's in the kit

```
brand-kit/
├── IMPLEMENTATION.md            ← this file
├── preview/brand-sheet.html     ← visual overview of everything, including the live animations
├── logo/                        ← master logo files (SVG) + PNG exports
├── icons/svg/                   ← the 40 icons as loose SVGs (Figma, web, docs)
├── illustrations/svg/           ← the 8 illustrations as loose SVGs
└── source/                      ← the generator that drew all of the above (see section 8)
```

The app-facing files these produced now live in the repo proper:

```
assets/knitwit.icon/             ← iOS 26 Liquid Glass icon (Icon Composer bundle)
assets/images/                   ← icon.png, Android adaptive set, splash, favicon.png
public/                          ← favicon.ico + /brand/* (svg favicon, touch icon, PWA icons, manifest, OG image)
src/app/+html.tsx                ← web <head>: favicons, manifest, theme colour, link previews
src/components/logo/             ← KnitwitLogo
src/components/icons/            ← KnitIcon + icon data
src/components/illustrations/    ← Illustration, EmptyState, YarnSkein, yarn-colors
src/components/motion/           ← PressableScale, RowCount, Confetti, ProgressRing, SaveToggle, …
```

### Logo files (`logo/`)

| File | Use it for |
|---|---|
| `knitwit-mark.svg` | Default mark: a 2 × 3 swatch, cream on madder. 48px and up. |
| `knitwit-mark-small.svg` | 2 × 2 swatch with bigger stitches, for below 48px (favicons, tiny badges). |
| `knitwit-mark-reversed.svg` | Madder stitches on a cream tile, for dark or busy backgrounds. |
| `knitwit-mark-ink.svg` / `-white.svg` | One colour, stitches knocked out (transparent). Print, embossing, laser-cut, photos. |
| `knitwit-stitches.svg` | The stitches without a tile. Use for patterns, borders and decoration. |
| `knitwit-wordmark*.svg` | The word on its own: ink, white or cream. |
| `knitwit-lockup.svg` | **Main logo**: mark + wordmark side by side. |
| `knitwit-lockup-stacked.svg` | Mark above the wordmark. Square spaces, posters. |
| `knitwit-lockup-ink/-white/-reversed.svg` | Single-colour and dark-background versions of the lockup. |
| `knitwit-label.svg` / `-cream.svg` | The woven label with a running-stitch border. Merch, stickers, social, a sew-in tag. |

---

---

## 3. What changed in the existing app

| File | Change |
|---|---|
| `app.json` | `ios.icon` → `./assets/knitwit.icon`. Android adaptive background → madder `#DE7C46`. Splash → cream `#FDF6EF` with the mark. Removes `web.favicon` (now served from `public/`). |
| `middleware.ts` | The matcher skips `/brand/*` and `/favicon.ico`, so favicons and link previews work before the password gate. |
| `src/app/_layout.tsx` | `SplashScreen.setOptions({ duration: 400, fade: true })`: the cream splash fades into the cream app (iOS only). |
| `src/app/+html.tsx` | Favicons, web manifest, theme colour and Open Graph tags for link previews. |
| `src/components/sign-in-gate.tsx` | The real logo instead of `🧶 Knitwit`. |
| `src/components/brand.tsx` | Renders `KnitwitLogo` rather than emoji + text. |
| `src/components/app-header.web.tsx` | Knitwit icons in the web header. |
| `src/components/app-tabs.tsx` | **Android tab icons** (`md="home"`, `folder`, `menu_book`, `exposure_plus_1`, `calculate`, `account_circle`); Android had none. Icon colours: inkSoft, ink when selected. |
| `src/components/app-tabs.web.tsx` | Logo lockup instead of emoji text, a Knitwit icon on every tab, and a compact mode below `CompactNavBelow` (icon-only tabs, labels kept for screen readers) so six tabs and the logo don't collide. |
| `src/components/knitwit-ui.tsx` | `ProgressBar` fills up smoothly via `AnimatedProgressBar`. `PillButton` gets the press animation. Same props. |
| `src/constants/catalogs.ts` | `TOOL_ICONS` maps to icon names instead of emoji. |
| `src/constants/theme.ts` | Adds `CompactNavBelow`, the width where the web nav switches to icons only. |
| `src/app/(tabs)/library.tsx` | `♥/♡` → a bookmark icon; yarn rows show a `YarnSkein` tinted from the colour name ("Sage Green" → sage). |
| `src/app/(tabs)/counter.tsx` | The big one, see below. |
| `assets/expo.icon/` | Deleted — replaced by `assets/knitwit.icon/`. |

**Counter changes in detail**

- The row number is `RowCount`. Counting up, the new number rises in from below; counting down, it drops in from above.
- +/− and −5/−10 are `PressableScale`: they sink while held and give a light haptic tap on every row. The + and − are drawn icons.
- The alert cards (note, stitch marker, cast off, complete) use Knitwit icons instead of 📝📍🧶🎉.
  - The stitch marker row and the last row play a warning **nudge**, so you notice without looking up from your needles.
  - "Section complete!" plays a success haptic and drops snipped yarn ends and felt scraps (`Confetti`).
- The timer pill has a play/pause icon and a softly pulsing dot while it runs (`TimerPulse`).
- "Nothing to count yet" is an `EmptyState` showing a needle with only its cast-on row.

**Built but not placed yet:** `SaveToggle`, `ProgressRing` and `YarnLoader` are in
`src/components/motion/` and unused. The library's save control is a plain bookmark icon rather
than the animated `SaveToggle`. Also see section 7.
## 4. Platform checks after the native build

**iOS (Liquid Glass icon)**
- Open `assets/knitwit.icon` in **Icon Composer**: Xcode 26 → *Open Developer Tool* → *Icon Composer*. Check the Default, Dark, Clear and Tinted previews.
- The bundle is one stitch layer on an automatic madder gradient. Glass translucency is 0.2; adjust it to taste and save.

**Android**
- The adaptive icon is a madder background with the swatch inside the 66dp safe zone.
- On Android 13+, turn on *Themed icons* to check the monochrome stitches.

**Web**
- After deploying, the tab shows the swatch favicon and the login page shows the logo. "Add to Home Screen" uses the madder touch icon.
- `+html.tsx` points `og:image` at `https://knitwit.eu/brand/og-image.png`. If the site still runs on the `*.vercel.app` domain, change that URL until knitwit.eu points to Vercel.

---

## 5. Using the new components

All of them follow your conventions (`@/` imports, `Colors` tokens, strict TypeScript) and work with the React Compiler: shared values use `.get()`/`.set()`.

### Icons

```tsx
import { KnitIcon } from '@/components/icons/KnitIcon';

<KnitIcon name="needles-circular" />                                        // ink, soft tint
<KnitIcon name="stitch-marker" color={Colors.coralDeep} accent={Colors.coral} />  // duotone
<KnitIcon name="search" size={20} accessibilityLabel="Search" />            // label only when it stands alone
```

There are 40 names, all typed:

| Group | Icons |
|---|---|
| Navigation | home, library, counter, materials, account, yarn, pattern |
| Actions | plus, minus, check, close, back, forward, edit, trash, search, camera, barcode, settings, more, external, bookmark, bookmark-filled, play, pause, timer, sparkle |
| Counter moments | note, stitch-marker (a ring marker on a needle), cast-off, celebrate (a prize rosette) |
| Tools | needles-straight, needles-circular, needles-dpn, needles-interchangeable, crochet-hook, cable-needle, cable-pin, toolbox, gauge |

**Duotone rule:** stroke in a *deep* colour, fill in its *light* partner (coralDeep + coral, sageDeep + sage, lavenderDeep + lavender, butterDeep + butter). Use ink on its own for neutral UI.

### Illustrations and empty states

```tsx
import { EmptyState } from '@/components/illustrations/EmptyState';

<EmptyState
  illustration="no-projects"            // no-patterns | no-materials | no-tools | no-notes | nothing-here | celebrate | thinking
  title="No projects yet"
  message="Tap “+ New project” to cast on your first one."
  action={<PillButton onPress={…}><ThemedText …>+ New project</ThemedText></PillButton>}
/>
```

| Name | Scene |
|---|---|
| `no-projects` | Ball of yarn with two needles pushed through |
| `no-patterns` | Open pattern booklet with a stitch chart |
| `no-materials` | Empty woven basket |
| `no-tools` | Unrolled needle case |
| `no-notes` | Notebook and pencil |
| `nothing-here` | Needle with only a cast-on row |
| `celebrate` | Finished swatch pinned flat, with a rosette |
| `thinking` | Yarn unwinding into a chart |

`<Illustration name="…" width={160} />` gives you the picture on its own.

### Yarn placeholder

```tsx
<YarnSkein color={yarnSwatchColor(material.colorName)} size={56} />
```

When barcode lookup returns a real colour hex, pass that instead.

### Logo inside the app

```tsx
import { KnitwitLogo } from '@/components/logo/KnitwitLogo';

<KnitwitLogo />                              // lockup, 32 high
<KnitwitLogo variant="mark" height={56} />   // mark | markSmall | lockup | lockupStacked | wordmark | lockupInk | label
<KnitwitLogo decorative />                   // when "Knitwit" is already announced nearby
```

### Motion

```tsx
import { PressableScale, RowCount, Confetti, ProgressRing, SaveToggle,
         TimerPulse, YarnLoader, haptics, enterCard } from '@/components/motion';
```

| Component | What it does | Where it goes |
|---|---|---|
| `PressableScale` | Pressable that sinks while held and plays a haptic (`haptic="none"` to skip). | Primary buttons. Already on PillButton and the counter. |
| `RowCount` | Animated row number. | Counter (done), Section Detail. |
| `Confetti burstKey={…}` | Snipped yarn ends, knots and felt scraps. Parent needs `overflow: 'hidden'`. | Section complete (done), project finished. |
| `ProgressRing progress={0.7}` | The mockup's progress ring; animates on change. | **Not placed yet**: Project detail hero. |
| `AnimatedProgressBar` | Smooth-filling bar, used through `ProgressBar`. | Done. |
| `SaveToggle` | Bookmark toggle that dips when saved. | Library (done), pattern detail. |
| `TimerPulse running` | Pulsing dot. | Counter timer (done). |
| `YarnLoader label="Reading your pattern…"` | Ball of yarn rolling and unwinding. | **Not placed yet**: AI pattern import, Supabase sync. |
| `enterCard`, `exitCard`, `enterSoft`, `enterPop` | Reanimated layout presets for `<Animated.View entering={…}>`. | Cards, sheets, badges. |
| `haptics.tap/select/firm/nudge/success` | Knitwit's haptic vocabulary (no-op on web). | tap = row, select = toggle, firm = confirm, nudge = "look up", success = done. |

**Reduce Motion:** every piece checks the OS setting. Confetti is skipped, the presses dim instead of scaling, the number stops jumping, and the loader shows the static `thinking` illustration. Haptics and text still carry the meaning.

---

## 6. Brand rules (short)

- **Clear space** around the logo: at least one stitch width on all sides.
- **Minimum size:** lockup 96px wide. Below a 48px mark, switch to `knitwit-mark-small`.
- **Colours of the mark:** madder + cream, or the one-colour versions. Don't recolour the swatch in other palette colours; those belong to the illustrations and UI.
- **Typography:** Young Serif is for the logo and big display moments only (posters, the website hero). The app UI stays Quicksand + Nunito.
- **Illustrations** use flat palette colours with cream "carved" lines and an ink running stitch for thread. Keep them to objects; no faces, no hearts.
- **Motion** confirms an action and gets out of the way: springs, not bounces, and nothing that loops forever except the loader and the timer dot.

### Accessibility notes (existing palette)

The kit doesn't change the palette, but these contrast ratios are worth knowing:

| Pair | Ratio | Status |
|---|---|---|
| inkSoft `#8A7873` on cream | 3.9:1 | Below 4.5:1 for the small text it is used for. On creamDeep it is 3.6:1. |
| White on coralDeep (+ New, counter +) | 3.0:1 | OK for the big glyph, short of 4.5:1 for 13.5px labels. |
| White on blushDeep (pill buttons) | 2.5:1 | Below 3:1 for any text size. |
| White on sageDeep ("Marker set") | 2.9:1 | Below 3:1 for any text size. |

For AA without changing the look much, add text-safe partners and use them only behind or for text:

| Token | Value | Contrast |
|---|---|---|
| coralText | `#BD5922` | 4.6:1 with white |
| blushText | `#D43D61` | 4.5:1 with white |
| sageText | `#617E52` | 4.6:1 with white |
| inkSoftText | `#786864` | 4.5:1 on creamDeep |

---

## 7. Still open (small)

- **The app UI still uses blush pink** for active tabs, filter chips and pill buttons. Swapping those blush accents for madder (`coralDeep`) would match the new crafty brand better. Ask if you want that; it's a handful of style lines.
- The 🧶 in "Good evening, Pim 🧶" was kept. Swap it for `<KnitwitLogo variant="markSmall" height={24} decorative />` if you prefer.
- The web `<title>` is empty on every route (existing behaviour). Set screen titles, or add `<title>Knitwit</title>` to `+html.tsx`.
- `app.json` has `userInterfaceStyle: "automatic"` while the app is light-only. `"light"` keeps system UI light in dark mode.
- `ProgressRing` and `YarnLoader` are built but not placed yet.

---

## 8. Changing the brand later

Everything visual is generated from code in `source/`:

| File | What it generates |
|---|---|
| `gen/stitch.py` | Draws knit stitches |
| `gen/brand2.py` | The mark, wordmark, lockups and label |
| `gen/icons.py` | The 40 icons |
| `gen/illus2.py` | The illustrations |
| `gen/build.py` | Writes every output file |

To change a colour, the stitch count, an icon or a scene, edit the relevant file and run:

```bash
cd brand-kit/source && ./regenerate.sh   # needs python3 + fonttools, node + playwright, ImageMagick
```

It reproduces the delivered files exactly. Young Serif (SIL Open Font License) is included in `source/fonts/`.

`logo/`, `icons/`, `illustrations/` and `source/` are the design source of truth. Regenerating
rewrites those; copy any changed app-facing file into its place in `src/`, `assets/` or `public/`
by hand, since nothing here is wired into the build.
