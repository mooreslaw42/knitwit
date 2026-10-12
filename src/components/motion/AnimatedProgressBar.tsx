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
export function AnimatedProgressBar({ pct, color }: { pct: number; color: string }) {
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
    <View style={styles.track}>
      <Animated.View style={[styles.fill, { backgroundColor: color }, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: Colors.creamDeep, borderRadius: Radii.pill, height: 6, width: '100%', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radii.pill },
});
