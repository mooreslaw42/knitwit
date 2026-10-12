import { FadeIn, FadeInDown, FadeOut, ReduceMotion, ZoomIn } from 'react-native-reanimated';

/**
 * Knitwit motion tokens. Soft, springy, never fast or flashy — the app is used mid-row with
 * needles in hand, so motion confirms an action and gets out of the way.
 * Every preset honours the OS "Reduce Motion" setting (ReduceMotion.System).
 */
export const Durations = {
  tap: 90,
  quick: 160,
  base: 260,
  slow: 600,
} as const;

export const Springs = {
  /** Button press-in / release. */
  press: { damping: 18, stiffness: 420, mass: 0.6 },
  /** Small settle with a little overshoot (bookmark, row number). */
  pop: { damping: 9, stiffness: 260, mass: 0.7 },
  /** Calm settle into place. */
  settle: { damping: 16, stiffness: 180, mass: 0.8 },
} as const;

/** Alert cards on the counter (stitch marker, cast off, complete, note). */
export const enterCard = FadeInDown.springify().damping(16).mass(0.8).reduceMotion(ReduceMotion.System);
export const exitCard = FadeOut.duration(Durations.quick).reduceMotion(ReduceMotion.System);
/** Empty states, list sections. */
export const enterSoft = FadeIn.duration(Durations.base).reduceMotion(ReduceMotion.System);
/** Small things appearing with a bit of joy (badges, "complete" tick). */
export const enterPop = ZoomIn.springify().damping(12).reduceMotion(ReduceMotion.System);
