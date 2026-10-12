import { View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { LOGO_SVGS, type LogoVariant } from './logo-svgs';

const ratios = Object.fromEntries(
  Object.entries(LOGO_SVGS).map(([key, xml]) => {
    const [, , w, h] = /viewBox="([^"]+)"/.exec(xml)![1].split(/\s+/).map(Number);
    return [key, w / h];
  }),
) as Record<LogoVariant, number>;

type Props = {
  /** 'lockup' (mark + wordmark) is the default; 'mark' for square spots. */
  variant?: LogoVariant;
  /** Height in dp; width follows the artwork's proportions. */
  height?: number;
  /** Pass true when the word "Knitwit" is already announced nearby (e.g. a heading). */
  decorative?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function KnitwitLogo({ variant = 'lockup', height = 32, decorative, style }: Props) {
  return (
    <View
      style={style}
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={decorative ? undefined : 'Knitwit'}
      aria-hidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}>
      <SvgXml xml={LOGO_SVGS[variant]} height={height} width={height * ratios[variant]} />
    </View>
  );
}
