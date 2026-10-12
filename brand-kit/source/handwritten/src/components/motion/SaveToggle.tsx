import { Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { KnitIcon } from '@/components/icons/KnitIcon';
import { Colors } from '@/constants/theme';

import { haptics } from './haptics';
import { Springs } from './presets';

type Props = {
  saved: boolean;
  onToggle: () => void;
  size?: number;
  /** What is being saved, e.g. "Meadow Cardigan" → "Save Meadow Cardigan". */
  itemName?: string;
};

/** Bookmark toggle for patterns: dips and settles when you save something. */
export function SaveToggle({ saved, onToggle, size = 22, itemName }: Props) {
  const reduceMotion = useReducedMotion();
  const dip = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dip.get() * 3 }, { scaleY: 1 - dip.get() * 0.12 }],
  }));

  return (
    <Pressable
      hitSlop={10}
      onPress={() => {
        if (!saved && !reduceMotion) {
          dip.set(withSequence(withTiming(1, { duration: 90 }), withSpring(0, Springs.pop)));
        }
        haptics.select();
        onToggle();
      }}
      accessibilityRole="button"
      accessibilityLabel={itemName ? `Save ${itemName}` : 'Save'}
      accessibilityState={{ selected: saved }}>
      <Animated.View style={animatedStyle}>
        <KnitIcon
          name={saved ? 'bookmark-filled' : 'bookmark'}
          size={size}
          color={Colors.coralDeep}
          accent={saved ? undefined : Colors.coral}
        />
      </Animated.View>
    </Pressable>
  );
}
