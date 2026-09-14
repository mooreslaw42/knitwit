import { StyleSheet, Text, type TextProps } from 'react-native';

import { Colors, Fonts, type ThemeColor } from '@/constants/theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'subtitle' | 'small' | 'smallBold' | 'code';
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
        type === 'title' && styles.title,
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
  title: {
    fontFamily: Fonts.headingBold,
    fontSize: 26,
    lineHeight: 32,
  },
  subtitle: {
    fontFamily: Fonts.headingBold,
    fontSize: 17,
    lineHeight: 22,
  },
  small: {
    fontFamily: Fonts.bodyBold,
    fontSize: 11.5,
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
