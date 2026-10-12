import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Colors } from '@/constants/theme';

type Props = { running: boolean; size?: number; color?: string };

/** Small "recording" dot for the project timer: a soft ripple while it runs, still when paused. */
export function TimerPulse({ running, size = 8, color = Colors.sageDeep }: Props) {
  const reduceMotion = useReducedMotion();
  const ripple = useSharedValue(0);

  useEffect(() => {
    if (running && !reduceMotion) {
      ripple.set(withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), -1, false));
    } else {
      cancelAnimation(ripple);
      ripple.set(0);
    }
  }, [running, reduceMotion, ripple]);

  const rippleStyle = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - ripple.get()),
    transform: [{ scale: 1 + ripple.get() * 1.4 }],
  }));

  const dot = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={[dot, styles.wrap]} aria-hidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[StyleSheet.absoluteFill, dot, { backgroundColor: color }, rippleStyle]} />
      <View style={[dot, { backgroundColor: running ? color : Colors.inkSoft }]} />
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { alignItems: 'center', justifyContent: 'center' } });
