import { memo } from 'react';
import { Platform } from 'react-native';
import Svg, { Path, type SvgProps } from 'react-native-svg';

import { Colors } from '@/constants/theme';

// The sign-in providers' own logos. Deliberately *not* part of the Knitwit KnitIcon set
// (src/components/icons): those are drawn on Knitwit's 24px grid and recoloured freely, whereas
// these belong to Apple, Google and Ravelry and have to look like themselves. Google in particular
// is multi-colour and must stay that way to be recognised; Apple and Ravelry are single-colour
// marks that take the surrounding text colour so they sit with their label.
//
// Paths: Apple is the standard Apple logo (viewBox 384×512). Google is the four-colour "G"
// (viewBox 48×48). Ravelry is Simple Icons' brand mark (viewBox 24×24). Each keeps its own
// viewBox; preserveAspectRatio (the default "xMidYMid meet") fits the art into the square viewport
// without stretching, so the Apple mark simply reads a touch narrower, as it should.

export type BrandName = 'apple' | 'google' | 'ravelry';

const APPLE =
  'M318.7 268.7c-.2-36.71 16.4-64.37 50.1-84.74-18.84-26.99-47.32-41.84-84.86-44.74-35.56-2.76-74.47 20.98-88.68 20.98-15 0-49.46-19.4-76.37-19.4C62.9 141.6 4 185.5 4 274.3c0 26.3 4.8 53.44 14.43 81.38 12.83 36.73 59.14 126.62 107.5 125.15 25.3-.6 43.17-17.98 76.09-17.98 31.94 0 48.47 17.98 76.37 17.98 48.8-.71 90.73-82.37 102.9-119.21-65.24-30.73-61.57-90.11-61.57-92.13zm-56.9-164.13c27.46-32.59 24.96-62.25 24.15-72.95-24.25 1.41-52.31 16.56-68.3 35.2-17.6 19.98-27.95 44.7-25.73 71.43 26.23 2.03 50.17-11.44 69.88-33.68z';

const RAVELRY =
  'M23.9718 10.9238c-.0597-.51098-.084-1.02918-.1851-1.53174-.1227-.61046-.2793-1.21823-.4755-1.80886-.34288-1.03247-.84358-1.9895-1.52577-2.84163-.2955-.3691-.59489-.73971-.92998-1.07185-.699-.69252-1.47808-1.28586-2.32827-1.78481-.88588-.52-1.81527-.9414-2.80316-1.21913-.54449-.153-1.10068-.26842-1.65627-.37632-.3351-.06493-.67949-.08236-1.01938-.12264-.0156-.0018-.0297-.01773-.0444-.02735-.5319.0003-1.06379.0003-1.59568.0003-.1191.01924-.2376.04569-.3576.0568-.57748.05381-1.13818.18667-1.69287.35078-.68279.20169-1.33498.47912-1.96527.80825-.66029.34506-1.28548.74813-1.88187 1.19388-.3048.22783-.6063.46258-.88829.71747-.50279.45507-1.00678.91104-1.47897 1.39707-.6378.65676-1.18769 1.38595-1.66288 2.17196C1.05934 7.533.71345 8.2628.46776 9.03978c-.1773.56118-.3054 1.13197-.3801 1.7178-.0744.58431-.1062 1.17043-.0768 1.75565.0336.66577.0951 1.32944.2187 1.9886.1713.91345.4392 1.79083.82679 2.63394.3207.69703.72149 1.34267 1.18618 1.95344.3897.51187.83099.97476 1.30258 1.40428.63239.5759 1.32508 1.07546 2.06487 1.5116.87719.51728 1.79787.92937 2.76266 1.24918.65639.21762 1.32808.37271 2.00847.48603.3.0499.60659.06192.90988.09258.0204.0021.0393.01834.0588.02765h1.59568c.1239-.01924.2472-.04629.372-.05651.80728-.06583 1.58667-.2636 2.34686-.52961.85018-.29787 1.66557-.6784 2.41916-1.17705.4818-.31861.95849-.64624 1.42018-.9931.2859-.21491.54299-.4695.80579-.71447.1959-.18275.38369-.37452.56879-.56839.59639-.6261 1.11118-1.31471 1.55307-2.05773.4716-.79292.8577-1.62611 1.10219-2.51671.1413-.51459.2445-1.04.3468-1.5642.051-.2609.0618-.5299.0924-.79502.0018-.01563.0177-.02976.0273-.04448v-1.8314c-.0096-.02946-.0246-.058-.0282-.08807zm-7.96218-.05682s-.81899-.14728-1.40698-.14728c-1.34398 0-1.65897.7364-1.65897 1.8305v4.62885H9.31072V7.75303h3.63295v1.57802c.441-1.32554 1.32298-1.78842 3.06595-1.78842z';

type Props = {
  name: BrandName;
  /** Rendered size in dp. */
  size?: number;
  /** Fill for the monochrome marks (Apple, Ravelry); Google keeps its own brand colours. */
  color?: string;
  /**
   * A label makes the mark visible to screen readers. Leave it off when the mark sits beside a text
   * label that already says the provider's name, so it isn't announced twice.
   */
  accessibilityLabel?: string;
};

export const BrandMark = memo(function BrandMark({
  name,
  size = 18,
  color = Colors.ink,
  accessibilityLabel,
}: Props) {
  const labelled = !!accessibilityLabel;
  // Decorative by default — the button's own text names the provider, so the mark is hidden from
  // screen readers (and with no text inside the SVG that is all VoiceOver needs to skip it). The
  // props are split by platform because react-native-svg forwards React Native's own a11y props
  // (accessible, importantForAccessibility) straight onto the web <svg> as unknown DOM attributes,
  // which React warns about; web gets the real ARIA attributes instead.
  const a11y: Partial<SvgProps> =
    Platform.OS === 'web'
      ? labelled
        ? { role: 'img', 'aria-label': accessibilityLabel }
        : { 'aria-hidden': true }
      : labelled
        ? { accessible: true, accessibilityRole: 'image', accessibilityLabel }
        : { accessible: false };

  if (name === 'google') {
    return (
      <Svg width={size} height={size} viewBox="0 0 48 48" {...a11y}>
        <Path
          fill="#FFC107"
          d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
        />
        <Path
          fill="#FF3D00"
          d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
        />
        <Path
          fill="#4CAF50"
          d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
        />
        <Path
          fill="#1976D2"
          d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
        />
      </Svg>
    );
  }

  const path = name === 'apple' ? APPLE : RAVELRY;
  const viewBox = name === 'apple' ? '0 0 384 512' : '0 0 24 24';
  return (
    <Svg width={size} height={size} viewBox={viewBox} {...a11y}>
      <Path fill={color} d={path} />
    </Svg>
  );
});
