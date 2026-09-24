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

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

// Cap on a free-text name the app later shows in a chip, a swatch caption or a card title.
// Enforced where the text is entered and where it's imported, so nothing longer ever reaches a
// layout that can't hold it. An imported yarn slot arrived at over a hundred characters — the
// model had packed the weight, fibre and per-size yardage into the name — and ran off the card.
// Truncation at render is still the backstop (a chip is narrower than 60 characters on a phone);
// this stops the data being unreasonable in the first place.
export const MaxNameLength = 60;
