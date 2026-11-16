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

// The drawings carry `role="img"` and an `aria-label` on their own <svg>, which is right for the
// loose files in brand-kit and wrong here twice over. react-native-svg hands them to the DOM as
// `ariaLabel`, which is not an attribute and which React warns about on every empty screen; and
// the view around the drawing already decides whether a screen reader hears it, so a label inside
// a hidden wrapper is a contradiction. Stripped once per drawing, at first use.
const cleaned = new Map<IllustrationName, string>();
function markup(name: IllustrationName): string {
  let xml = cleaned.get(name);
  if (xml === undefined) {
    xml = ILLUSTRATIONS[name].replace(/^<svg\b[^>]*>/, (tag) =>
      tag.replace(/\s(?:role|aria-label)="[^"]*"/g, ''),
    );
    cleaned.set(name, xml);
  }
  return xml;
}

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
      <SvgXml xml={markup(name)} width={width} height={width * 0.8} />
    </View>
  );
}
