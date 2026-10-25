import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';

import { materialLabel } from '@/components/stash-picker';
import { useCalcScratch, type NumberSource } from '@/store/useCalcScratch';
import { useKnitwitStore } from '@/store/useKnitwitStore';
import type { CraftType, Gauge } from '@/types/knitwit';

// Context arrives as route params and does exactly one thing: fills the gauges in, and says where
// they came from.
//
// It is a prefill rather than a mode — the screen is identical either way, every filled field stays
// editable, and typing over one clears its "from Hazel cardigan" mark. A knitter whose gauge
// snapshot is six months old has to be able to disagree with it.
//
// Three sources, because the gauges are spread across three kinds of thing and the narrowest was
// the one this originally read:
//
//   ?pattern=<id>   Pattern.gauge, and Pattern.swatchGauge as yours when it is set. The richest
//                   seam — practically every pattern states a gauge, because that is what a pattern
//                   is obliged to say.
//   ?material=<id>  the yarn's own gauge, as *yours*: a ball band's figure describes what this yarn
//                   does, which is the closest thing to a swatch you have before you knit one.
//   ?project=<key>  both gauges at once, from the pair snapshotted when it was cast on. The most
//                   specific and the rarest: a project only has them when it was created from a
//                   pattern whose swatch gauge had been measured.
//
// Applied least-specific first, so a project overrides a pattern overrides a yarn when a link
// carries more than one. Each only fills the slots it can speak for.
//
// Read once per set of params, never live. The ref is what makes it once: without it the effect
// re-runs whenever the store hands over a fresh entity — counting a row is enough — and puts the
// prefill back over whatever the knitter had just typed.
export function useCalculatorPrefill() {
  const {
    project: projectKey,
    pattern: patternId,
    material: materialId,
  } = useLocalSearchParams<{ project?: string; pattern?: string; material?: string }>();

  const project = useKnitwitStore((state) => (projectKey ? state.projects[projectKey] : undefined));
  const pattern = useKnitwitStore((state) => (patternId ? state.patterns[patternId] : undefined));
  const material = useKnitwitStore((state) =>
    materialId ? state.materials[materialId] : undefined,
  );

  const setPatternGauge = useCalcScratch((state) => state.setPatternGauge);
  const setMyGauge = useCalcScratch((state) => state.setMyGauge);
  const applied = useRef<string | null>(null);

  useEffect(() => {
    const key = `${projectKey ?? ''}|${patternId ?? ''}|${materialId ?? ''}`;
    if (key === '||' || applied.current === key) return;
    applied.current = key;

    // Read rather than subscribed to, so changing craft on a calculator doesn't re-run the prefill
    // and undo an edit.
    const craft = useCalcScratch.getState().craft;

    if (material && materialId) {
      const gauge = gaugeForCraft(material.crafts?.[craft as CraftType]?.gauge, material.gauge);
      if (gauge) {
        setMyGauge(gauge, { label: materialLabel(material), href: `/material/${materialId}` });
      }
    }

    if (pattern && patternId) {
      const from: NumberSource = { label: pattern.name, href: `/pattern/${patternId}` };
      if (pattern.gauge) setPatternGauge(pattern.gauge, from);
      // Only when it exists. A pattern with no measured swatch says nothing about your knitting,
      // and filling your gauge with the pattern's would answer every question with "they match".
      if (pattern.swatchGauge) setMyGauge(pattern.swatchGauge, from);
    }

    if (project && projectKey) {
      // A project worked at the pattern's own gauge has none — nothing was re-scaled, so there is
      // nothing here to carry over.
      if (project.gauge) {
        const from: NumberSource = { label: project.name, href: `/project/${projectKey}` };
        setPatternGauge(project.gauge.pattern, from);
        setMyGauge(project.gauge.mine, from);
      }
    }
  }, [projectKey, patternId, materialId, project, pattern, material, setPatternGauge, setMyGauge]);
}

// A yarn's gauge for the craft in hand, falling back to the one on the yarn itself. A crochet hook
// and a knitting needle get very different fabric out of the same ball, which is why Material
// carries a gauge per craft at all.
function gaugeForCraft(perCraft: Gauge | null | undefined, fallback: Gauge | null): Gauge | null {
  return perCraft ?? fallback;
}
