import { memo } from 'react';
import { Platform } from 'react-native';
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

// Telling an icon to a screen reader, or hiding it from one, in each platform's own words.
//
// react-native-svg's web shape hands anything it doesn't recognise straight to the DOM `<svg>`, and
// React then warns that it is not a valid attribute — once per prop, on every page with an icon on
// it, which is every page. Both of React Native's spellings are native-only: `accessible` is not a
// DOM attribute, and neither is `importantForAccessibility`. The web wants `aria-hidden`, `role`
// and `aria-label`, which are real attributes and go through untouched.
//
// `HIDDEN` is hoisted because it is the common case by a long way — an icon beside its own label is
// decorative, and almost every one in the app is. The labelled branch has to build its object, since
// the label is the prop, but it is rare and only reached when there is something to say.
type A11yProps = Record<string, unknown>;

const HIDDEN: A11yProps = Platform.select({
  web: { 'aria-hidden': true },
  default: { accessible: false, importantForAccessibility: 'no-hide-descendants' },
}) as A11yProps;

function shownProps(label: string): A11yProps {
  return Platform.OS === 'web'
    ? { role: 'img', 'aria-label': label }
    : { accessible: true, accessibilityRole: 'image', accessibilityLabel: label };
}

export const KnitIcon = memo(function KnitIcon({
  name,
  size = 24,
  color = Colors.ink,
  accent,
  accessibilityLabel,
}: Props) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...(accessibilityLabel ? shownProps(accessibilityLabel) : HIDDEN)}>
      {KNIT_ICONS[name].map((part, i) => (
        <Part key={i} part={part} color={color} accent={accent} />
      ))}
    </Svg>
  );
});
