import { StyleSheet, Text, type TextProps } from 'react-native';

import { Colors, Fonts, type ThemeColor } from '@/constants/theme';

export type ThemedTextProps = TextProps & {
  // The scale, largest to smallest. `largeTitle` names a tab; `title` names a pushed screen or the
  // one thing on it; `subtitle` heads a group; `default` and `body` are what is read; `caption` is
  // supporting copy a sentence or longer; `small` is a label or a one-line detail; `overline`
  // names a field or a group in passing.
  //
  // `caption` exists because `small` was doing two jobs. At 11.5 it is right for "row 24 of 60"
  // and wrong for a paragraph, and whole screens of explanation were set in it.
  type?:
    | 'default'
    | 'largeTitle'
    | 'title'
    | 'subtitle'
    | 'body'
    | 'caption'
    | 'small'
    | 'smallBold'
    | 'overline'
    | 'code';
  themeColor?: ThemeColor;
  // Marks this text as a heading, and at what depth. On web it becomes a real heading for screen
  // readers, reader mode and search engines; on native it is announced as a header and otherwise
  // renders identically.
  //
  // Separate from `type` on purpose. `type` is how the text looks and `heading` is what it means,
  // and they genuinely come apart: a card's label is styled small but is structurally an h2, and
  // plenty of title-sized text is not a heading at all.
  heading?: 1 | 2 | 3;
};

export function ThemedText({
  style,
  type = 'default',
  themeColor,
  heading,
  ...rest
}: ThemedTextProps) {
  return (
    <Text
      // react-native-web turns these into <h1>/<h2>/<h3>; React Native reads the same two props
      // through its accessibility layer.
      accessibilityRole={heading ? 'header' : rest.accessibilityRole}
      aria-level={heading}
      style={[
        { color: Colors[themeColor ?? 'ink'] },
        type === 'default' && styles.default,
        type === 'largeTitle' && styles.largeTitle,
        type === 'title' && styles.title,
        type === 'body' && styles.body,
        type === 'caption' && styles.caption,
        type === 'overline' && styles.overline,
        type === 'subtitle' && styles.subtitle,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 16,
    lineHeight: 22,
  },
  largeTitle: {
    fontFamily: Fonts.headingBold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.4,
  },
  title: {
    fontFamily: Fonts.headingBold,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.2,
  },
  body: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 15,
    lineHeight: 21,
  },
  caption: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 13,
    lineHeight: 18,
  },
  overline: {
    fontFamily: Fonts.bodyExtrabold,
    fontSize: 11.5,
    lineHeight: 16,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontFamily: Fonts.headingBold,
    fontSize: 17,
    lineHeight: 22,
  },
  small: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    lineHeight: 16,
  },
  smallBold: {
    fontFamily: Fonts.bodyExtrabold,
    fontSize: 13.5,
    lineHeight: 18,
  },
  code: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 12,
  },
});
