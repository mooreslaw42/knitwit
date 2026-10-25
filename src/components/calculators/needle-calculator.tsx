import { useState } from 'react';

import { Answer, Aside, CalcScreen, Inputs, NeedsInput } from '@/components/calc-screen';
import { MyGaugeField, PatternGaugeField } from '@/components/calculators/scratch-gauges';
import { SelectField } from '@/components/knitwit-ui';
import { ThemedText } from '@/components/themed-text';
import {
  parseToolSize,
  TOOL_SIZES,
  toolSizeLabel,
  toolSizeOptions,
  type SizeScale,
} from '@/constants/catalogs';
import {
  formatGauge,
  gaugeAtNeedle,
  isUsableGauge,
  nearestToolSize,
  needleForGauge,
} from '@/lib/gauge';
import { round } from '@/lib/numbers';
import { useCalcScratch } from '@/store/useCalcScratch';

const CRAFT_OPTIONS: { value: SizeScale; label: string }[] = [
  { value: 'knit', label: 'Knitting needles' },
  { value: 'crochet', label: 'Crochet hooks' },
];

// Two readings of one model, which is why they are now one screen.
//
// A stitch comes out about as wide as the tool that made it, so stitches per centimetre varies
// roughly with 1/size. Read forwards that answers "what gets me to the pattern's gauge?"; read
// backwards it answers "what would this other size give me?". These were two cards asking for the
// same gauge and the same needle picker twice over.
export function NeedleCalculator() {
  const patternGauge = useCalcScratch((state) => state.patternGauge);
  const myGauge = useCalcScratch((state) => state.myGauge);
  const craft = useCalcScratch((state) => state.craft);
  const setCraft = useCalcScratch((state) => state.setCraft);
  const needle = useCalcScratch((state) => state.needle);
  const setNeedle = useCalcScratch((state) => state.setNeedle);

  // Only this screen asks "what if", so it stays here.
  const [tryNeedle, setTryNeedle] = useState('4.5mm');

  const myNeedleMm = parseToolSize(needle);
  const tryNeedleMm = parseToolSize(tryNeedle);

  const suggestion = (() => {
    if (myNeedleMm === null || !isUsableGauge(myGauge) || !isUsableGauge(patternGauge)) return null;
    const exact = needleForGauge(myGauge, myNeedleMm, patternGauge);
    if (exact === null) return null;
    const nearest = nearestToolSize(exact, TOOL_SIZES);
    if (nearest === null) return null;
    return { exact, nearest, predicted: gaugeAtNeedle(myGauge, myNeedleMm, nearest) };
  })();

  // Deliberately answerable without the pattern's gauge: "what would 5mm give me?" is a question
  // about your yarn alone.
  const predicted =
    myNeedleMm !== null && tryNeedleMm !== null && isUsableGauge(myGauge)
      ? gaugeAtNeedle(myGauge, myNeedleMm, tryNeedleMm)
      : null;

  return (
    <CalcScreen
      title="Which needle or hook?"
      question="Your swatch didn't match. What size should you try next — and what would another size give you?">
      <Inputs>
        <PatternGaugeField />
        <MyGaugeField />
        <SelectField label="Craft" options={CRAFT_OPTIONS} value={craft} onChange={setCraft} />
        <SelectField
          label="You swatched on"
          options={toolSizeOptions(needle, craft)}
          value={needle}
          onChange={setNeedle}
        />
      </Inputs>

      {suggestion === null || myNeedleMm === null ? (
        <NeedsInput>Both gauges, and the size you swatched on.</NeedsInput>
      ) : suggestion.nearest === myNeedleMm ? (
        <Answer label="Stay on" value={toolSizeLabel(myNeedleMm, craft)}>
          <ThemedText type="small" themeColor="inkSoft">
            You&apos;re already on the closest size there is. Rescaling the stitch counts is the way
            to fix what&apos;s left.
          </ThemedText>
        </Answer>
      ) : (
        <Answer label="Try" value={toolSizeLabel(suggestion.nearest, craft)}>
          <ThemedText type="small" themeColor="inkSoft">
            {suggestion.nearest < myNeedleMm ? 'Smaller' : 'Bigger'} than the{' '}
            {toolSizeLabel(myNeedleMm, craft)} you used — you need{' '}
            {suggestion.nearest < myNeedleMm ? 'more' : 'fewer'} stitches to the centimetre. Exactly{' '}
            {round(suggestion.exact, 2)}mm, snapped to a size that exists.
          </ThemedText>
          {suggestion.predicted ? (
            <ThemedText type="small" themeColor="sageDeep">
              You&apos;d expect about {formatGauge(suggestion.predicted)} — the pattern wants{' '}
              {formatGauge(patternGauge)}.
            </ThemedText>
          ) : null}
        </Answer>
      )}

      <Aside title="Or try a size and see what it would give you">
        <Inputs>
          <SelectField
            label="What if you used"
            options={toolSizeOptions(tryNeedle, craft)}
            value={tryNeedle}
            onChange={setTryNeedle}
          />
        </Inputs>
        {predicted && tryNeedleMm !== null && myNeedleMm !== null ? (
          <Answer
            label={`On ${toolSizeLabel(tryNeedleMm, craft)} you'd expect`}
            value={formatGauge(predicted)}>
            <ThemedText type="small" themeColor="inkSoft">
              Against {formatGauge(myGauge)} on the {toolSizeLabel(myNeedleMm, craft)} you used.
            </ThemedText>
          </Answer>
        ) : (
          <NeedsInput>Your gauge, and the size you swatched on.</NeedsInput>
        )}
      </Aside>

      <ThemedText type="small" themeColor="inkSoft">
        A stitch comes out about as wide as the tool that made it, so gauge moves roughly with
        1/size. Enough to tell you what to swatch on next — not enough to skip the swatch.
      </ThemedText>
    </CalcScreen>
  );
}
