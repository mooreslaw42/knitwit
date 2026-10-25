import { create } from 'zustand';

import type { SizeScale } from '@/constants/catalogs';
import type { Gauge } from '@/types/knitwit';

// The numbers the calculators have in common, for as long as the app is open.
//
// Each calculator is its own screen now, which is what lets a knitter see the inputs and the answer
// at once. The cost is that walking from "rescale a stitch count" to "which needle?" would mean
// typing the same two gauges again — so the two gauges, the craft and the size you swatched on live
// here rather than in any one screen. Everything a single calculator alone asks for (a cast-on
// count, a stitch repeat, a measurement) stays local to it.
//
// Deliberately **not** persisted. The tab changes no pattern and no project, and a gauge typed in
// to answer a question in a yarn shop is not something to find again a week later. It is also why
// this is a store of its own rather than a slice of useKnitwitStore, which writes to disk.
export type NumberSource = {
  // What to call it: "Hazel cardigan", "DROPS Baby Merino".
  label: string;
  // Where to look, so the knitter can check the number rather than take it on trust.
  href: string;
};

type CalcScratch = {
  patternGauge: Gauge | null;
  patternGaugeFrom: NumberSource | null;
  myGauge: Gauge | null;
  myGaugeFrom: NumberSource | null;
  craft: SizeScale;
  // The needle or hook the knitter's gauge was measured on, as a stored tool size ("4mm").
  needle: string;

  setPatternGauge: (gauge: Gauge | null, from?: NumberSource | null) => void;
  setMyGauge: (gauge: Gauge | null, from?: NumberSource | null) => void;
  setCraft: (craft: SizeScale) => void;
  setNeedle: (needle: string) => void;
  clear: () => void;
};

// Empty, not plausible. A gauge the app made up looks exactly like one the knitter measured, and
// the whole screen is then answering a question about nobody's knitting. The fields carry the old
// defaults as placeholders instead, so the shape of the answer is still visible.
const EMPTY = {
  patternGauge: null,
  patternGaugeFrom: null,
  myGauge: null,
  myGaugeFrom: null,
  craft: 'knit' as SizeScale,
  needle: '4mm',
};

export const useCalcScratch = create<CalcScratch>((set) => ({
  ...EMPTY,

  // Passing no source clears the one that was there, which is how a prefilled field stops claiming
  // to have come from a project the moment the knitter types over it.
  setPatternGauge: (patternGauge, from = null) =>
    set({ patternGauge, patternGaugeFrom: from }),
  setMyGauge: (myGauge, from = null) => set({ myGauge, myGaugeFrom: from }),
  setCraft: (craft) => set({ craft }),
  setNeedle: (needle) => set({ needle }),
  clear: () => set(EMPTY),
}));
