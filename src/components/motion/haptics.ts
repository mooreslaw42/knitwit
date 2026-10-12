import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

function fire(effect: () => Promise<void>) {
  if (!supported) return;
  // Haptics are a nicety — never let a missing vibration motor surface as an error.
  effect().catch(() => {});
}

/**
 * Knitwit's haptic vocabulary — so a knitter can *feel* the counter without looking at it:
 * - tap: every row +/−
 * - select: toggles (favourite, filters)
 * - nudge: "look up!" moments — stitch marker row reached, last row reached
 * - success: section complete
 */
export const haptics = {
  tap: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  firm: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  select: () => fire(() => Haptics.selectionAsync()),
  nudge: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  success: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
};

export type HapticKind = keyof typeof haptics;
