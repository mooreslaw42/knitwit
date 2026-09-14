import {
  describeToolSize,
  formatToolSize,
  scaleForToolType,
  STITCH_ORDER,
  TOOL_SIZES,
  toolSizeLabel,
  toolSizeOptions,
} from '@/constants/catalogs';

describe('tool sizes', () => {
  it('runs in half-millimetre steps', () => {
    expect(TOOL_SIZES.slice(0, 6)).toEqual([0.5, 1, 1.5, 2, 2.25, 2.5]);
  });

  it('is sorted, with no duplicates', () => {
    expect([...TOOL_SIZES].sort((a, b) => a - b)).toEqual(TOOL_SIZES);
    expect(new Set(TOOL_SIZES).size).toBe(TOOL_SIZES.length);
  });

  // Standard metric equivalents of US 1, 2, 3 and 5 — a knitter owning a pair needs to say so.
  it('includes the standard quarter sizes', () => {
    expect(TOOL_SIZES).toEqual(expect.arrayContaining([2.25, 2.75, 3.25, 3.75]));
  });

  it('stores the way the rest of the app already writes a size', () => {
    expect(formatToolSize(4.5)).toBe('4.5mm');
    expect(formatToolSize(4)).toBe('4mm');
  });
});

describe('toolSizeOptions', () => {
  it('offers an empty choice, so a size can be left unsaid', () => {
    expect(toolSizeOptions('')[0].value).toBe('');
  });

  it('selects a value that is on the scale without adding anything', () => {
    const options = toolSizeOptions('4.5mm');
    expect(options.filter((o) => o.value === '4.5mm')).toHaveLength(1);
  });

  // The one that matters: a pattern imported as "3 mm [US 2.5] circular needles" is a real value.
  // A picker that couldn't show it would fall to the first option and rewrite it on the next save.
  it('keeps a value that is not on the scale selectable', () => {
    const odd = '3 mm [US 2.5] circular needles';
    const options = toolSizeOptions(odd);
    expect(options.some((o) => o.value === odd)).toBe(true);
    // Right after "not set", where it's findable rather than buried mid-scale.
    expect(options[1]).toEqual({ value: odd, label: odd });
  });

  it('does not accumulate the odd value on repeated calls', () => {
    const odd = '7,5 mm';
    expect(toolSizeOptions(odd).filter((o) => o.value === odd)).toHaveLength(1);
    expect(toolSizeOptions(odd).filter((o) => o.value === odd)).toHaveLength(1);
  });
});

// The Edge Function has its own copy of the stitch vocabulary, because it runs on Deno and can't
// import from src/. A type the model can return but the app has no entry for draws a blank cell
// and contributes nothing to the running count — silently wrong rather than loudly broken.
describe('the app and the model agree on the stitches', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { STITCH_TYPES } = require('../../supabase/functions/parse-pattern/schema.ts');

  it('offers the model exactly what the app can chart', () => {
    expect([...STITCH_TYPES].sort()).toEqual([...STITCH_ORDER].sort());
  });
});

describe('US size names', () => {
  it('names a needle on the US scale', () => {
    expect(toolSizeLabel(4.5, 'knit')).toBe('4.5 mm · US 7');
    expect(toolSizeLabel(2.25, 'knit')).toBe('2.25 mm · US 1');
    expect(toolSizeLabel(10, 'knit')).toBe('10 mm · US 15');
  });

  // Hooks are lettered, and a 4.5mm hook is plain "7" with no letter at all.
  it('names a hook on the hook scale', () => {
    expect(toolSizeLabel(5, 'crochet')).toBe('5 mm · H/8');
    expect(toolSizeLabel(4, 'crochet')).toBe('4 mm · G/6');
    expect(toolSizeLabel(4.5, 'crochet')).toBe('4.5 mm · 7');
  });

  // The two scales genuinely disagree — 5mm is US 8 as a needle and H/8 as a hook — so a pattern
  // that is both gets the millimetres and no guess.
  it('names nothing when the craft could be either', () => {
    expect(toolSizeLabel(5, 'both')).toBe('5 mm');
  });

  // The US scale is ordinal, not a conversion, so a size with no US name must not get one.
  it('leaves a size with no US name unnamed rather than interpolating', () => {
    expect(toolSizeLabel(7, 'knit')).toBe('7 mm');
    expect(toolSizeLabel(3.4, 'knit')).toBe('3.4 mm');
    expect(toolSizeLabel(2, 'crochet')).toBe('2 mm');
  });

  it('reads a stored size back out', () => {
    expect(describeToolSize('4.5mm', 'knit')).toBe('4.5 mm · US 7');
    expect(describeToolSize('4,5 mm', 'knit')).toBe('4.5 mm · US 7');
  });

  // An imported value already says more than we could. Left exactly as it is.
  it('does not touch a size it cannot parse', () => {
    expect(describeToolSize('3 mm [US 2.5] circular needles', 'knit')).toBe(
      '3 mm [US 2.5] circular needles',
    );
    expect(describeToolSize('', 'knit')).toBe('');
  });

  it('picks the scale from a tool type', () => {
    expect(scaleForToolType('crochet-hook')).toBe('crochet');
    expect(scaleForToolType('circular')).toBe('knit');
    expect(scaleForToolType('dpn')).toBe('knit');
  });

  it('puts the US name in the picker', () => {
    const label = toolSizeOptions('', 'knit').find((o) => o.value === '4.5mm')?.label;
    expect(label).toBe('4.5 mm · US 7');
  });
});
