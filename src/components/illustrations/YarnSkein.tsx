import { useId } from 'react';
import Svg, { Circle, ClipPath, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';

type Props = {
  /** The yarn's colour — any CSS hex. */
  color: string;
  size?: number;
};

/**
 * Placeholder "photo" for a material without one: a yarn ball in the yarn's own colour.
 * Ported from yarnPlaceholderPhoto() in reference/index.html. Decorative — the yarn name is
 * always shown next to it.
 */
export function YarnSkein({ color, size = 56 }: Props) {
  const id = useId().replace(/:/g, '');
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" aria-hidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <ClipPath id={`clip${id}`}>
          <Circle cx="60" cy="60" r="50" />
        </ClipPath>
        <RadialGradient id={`shade${id}`} cx="38%" cy="32%" r="75%">
          <Stop offset="0" stopColor="#fff" stopOpacity={0.35} />
          <Stop offset="0.6" stopColor="#fff" stopOpacity={0} />
          <Stop offset="1" stopColor="#000" stopOpacity={0.18} />
        </RadialGradient>
      </Defs>
      <Circle cx="60" cy="60" r="50" fill={color} />
      <G clipPath={`url(#clip${id})`} fill="none" stroke="#fff" strokeOpacity={0.45} strokeWidth={4} strokeLinecap="round">
        <Path d="M10 48 C30 42 60 58 78 112" />
        <Path d="M22 22 C48 26 80 50 100 92" />
        <Path d="M50 10 C70 18 92 38 106 66" />
        <Path d="M14 74 C30 70 44 84 52 110" />
      </G>
      <Circle cx="60" cy="60" r="50" fill={`url(#shade${id})`} />
    </Svg>
  );
}
