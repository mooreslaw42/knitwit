import { SvgXml } from 'react-native-svg';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { ILLUSTRATIONS, type IllustrationName } from './illustration-data';

export type { IllustrationName };

type Props = {
  name: IllustrationName;
  /** Width in dp; height follows the 5:4 artboard. */
  width?: number;
  /** Set when the picture adds information the surrounding text doesn't. Hidden otherwise. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function Illustration({ name, width = 200, accessibilityLabel, style }: Props) {
  const labelled = !!accessibilityLabel;
  return (
    <View
      style={style}
      accessible={labelled}
      accessibilityRole={labelled ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      aria-hidden={!labelled}
      importantForAccessibility={labelled ? 'yes' : 'no-hide-descendants'}>
      <SvgXml xml={ILLUSTRATIONS[name]} width={width} height={width * 0.8} />
    </View>
  );
}
