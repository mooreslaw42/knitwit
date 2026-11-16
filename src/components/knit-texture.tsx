import { useId } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';

// Hidden from screen readers in each platform's own words — see KnitIcon for why the two differ.
const HIDDEN = Platform.select<Record<string, unknown>>({
  web: { 'aria-hidden': true },
  default: { accessible: false, importantForAccessibility: 'no-hide-descendants' },
});

// Stockinette, drawn: the columns of little Vs that the right side of knitted fabric is made of.
//
// It stands in wherever a photo would go and there isn't one yet. A project or a pattern without
// a picture used to be a flat square of its colour — on a list of them, a column of pastel
// blocks, and at the top of a detail screen a blank rectangle 180 points tall. Knitted in its own
// colour, the same square reads as "this is a piece of knitting", which is what it is standing in
// for, and a screen of them looks made rather than unfinished.
//
// Fills whatever it is put in; the parent supplies the background colour and the clipping.
export function KnitTexture({
  color,
  // The width of one stitch, in points. Small for a thumbnail, larger for a hero.
  stitch = 14,
  opacity = 0.45,
}: {
  color: string;
  stitch?: number;
  opacity?: number;
}) {
  // Pattern ids are global to the page on the web, so two textures must not share one.
  const id = `knit${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const w = stitch;
  const h = stitch * 0.82;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" {...HIDDEN}>
        <Defs>
          <Pattern id={id} width={w} height={h} patternUnits="userSpaceOnUse">
            <Path
              d={`M${w * 0.14} ${h * 0.08} L${w * 0.5} ${h * 0.92} L${w * 0.86} ${h * 0.08}`}
              stroke={color}
              strokeWidth={w * 0.17}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              opacity={opacity}
            />
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
