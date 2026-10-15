import { dedupe, medianCut, nearestIndex, samplePixels, toGrid, toHex, type Rgb } from './quantise.ts';

// Like provider-greenpt.test.ts: Deno code, but plain TypeScript with no Deno globals, so Jest
// runs it. Worth testing here rather than through the handler — these are the decisions that
// decide what a knitter ends up casting on, and an image in the way would only obscure them.

// A flat RGBA block of one colour, `n` pixels long.
const block = (colour: Rgb, n: number): number[] =>
  Array.from({ length: n }, () => [...colour, 255]).flat();

describe('toHex', () => {
  it('pads a channel that needs it, rather than producing a five-character colour', () => {
    expect(toHex([255, 10, 0])).toBe('#ff0a00');
  });
});

describe('medianCut', () => {
  it('finds the colours a picture is actually made of', () => {
    const red: Rgb = [200, 20, 20];
    const blue: Rgb = [20, 20, 200];
    const palette = medianCut([...Array(50).fill(red), ...Array(50).fill(blue)], 2);

    expect(palette).toHaveLength(2);
    expect(palette.map(toHex).sort()).toEqual(['#1414c8', '#c81414'].sort());
  });

  it('does not invent colours a flat image does not contain', () => {
    // Asking a single-colour picture for six colours should give one, not six shades of a lie.
    const palette = medianCut(Array(100).fill([120, 120, 120]) as Rgb[], 6);
    expect(palette).toHaveLength(1);
  });

  it('returns nothing for nothing', () => {
    expect(medianCut([], 4)).toEqual([]);
  });
});

describe('dedupe', () => {
  it('merges two colours a knitter could not tell apart', () => {
    // Median cut returns near-duplicates when an image is mostly one shade. Two of these would
    // mean buying a second skein for a difference nobody can see.
    expect(dedupe([[253, 246, 238], [252, 245, 237]])).toHaveLength(1);
  });

  it('keeps colours that are genuinely different', () => {
    expect(dedupe([[253, 246, 238], [134, 85, 59]])).toHaveLength(2);
  });
});

describe('nearestIndex', () => {
  it('picks the closest colour in the palette', () => {
    const palette: Rgb[] = [[0, 0, 0], [255, 255, 255]];
    expect(nearestIndex([20, 20, 20], palette)).toBe(0);
    expect(nearestIndex([230, 230, 230], palette)).toBe(1);
  });
});

describe('samplePixels', () => {
  it('leaves out transparent pixels, which are not a colour anyone knits', () => {
    const data = [...block([10, 20, 30], 1), 10, 20, 30, 0];
    expect(samplePixels(new Uint8Array(data), 2)).toEqual([[10, 20, 30]]);
  });
});

describe('toGrid', () => {
  it('gives one stitch per cell, row-major', () => {
    const data = new Uint8Array(block([200, 20, 20], 16));
    const grid = toGrid(data, 4, 4, 2, 2, [[200, 20, 20]]);
    expect(grid).toEqual([0, 0, 0, 0]);
  });

  it('averages the block a stitch covers, so one stray pixel cannot decide it', () => {
    // A 2x1 image: one red pixel, one very slightly different red. As a single stitch they are
    // the same stitch.
    const data = new Uint8Array([200, 20, 20, 255, 190, 30, 30, 255]);
    const palette: Rgb[] = [[195, 25, 25], [20, 20, 200]];
    expect(toGrid(data, 2, 1, 1, 1, palette)).toEqual([0]);
  });

  it('never leaves a hole, because a chart with a gap in it is not knittable', () => {
    const data = new Uint8Array([0, 0, 0, 0]); // one wholly transparent pixel
    const grid = toGrid(data, 1, 1, 1, 1, [[128, 128, 128]]);
    expect(grid).toEqual([0]);
  });
});
