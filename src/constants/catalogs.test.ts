import { careSymbolIsDrawn } from '@/components/care-symbol';
import {
  CARE_SYMBOLS,
  careSymbolGroups,
  describeToolSize,
  formatToolSize,
  scaleForToolType,
  STITCH_ORDER,
  TOOL_SIZES,
  toolSizeLabel,
  toggleCareSymbol,
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

// The care symbols on a ball band. Ticked off against the band rather than chosen from, so the
// list is what matters: the ids are stored on the material, and the order the knitter picked them
// in is the order they are shown back.
describe('care symbols', () => {
  it('has a unique id for every symbol', () => {
    const ids = CARE_SYMBOLS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // A symbol with no drawing would show as a labelled hole. The vocabulary and the ink live in
  // separate files, so nothing but this keeps them in step.
  it('can draw every symbol it offers', () => {
    const missing = CARE_SYMBOLS.filter((s) => !careSymbolIsDrawn(s.id)).map((s) => s.id);
    expect(missing).toEqual([]);
  });

  it('groups the symbols the way a label prints them, each family once', () => {
    const groups = careSymbolGroups().map((g) => g.group);
    expect(groups).toEqual(['Washing', 'Bleaching', 'Drying', 'Ironing', 'Professional care']);
    expect(new Set(groups).size).toBe(groups.length);
    expect(careSymbolGroups().reduce((n, g) => n + g.symbols.length, 0)).toBe(CARE_SYMBOLS.length);
  });

  describe('toggleCareSymbol', () => {
    it('ticks one on, and keeps the order they were ticked in', () => {
      expect(toggleCareSymbol(['wash-30'], 'iron-no')).toEqual(['wash-30', 'iron-no']);
    });

    it('ticks one off without disturbing the rest', () => {
      expect(toggleCareSymbol(['wash-30', 'iron-no', 'dry-flat'], 'iron-no')).toEqual([
        'wash-30',
        'dry-flat',
      ]);
    });

    // The field is optional and was added after the first yarns were saved, so most materials
    // arrive here with nothing at all.
    it('starts a list from a material that has none', () => {
      expect(toggleCareSymbol(undefined, 'wash-hand')).toEqual(['wash-hand']);
    });

    it('leaves a symbol it does not know alone rather than dropping it', () => {
      // Saved by a later version: unknown here, and still the knitter's answer.
      expect(toggleCareSymbol(['wash-hand', 'steam-2027'], 'dry-flat')).toEqual([
        'wash-hand',
        'steam-2027',
        'dry-flat',
      ]);
    });
  });
});
