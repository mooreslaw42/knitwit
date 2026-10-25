import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useCalcScratch } from '@/store/useCalcScratch';
import { useKnitwitStore } from '@/store/useKnitwitStore';

// Context arrives as a route param and does exactly one thing: fills the gauges in, and says where
// they came from.
//
// `/calculator/rescale?project=hazel` is the whole mechanism. It is a prefill rather than a mode —
// the screen is identical either way, every filled field stays editable, and typing over one clears
// its "from Hazel cardigan" mark. A knitter whose gauge snapshot is six months old has to be able
// to disagree with it.
//
// Read once per project, never live. A project's gauges are snapshotted when it is cast on, so
// there is nothing to keep watching, and re-applying them on every render would overwrite whatever
// the knitter had just typed. The ref is what makes it once: `applied` holds the key already dealt
// with, so coming back to the same screen does not refill it, and arriving with a different project
// does.
export function useCalculatorPrefill() {
  const { project: key } = useLocalSearchParams<{ project?: string }>();
  const project = useKnitwitStore((state) => (key ? state.projects[key] : undefined));
  const setPatternGauge = useCalcScratch((state) => state.setPatternGauge);
  const setMyGauge = useCalcScratch((state) => state.setMyGauge);
  const applied = useRef<string | null>(null);

  useEffect(() => {
    if (!key || applied.current === key) return;
    // A project worked at the pattern's own gauge has `gauge: null` — nothing was re-scaled, so
    // there is nothing here to carry over. Marked as dealt with either way, so a project without
    // gauges doesn't re-check on every render.
    applied.current = key;
    if (!project?.gauge) return;
    const from = { label: project.name, href: `/project/${key}` };
    setPatternGauge(project.gauge.pattern, from);
    setMyGauge(project.gauge.mine, from);
  }, [key, project, setPatternGauge, setMyGauge]);
}
