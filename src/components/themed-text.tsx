import { StyleSheet, Text, type TextProps } from 'react-native';

import { Colors, Fonts, type ThemeColor } from '@/constants/theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'subtitle' | 'small' | 'smallBold' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  return (
    <Text
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
