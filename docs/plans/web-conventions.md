# Knitwit — Making the web build behave like a website

**Status: W1–W3 built 2026-09-14. W4 (layout) outstanding.** Written from a measured audit of
the running web build rather than a reading of the code.

Decided by survey: **full scope, layout included**, and the app should be **mobile-shaped by
default but honour every web convention that doesn't fight that** — wider layouts only where a
screen genuinely has two columns of content.

## What is already right

Worth recording, because it narrows the work:

- **Browser Back and Forward work.** `/project/meadow` → back → `/projects`, verified against the
  history stack. `goBackOr` already handles the no-history case.
- **Deep links and hard refresh work.** The SSR problems were solved earlier.
- **The six nav items are real anchors** with real `href`s — expo-router's `TabTrigger` renders
  `<a>`.
- **Everything interactive is keyboard-focusable** — 25 focusable elements on `/projects`.
- `lang="en"` and the viewport meta are set, text is selectable, cursors are `pointer`, and there
  is a 404 page.

## What is broken, measured

| # | Finding | Evidence |
|---|---|---|
| 1 | The logo is not a link | Plain `ThemedText` in `app-header.web.tsx` and `app-tabs.web.tsx` |
| 2 | No page titles at all | `document.title === ''` on every route |
| 3 | No headings | 0 × `h1`/`h2`/`h3` on any page; `ThemedText type="title"` is a styled `div` |
| 4 | Cards are not links | `/projects` has exactly 6 anchors — the nav. Rows are `div` + `onPress` |
| 5 | Nothing has a role | 0 × `<button>`; every focusable reports `role: null` |
| 6 | Icon-only controls unnamed | The ✎ edit control is the bare character, `aria-label: null` |
| 7 | No hover states | Pressables dim on press; nothing responds to the mouse |
| 8 | No sharing metadata | No description, no `theme-color`, no OG/Twitter tags |

Number 4 is the structural one. Without it there is no ⌘-click, no middle-click, no right-click →
copy link, and no URL preview on hover — which is most of what separates a website from an app
that happens to render in a browser.

## The work

### W1 — The cheap mechanical wins

- `Brand` component wrapping the logo in `<Link href="/">`, used by both web nav components.
- Per-route titles through `<Stack.Screen options={{ title }}>`, plus dynamic ones on the detail
  screens ("Meadow Cardigan · Knitwit"). Expo Router maps this to `document.title` on web.
- Meta description, `theme-color`, and OG/Twitter tags in the HTML template.
- `accessibilityRole="button"` and `accessibilityLabel` on every Pressable that has no text of its
  own. Mechanical, but it is the difference between "✎" and "Edit this project".

### W2 — Semantics

- A `heading` prop on `ThemedText` rendering `role="heading"` + `aria-level` on web and staying a
  plain `Text` on native. One `h1` per screen, then `h2` for card titles.
- Hover states folded into `PillButton`, `Card` and the row components via `onHoverIn`/`onHoverOut`,
  so it is one change rather than fifty.

### W3 — Real links

A `CardLink` built on `<Link asChild>` so a row renders as an anchor and keeps its current look.
Then convert, in order of how often they're shared: project rows, pattern cards, technique rows,
section rows, the Home "continue" tile.

This is the one with real risk: it touches every list screen, and `Link asChild` changes the
element that receives the style. Worth doing one screen first and looking at it before the rest.

### W4 — Layout, where a screen has two columns of content — **not built**

Decided by survey, 2026-09-14, with "quite a lot of iPad users in browser" as the driving context:

- **Breakpoint 1100px.** iPad portrait (820–834, or 1024 on the 13") keeps one column; every iPad
  in landscape (1180–1366) gets two, as does desktop. Rotation is therefore a real layout change.
- **Two columns of the same rows**, not master–detail. Master–detail is the better tablet idiom
  and is deferred as its own piece, because detail screens are separate routes today and turning
  them into panes has URL and back-button consequences worth thinking through on their own.
- **The Counter scales up on a big screen and gains the chart beside it** — bigger number, bigger
  button, chart in the space to the side rather than above. It stays centred.
- **The stitch editor is in scope.**

`MaxContentWidth` is 800px. On a 1500px display everything is a narrow ribbon with empty space
either side. But the answer is not "make it wider" — a list of rows at 1400px is worse to read,
not better. The answer is a second column only where there are genuinely two things to look at.

Per screen, and this is the part most worth arguing with:

| Screen | Proposal |
|---|---|
| **Counter** | **Unchanged.** One number, two big buttons, held one-handed. Widening it would be a mistake. |
| **Calculator** | Two columns of cards on wide screens. Six self-contained cards is exactly the case for it, and it is the clearest win of the lot. |
| **Awards** | Grid the award cards within each group. Currently one per row for 37 awards. |
| **Projects / Library lists** | Two columns of rows above ~1100px. Library patterns already grids; the others don't. |
| **Pattern & project detail** | Two columns: the details and notes on one side, sections on the other. Sections are the thing you came for and they're currently below the fold. |
| **Stitch editor** | The biggest win and the biggest job: chart on one side, row list on the other, chart staying put as you scroll the rows. Today you scroll away from the chart to edit the row it is showing. |
| **Wizards & forms** | **Unchanged.** A form wants one column at reading width whatever the screen. |

Mechanically this wants a `useBreakpoint()` hook and a `Columns` component rather than
`MaxContentWidth` being bumped, so each screen opts in and native is unaffected.

## Order

W1 first — it is small, safe, and fixes the two most visible things. W2 next. Then W4's Calculator
and Awards, which are contained. W3 and the detail-screen layouts last, since they touch the most
and want looking at rather than just testing.
