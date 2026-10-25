import type { KnitIconName } from '@/components/icons/knit-icon-data';

// What the calculator tab offers, as data.
//
// One list, read by both the hub that lists them and the `[tool]` route that renders them, so a
// calculator is described once and cannot appear in one place and not the other. Deliberately no
// components here — this stays importable from anywhere, including tests, without dragging a
// screen's worth of UI along with it.
//
// `question` is the whole point of the hub. It is what the old cards led with, in the knitter's own
// words, and it is what somebody is choosing between — "which needle or hook?" means nothing next
// to "your swatch didn't match: what size should you try next?".
export type CalculatorId = 'rescale' | 'needle' | 'measure' | 'windows';

export type CalculatorGroup = 'gauge' | 'yarn' | 'shaping';

export type CalculatorDef = {
  id: CalculatorId;
  title: string;
  question: string;
  icon: KnitIconName;
  group: CalculatorGroup;
};

// Ids are addresses: `/calculator/rescale` is a URL a knitter can bookmark and a screen can link
// to. Titles and questions are free to change; these strings are not.
export const CALCULATORS: CalculatorDef[] = [
  {
    id: 'rescale',
    title: 'Rescale a stitch count',
    question:
      "The pattern says cast on this many, but you don't knit at its gauge. How many should you cast on?",
    icon: 'gauge',
    group: 'gauge',
  },
  {
    id: 'needle',
    title: 'Which needle or hook?',
    question:
      "Your swatch didn't match. What size should you try next — and what would another size give you?",
    icon: 'needles-straight',
    group: 'gauge',
  },
  {
    id: 'measure',
    title: 'Stitches and centimetres',
    question: 'How wide is this many stitches, and how many stitches is this wide?',
    icon: 'stitch-marker',
    group: 'gauge',
  },
  {
    id: 'windows',
    title: 'The same gauge, every window',
    question: 'A pattern gives its gauge per 4in and yours is per 10cm. Are they the same fabric?',
    icon: 'pattern',
    group: 'gauge',
  },
];

// Only groups with something in them are shown, so the two that phases 2 and 3 fill stay out of
// sight rather than sitting there empty.
export const CALCULATOR_GROUPS: { id: CalculatorGroup; label: string }[] = [
  { id: 'gauge', label: 'Gauge' },
  { id: 'yarn', label: 'Yarn & money' },
  { id: 'shaping', label: 'Shaping' },
];

export function calculatorById(id: string | undefined): CalculatorDef | null {
  return CALCULATORS.find((c) => c.id === id) ?? null;
}

export function calculatorsInGroup(group: CalculatorGroup): CalculatorDef[] {
  return CALCULATORS.filter((c) => c.group === group);
}
