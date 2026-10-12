import { useEffect, useRef } from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Springs } from './presets';

type Props = {
  value: number;
  style?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
};

/**
 * The big row number. Counting up, the new number rises in from below with a tiny pop;
 * counting down it drops in from above — so the direction is visible at a glance.
 */
export function RowCount({ value, style, accessibilityLabel }: Props) {
  const reduceMotion = useReducedMotion();
  const previous = useRef(value);
  const lift = useSharedValue(0);
  const pop = useSharedValue(1);

  useEffect(() => {
    const direction = Math.sign(value - previous.current);
    previous.current = value;
    if (reduceMotion || direction === 0) return;
    lift.set(withSequence(withTiming(direction * 14, { duration: 0 }), withSpring(0, Springs.settle)));
    pop.set(withSequence(withTiming(1.08, { duration: 70 }), withSpring(1, Springs.pop)));
  }, [value, reduceMotion, lift, pop]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.get() }, { scale: pop.get() }],
  }));

  return (
    <Animated.Text
      style={[style, animatedStyle]}
      accessibilityLabel={accessibilityLabel}
      accessibilityLiveRegion="polite">
      {value}
    </Animated.Text>
  );
}
