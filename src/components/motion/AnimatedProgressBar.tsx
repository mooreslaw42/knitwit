import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Colors, Radii } from '@/constants/theme';

import { Durations } from './presets';

/** Drop-in replacement for ProgressBar in knitwit-ui.tsx that fills up smoothly. */
export function AnimatedProgressBar({
  pct,
  color,
  trackColor,
}: {
  pct: number;
  color: string;
  // The unfilled part. Defaults to the deep cream, which is right on a white card and invisible on
  // a deep-cream one — where a bar a third full then reads as a short underline, not as progress.
  trackColor?: string;
}) {
  const reduceMotion = useReducedMotion();
  const clamped = Math.max(0, Math.min(1, pct));
  const value = useSharedValue(0);

  useEffect(() => {
    value.set(
      reduceMotion
        ? clamped
        : withTiming(clamped, { duration: Durations.slow, easing: Easing.out(Easing.cubic) }),
    );
  }, [clamped, reduceMotion, value]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${value.get() * 100}%` }));

  return (
    <View style={[styles.track, trackColor ? { backgroundColor: trackColor } : null]}>
      <Animated.View style={[styles.fill, { backgroundColor: color }, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: Colors.creamDeep, borderRadius: Radii.pill, height: 6, width: '100%', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radii.pill },
});
