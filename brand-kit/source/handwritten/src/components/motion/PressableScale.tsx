import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';

import { haptics, type HapticKind } from './haptics';
import { Springs } from './presets';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /** How far the button sinks while held. 0.94 for big buttons, 0.97 for wide ones. */
  scaleTo?: number;
  /** Haptic to play on press, or 'none'. */
  haptic?: HapticKind | 'none';
};

/**
 * Drop-in Pressable with Knitwit's squishy press: the button sinks a little while held and springs
 * back on release, with an optional haptic. With Reduce Motion on it dims instead of scaling.
 */
export function PressableScale({
  style,
  children,
  scaleTo = 0.94,
  haptic = 'tap',
  onPressIn,
  onPressOut,
  onPress,
  disabled,
  ...rest
}: Props) {
  const reduceMotion = useReducedMotion();
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    const p = pressed.get();
    return reduceMotion
      ? { opacity: 1 - 0.25 * p }
      : { transform: [{ scale: 1 - (1 - scaleTo) * p }] };
  });

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        pressed.set(withSpring(1, Springs.press));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.set(withSpring(0, Springs.press));
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic !== 'none') haptics[haptic]();
        onPress?.(e);
      }}
      style={[style, animatedStyle]}>
      {children}
    </AnimatedPressable>
  );
}
