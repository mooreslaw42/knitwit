import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, G, Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Illustration } from '@/components/illustrations/Illustration';
import { Colors, Spacing } from '@/constants/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const STRAND_LENGTH = 140;

type Props = {
  /** Shown under the ball and read by screen readers, e.g. "Reading your pattern…" */
  label?: string;
  size?: number;
  color?: string;
  wrapColor?: string;
};

/**
 * Loading indicator for slow things (AI pattern import, syncing): a yarn ball rolling on the spot
 * while its strand unwinds. With Reduce Motion on it shows the static "thinking" illustration.
 */
export function YarnLoader({
  label = 'Loading…',
  size = 72,
  color = Colors.lavenderDeep,
  wrapColor = Colors.cream,
}: Props) {
  const reduceMotion = useReducedMotion();
  const roll = useSharedValue(0);
  const bob = useSharedValue(0);
  const unwind = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    roll.set(withRepeat(withTiming(1, { duration: 1800, easing: Easing.linear }), -1, false));
    bob.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 450, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 450, easing: Easing.in(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
    unwind.set(withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [reduceMotion, roll, bob, unwind]);

  const ballStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -6 * bob.get() }, { rotate: `${roll.get() * 360}deg` }],
  }));
  const strandProps = useAnimatedProps(() => ({
    strokeDashoffset: STRAND_LENGTH * (1 - (0.35 + 0.65 * unwind.get())),
  }));

  return (
    <View style={styles.wrap} accessible accessibilityRole="progressbar" accessibilityLabel={label}>
      {reduceMotion ? (
        <Illustration name="thinking" width={size * 2} />
      ) : (
        <View style={{ width: size * 2, height: size * 1.25 }}>
          <Svg width={size * 2} height={size * 1.25} viewBox="0 0 160 100" style={StyleSheet.absoluteFill}>
            <AnimatedPath
              d="M70 86 C92 96 104 80 120 86 S146 96 156 84"
              fill="none"
              stroke={color}
              strokeWidth={4}
              strokeLinecap="round"
              strokeDasharray={`${STRAND_LENGTH} ${STRAND_LENGTH}`}
              animatedProps={strandProps}
            />
          </Svg>
          <Animated.View style={[styles.ball, { width: size, height: size, left: size * 0.12, top: size * 0.12 }, ballStyle]}>
            <Svg width={size} height={size} viewBox="0 0 60 60">
              <Defs>
                <ClipPath id="yarnLoaderClip">
                  <Circle cx="30" cy="30" r="28" />
                </ClipPath>
              </Defs>
              <Circle cx="30" cy="30" r="28" fill={color} />
              <G clipPath="url(#yarnLoaderClip)" fill="none" stroke={wrapColor} strokeWidth={3} strokeLinecap="round" opacity={0.85}>
                <Path d="M2 23 C20 18 34 30 41 58" />
                <Path d="M9 6 C29 10 46 26 58 45" />
                <Path d="M27 2 C40 6 52 16 58 29" />
                <Path d="M4 40 C14 38 22 46 25 58" />
              </G>
            </Svg>
          </Animated.View>
        </View>
      )}
      {label ? (
        <ThemedText type="smallBold" themeColor="inkSoft" style={styles.label}>
          {label}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: Spacing.two },
  ball: { position: 'absolute' },
  label: { textAlign: 'center' },
});
