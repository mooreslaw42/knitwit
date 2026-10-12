import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { Colors } from '@/constants/theme';

import { Durations } from './presets';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  /** 0–1 */
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  /** Centre content, e.g. a percentage. */
  children?: ReactNode;
  /** e.g. "70 percent complete". Leave empty if the percentage is already printed next to it. */
  accessibilityLabel?: string;
};

/** The project-tracker ring from the mockups; fills smoothly whenever progress changes. */
export function ProgressRing({
  progress,
  size = 64,
  strokeWidth = 8,
  color = Colors.coralDeep,
  trackColor = Colors.creamDeep,
  children,
  accessibilityLabel,
}: Props) {
  const reduceMotion = useReducedMotion();
  const clamped = Math.max(0, Math.min(1, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const value = useSharedValue(0);

  useEffect(() => {
    value.set(
      reduceMotion
        ? clamped
        : withTiming(clamped, { duration: Durations.slow, easing: Easing.out(Easing.cubic) }),
    );
  }, [clamped, reduceMotion, value]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - value.get()),
  }));

  return (
    <View
      style={{ width: size, height: size }}
      accessible={!!accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'progressbar' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children ? <View style={styles.center}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
});
