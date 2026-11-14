/**
 * Knitwit design tokens, ported from the original reference/index.html mockup's
 * `:root` CSS variables and font choices — see reference/index.html for the source.
 */

import { Platform } from 'react-native';

export const Colors = {
  // ## The four -Deep shades and inkSoft carry text, and until now none of them could be read
  //
  // WCAG AA asks 4.5:1 of ordinary text. The palette managed 9.9:1 for body copy on cream and then
  // fell over everywhere else: white on the primary button was 2.5:1, link green 2.7:1, the warning
  // orange 2.8:1. Not marginal — roughly half of what is needed, on the button every knitter
  // presses and the colour reserved for telling somebody something has gone wrong.
  //
  // Each of these does two jobs: a background with white text on it, and text on cream. Both want
  // the same thing, which is darker, so one shade satisfies both and every call site is unchanged.
  // Hue and saturation are held; only lightness moved, so they are the same colours, further down.
  //
  //   blushDeep  #E58AA0 -> #D23259   white 2.48 -> 4.84   on cream 2.31 -> 4.52
  //   sageDeep   #7FA06D -> #5E794F   white 2.94 -> 4.86   on cream 2.74 -> 4.53
  //   coralDeep  #DE7C46 -> #B65621   white 2.97 -> 4.84   on cream 2.77 -> 4.52
  //   inkSoft    #8A7873 -> #7F6E6A   text only            on cream 3.91 -> 4.52
  //
  // If a shade is ever changed again, check it both ways before it ships.
  cream: '#FDF6EF',
  creamDeep: '#F7EBDD',
  blush: '#F4C6D3',
  blushDeep: '#D23259',
  sage: '#B9CFAD',
  sageDeep: '#5E794F',
  lavender: '#D9C9EA',
  lavenderDeep: '#A985CC',
  coral: '#F0A67E',
  coralDeep: '#B65621',
  butter: '#F6E2A6',
  butterDeep: '#E2B84A',
  ink: '#4A3B38',
  inkSoft: '#7F6E6A',
  white: '#FFFFFF',
} as const;

export type ThemeColor = keyof typeof Colors;

// Quicksand: headings, numbers, stat labels. Nunito: body copy.
export const Fonts = {
  headingRegular: 'Quicksand_500Medium',
  headingSemibold: 'Quicksand_600SemiBold',
  headingBold: 'Quicksand_700Bold',
  bodyRegular: 'Nunito_400Regular',
  bodySemibold: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_700Bold',
  bodyExtrabold: 'Nunito_800ExtraBold',
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radii = {
  small: 12,
  medium: 16,
  large: 24,
  pill: 999,
} as const;

// Depth, in the one place it is defined.
//
// White cards on a cream page are a 1.07:1 difference — close enough that a card's edge was being
// carried entirely by its corner radius, and a screen of them read as flat paper with rounded
// holes in it. One soft, warm shadow (ink, not black) is what separates "a thing you can pick up"
// from the page it sits on. `raised` is for the single element on a screen that is the next thing
// to do; if two things wear it, neither does.
export const Shadows = {
  card: { boxShadow: '0 1px 2px rgba(74, 59, 56, 0.04), 0 6px 18px rgba(74, 59, 56, 0.06)' },
  raised: { boxShadow: '0 2px 4px rgba(74, 59, 56, 0.06), 0 14px 32px rgba(74, 59, 56, 0.12)' },
} as const;

// The page gutter. Every screen's content starts this far from the edge, so moving between tabs
// never shifts the left margin — it was 24 on most screens and 16 or 0 on a few.
export const ScreenPadding = Spacing.four;

// Room at the foot of a tab screen's scroll for the tab bar to float over.
export const TabBarClearance = Spacing.six * 2;

// Below this the web build is a phone: the navigation moves to a bar along the bottom, where a
// thumb is, the way it sits on iOS. Above it there is room for the bar across the top.
export const PhoneNavBelow = 600;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

// Below this window width the web nav bar shows icons only (labels stay for screen readers): six
// labelled tabs and the logo no longer fit beside each other.
//
// The nav lives inside the MaxContentWidth (800px) cap, and the logo plus the six labels measure
// ~790px of that — so they only genuinely fit once the window is wide enough for the full 800
// (content + 16px padding each side + room for a scrollbar). The old 760 was below that, which
// left a band where the labelled nav overflowed the bar and the right-hand tabs were clipped or
// crushed. Switch to icons earlier, where they actually stop fitting.
export const CompactNavBelow = 860;

// Cap on a free-text name the app later shows in a chip, a swatch caption or a card title.
// Enforced where the text is entered and where it's imported, so nothing longer ever reaches a
// layout that can't hold it. An imported yarn slot arrived at over a hundred characters — the
// model had packed the weight, fibre and per-size yardage into the name — and ran off the card.
// Truncation at render is still the backstop (a chip is narrower than 60 characters on a phone);
// this stops the data being unreasonable in the first place.
export const MaxNameLength = 60;
