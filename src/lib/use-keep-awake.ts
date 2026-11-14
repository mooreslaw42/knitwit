import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

const TAG = 'knitwit-counter';

// Keeps the screen on while this screen is the one being looked at.
//
// A row counter that lets the phone lock is one you unlock with your nose: both hands are on the
// needles, the phone is on the arm of the chair, and it went dark forty stitches ago. Every
// knitter who has used a counter app has met this, and it is the first thing they ask a new one.
//
// Tied to focus rather than to being mounted, deliberately. A tab stays mounted after you leave
// it, so the plain `useKeepAwake()` would have kept the phone awake everywhere in the app for
// good the first time the counter was opened.
//
// Failures are swallowed: on a browser without the Wake Lock API there is simply nothing to ask
// for, and that must not reach the knitter as an error.
export function useKeepAwakeWhileFocused(enabled: boolean): void {
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return undefined;
      activateKeepAwakeAsync(TAG).catch(() => {});
      return () => {
        deactivateKeepAwake(TAG).catch(() => {});
      };
    }, [enabled]),
  );
}
