import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Colors } from '@/constants/theme';

const PALETTE = [Colors.coralDeep, Colors.sageDeep, Colors.butterDeep, Colors.lavenderDeep, Colors.ink];
// A short snipped end of yarn, as left on the table after weaving in ends.
const SNIP = 'M2 12c3-6 6 6 10 0s7 6 10 0';

type Shape = 'snip' | 'dot' | 'chip';
type PieceSpec = {
  left: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  spin: number;
  sway: number;
  shape: Shape;
};

// Small seeded PRNG so a burst is random-looking but pure (same key → same burst).
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) h = Math.imul(h ^ input.charCodeAt(i), 16777619);
  return h >>> 0;
}

type Props = {
  /** Change this to fire a new burst (e.g. the key of the section that just completed). */
  burstKey: string | number;
  count?: number;
  /** How far the pieces fall, in dp. */
  distance?: number;
};

/**
 * Celebration burst — the demo's spawnConfetti(), done in yarn: snipped ends of yarn, little knots
 * and felt scraps in the palette colours drifting down. Absolutely fills its parent (give the
 * parent overflow: 'hidden'). Renders nothing when Reduce Motion is on; pair it with
 * haptics.success() and visible text.
 */
export function Confetti({ burstKey, count = 22, distance = 230 }: Props) {
  const reduceMotion = useReducedMotion();
  const pieces = useMemo<PieceSpec[]>(() => {
    const rand = mulberry32(hash(String(burstKey)));
    return Array.from({ length: count }, (_, i) => ({
      left: rand() * 100,
      size: 6 + rand() * 7,
      color: PALETTE[Math.floor(rand() * PALETTE.length)],
      delay: rand() * 400,
      duration: 1500 + rand() * 900,
      spin: (180 + rand() * 220) * (rand() < 0.5 ? -1 : 1),
      sway: 4 + rand() * 12,
      shape: i % 2 === 0 ? 'snip' : i % 3 === 0 ? 'chip' : 'dot',
    }));
  }, [burstKey, count]);

  if (reduceMotion) return null;

  return (
    <View style={styles.layer} aria-hidden importantForAccessibility="no-hide-descendants">
      {pieces.map((piece, i) => (
        <Piece key={`${burstKey}-${i}`} spec={piece} distance={distance} />
      ))}
    </View>
  );
}

function Piece({ spec, distance }: { spec: PieceSpec; distance: number }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.set(withDelay(spec.delay, withTiming(1, { duration: spec.duration, easing: Easing.linear })));
  }, [t, spec]);

  const animatedStyle = useAnimatedStyle(() => {
    const v = t.get();
    return {
      opacity: v < 0.65 ? 1 : 1 - (v - 0.65) / 0.35,
      transform: [
        { translateY: v * distance },
        { translateX: Math.sin(v * Math.PI * 2) * spec.sway },
        { rotate: `${v * spec.spin}deg` },
      ],
    };
  });

  const { size, color, shape } = spec;
  return (
    <Animated.View style={[styles.piece, { left: `${spec.left}%` }, animatedStyle]}>
      {shape === 'snip' ? (
        <Svg width={size * 2.2} height={size * 1.2} viewBox="0 0 24 24">
          <Path d={SNIP} fill="none" stroke={color} strokeWidth={3.2} strokeLinecap="round" />
        </Svg>
      ) : (
        <View
          style={{
            width: size,
            height: shape === 'chip' ? size * 0.55 : size,
            borderRadius: shape === 'chip' ? 2 : size / 2,
            backgroundColor: color,
          }}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden', pointerEvents: 'none' },
  piece: { position: 'absolute', top: -14 },
});
