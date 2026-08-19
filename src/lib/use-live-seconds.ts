import { useEffect, useState } from 'react';

import { useKnitwitStore } from '@/store/useKnitwitStore';

// Live-ticking seconds for a project section, including the in-progress run if its
// timer is currently active. The interval callback (an external-timer subscription,
// not a render-time computation) is what keeps this in sync — matches the original's
// setInterval(renderTimerButton, 1000) behavior, just floored to the nearest second.
export function useLiveSeconds(projectKey: string, sectionIndex: number): number {
  const baseSeconds = useKnitwitStore(
    (state) => state.projects[projectKey]?.sections[sectionIndex]?.seconds ?? 0,
  );
  const timerKey = useKnitwitStore((state) => state.timerKey);
  const timerStartedAt = useKnitwitStore((state) => state.timerStartedAt);
  const isRunning = timerKey === `${projectKey}|${sectionIndex}`;

  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isRunning || !timerStartedAt) return;
    const startedAt = timerStartedAt;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning, timerStartedAt]);

  return baseSeconds + (isRunning ? elapsed : 0);
}
