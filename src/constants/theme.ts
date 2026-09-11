/**
 * Knitwit design tokens, ported from the original reference/index.html mockup's
 * `:root` CSS variables and font choices — see reference/index.html for the source.
 */

import { Platform } from 'react-native';

export const Colors = {
  cream: '#FDF6EF',
  creamDeep: '#F7EBDD',
  blush: '#F4C6D3',
  blushDeep: '#E58AA0',
  sage: '#B9CFAD',
  sageDeep: '#7FA06D',
  lavender: '#D9C9EA',
  lavenderDeep: '#A985CC',
  coral: '#F0A67E',
  coralDeep: '#DE7C46',
  butter: '#F6E2A6',
  butterDeep: '#E2B84A',
  ink: '#4A3B38',
  inkSoft: '#8A7873',
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
