import { formatToolSize, TOOL_SIZES, toolSizeOptions } from '@/constants/catalogs';

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
