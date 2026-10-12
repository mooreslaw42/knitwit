import { memo } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { Colors } from '@/constants/theme';

import { KNIT_ICONS, type IconPart, type KnitIconName } from './knit-icon-data';

export type { KnitIconName };

type Props = {
  name: KnitIconName;
  /** Rendered size in dp. The art is drawn on a 24px grid. */
  size?: number;
  /** Stroke colour (and solid fills). */
  color?: string;
  /**
   * Duotone fill colour. Pair a deep palette colour with its light partner for the Knitwit look,
   * e.g. color={Colors.coralDeep} accent={Colors.coral}. Defaults to `color` at 20% opacity.
   */
  accent?: string;
  /**
   * Give icons that carry meaning on their own (icon-only buttons have their label on the button
   * instead) a label. Without one the icon is hidden from screen readers.
   */
  accessibilityLabel?: string;
};

// 'x="5" rx="4" transform="rotate(45 16 6)"' -> { x: '5', rx: '4', transform: 'rotate(45 16 6)' }
const attrCache = new Map<string, Record<string, string>>();
function parseAttrs(src: string) {
  let parsed = attrCache.get(src);
  if (!parsed) {
    parsed = {};
    for (const [, key, value] of src.matchAll(/([\w-]+)="([^"]*)"/g)) parsed[key] = value;
    attrCache.set(src, parsed);
  }
  return parsed;
}

function Part({ part, color, accent }: { part: IconPart; color: string; accent?: string }) {
  const [kind, tag, data] = part;
  const paint =
    kind === 'S'
      ? { fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
      : kind === 'D'
        ? { fill: accent ?? color, fillOpacity: accent ? 1 : 0.2 }
        : { fill: color };
  if (tag === 'path') return <Path d={data} {...paint} />;
  const attrs = parseAttrs(data);
  return tag === 'circle' ? <Circle {...attrs} {...paint} /> : <Rect {...attrs} {...paint} />;
}

export const KnitIcon = memo(function KnitIcon({
  name,
  size = 24,
  color = Colors.ink,
  accent,
  accessibilityLabel,
}: Props) {
  const labelled = !!accessibilityLabel;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      accessible={labelled}
      accessibilityRole={labelled ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      aria-hidden={!labelled}
      importantForAccessibility={labelled ? 'yes' : 'no-hide-descendants'}>
      {KNIT_ICONS[name].map((part, i) => (
        <Part key={i} part={part} color={color} accent={accent} />
      ))}
    </Svg>
  );
});
