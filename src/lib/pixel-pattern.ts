// Turning a photo into a colourwork chart — the maths, with no screen or file picker in sight.
//
// A pixel pattern is a photo reduced to a small grid of a few colours, then read as knitting or
// crochet: one cell is one stitch, one palette colour is one yarn. This file is the pure core of
// that — box-sample the image down to the grid, median-cut it to a handful of colours, and emit a
// real Pattern (material slot per colour, a chart row per grid row) the rest of the app already
// knows how to draw and count. The platform-specific job of getting pixels out of an image lives
// in pixel-image.ts; everything here is deterministic and unit-tested.

import { entityId, newPatternSection } from '@/lib/entity-id';
import type { PatternMaterial, PatternRow, PatternSection, TechniqueCraft } from '@/types/knitwit';

export type Rgb = { r: number; g: number; b: number };

// A decoded image: RGBA bytes, four per pixel, row-major from the top-left. `data` is whatever a
// decoder hands back — jpeg-js' Uint8Array on native, a canvas' Uint8ClampedArray on web.
export type ImageSample = { width: number; height: number; data: Uint8Array | Uint8ClampedArray };

// What the platform-specific loader (load-image-data{,.web}.ts) returns: the pixels to quantise,
// plus a JPEG data URL of the same downscaled image to keep as the pattern's photo.
export type LoadedImage = { sample: ImageSample; photoDataUrl: string };

// The image reduced to a grid of palette indices. `cells` is row-major from the top-left, same
// orientation as the source — index i is palette[cells[i]]. Height follows the source's aspect
// ratio, so the picture is never squashed.
export type QuantizedGrid = {
  width: number;
  height: number;
  palette: Rgb[];
  cells: number[];
};

// Knitting recommends a touch finer than crochet because a knit stitch is wider than it is tall;
// both ceilings stay inside the chart's drawing budget (see chart-limits.ts) at a square-ish grid.
export const PIXEL_WIDTH = { min: 10, max: 60, default: 32 } as const;
export const PIXEL_COLORS = { min: 2, max: 12, default: 6 } as const;

// Height that keeps the source's aspect ratio, never below one row.
export function gridHeight(sample: { width: number; height: number }, targetWidth: number): number {
  if (sample.width <= 0 || sample.height <= 0) return 1;
  return Math.max(1, Math.round((targetWidth * sample.height) / sample.width));
}

// Average every source pixel that falls in a cell, so shrinking a photo blends rather than picking
// one pixel in each block and throwing the rest away. Returns one Rgb per cell, row-major.
function boxSample(sample: ImageSample, cols: number, rows: number): Rgb[] {
  const { width, height, data } = sample;
  const out: Rgb[] = new Array(cols * rows);
  for (let cy = 0; cy < rows; cy++) {
    const y0 = Math.floor((cy * height) / rows);
    const y1 = Math.max(y0 + 1, Math.floor(((cy + 1) * height) / rows));
    for (let cx = 0; cx < cols; cx++) {
      const x0 = Math.floor((cx * width) / cols);
      const x1 = Math.max(x0 + 1, Math.floor(((cx + 1) * width) / cols));
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let y = y0; y < y1 && y < height; y++) {
        for (let x = x0; x < x1 && x < width; x++) {
          const i = (y * width + x) * 4;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          n++;
        }
      }
      n = n || 1;
      out[cy * cols + cx] = { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
    }
  }
  return out;
}

// Median-cut quantisation: start with every pixel in one box, repeatedly split the box with the
// widest colour spread along its longest channel until there are `count` boxes, then take each
// box's average as a palette colour. A good, cheap way to pick colours that are actually in the
// picture rather than a fixed ramp.
function medianCut(pixels: Rgb[], count: number): Rgb[] {
  if (pixels.length === 0) return [{ r: 0, g: 0, b: 0 }];
  let boxes: Rgb[][] = [pixels];
  while (boxes.length < count) {
    // Split the box whose colours are most spread out — splitting a nearly-flat box buys nothing.
    let bestIndex = -1;
    let bestRange = -1;
    let bestChannel: keyof Rgb = 'r';
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].length < 2) continue;
      const { channel, range } = widestChannel(boxes[i]);
      if (range > bestRange) {
        bestRange = range;
        bestIndex = i;
        bestChannel = channel;
      }
    }
    if (bestIndex < 0) break; // every box is a single colour; nothing left to split
    const box = boxes[bestIndex];
    const sorted = [...box].sort((a, b) => a[bestChannel] - b[bestChannel]);
    const mid = sorted.length >> 1;
    boxes = [...boxes.slice(0, bestIndex), sorted.slice(0, mid), sorted.slice(mid), ...boxes.slice(bestIndex + 1)];
  }
  return boxes.map(averageRgb);
}

function widestChannel(box: Rgb[]): { channel: keyof Rgb; range: number } {
  let rMin = 255;
  let rMax = 0;
  let gMin = 255;
  let gMax = 0;
  let bMin = 255;
  let bMax = 0;
  for (const p of box) {
    if (p.r < rMin) rMin = p.r;
    if (p.r > rMax) rMax = p.r;
    if (p.g < gMin) gMin = p.g;
    if (p.g > gMax) gMax = p.g;
    if (p.b < bMin) bMin = p.b;
    if (p.b > bMax) bMax = p.b;
  }
  const ranges: { channel: keyof Rgb; range: number }[] = [
    { channel: 'r', range: rMax - rMin },
    { channel: 'g', range: gMax - gMin },
    { channel: 'b', range: bMax - bMin },
  ];
  return ranges.reduce((a, b) => (b.range > a.range ? b : a));
}

function averageRgb(box: Rgb[]): Rgb {
  if (box.length === 0) return { r: 0, g: 0, b: 0 };
  let r = 0;
  let g = 0;
  let b = 0;
  for (const p of box) {
    r += p.r;
    g += p.g;
    b += p.b;
  }
  return { r: Math.round(r / box.length), g: Math.round(g / box.length), b: Math.round(b / box.length) };
}

function nearest(color: Rgb, palette: Rgb[]): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const dr = color.r - palette[i].r;
    const dg = color.g - palette[i].g;
    const db = color.b - palette[i].b;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

// The whole reduction: photo → grid of a few colours. `colors` is a ceiling — a picture with fewer
// distinct colours than asked for yields a smaller palette rather than padding it with duplicates.
export function quantize(sample: ImageSample, targetWidth: number, colors: number): QuantizedGrid {
  const width = Math.max(1, Math.min(targetWidth, PIXEL_WIDTH.max));
  const height = gridHeight(sample, width);
  const pixels = boxSample(sample, width, height);
  const palette = medianCut(pixels, Math.max(PIXEL_COLORS.min, Math.min(colors, PIXEL_COLORS.max)));
  const cells = pixels.map((p) => nearest(p, palette));
  // Drop palette entries no cell actually uses, and renumber — asking for 8 colours on a photo that
  // only needs 5 should leave a key of 5, not 8 with three that never appear.
  const used = Array.from(new Set(cells)).sort((a, b) => a - b);
  const remap = new Map(used.map((old, next) => [old, next]));
  return {
    width,
    height,
    palette: used.map((i) => palette[i]),
    cells: cells.map((c) => remap.get(c)!),
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const h = (n: number) => n.toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

// A, B, … Z, then AA, AB, … — the short tag a colourwork key hangs on. Twelve colours never reach
// past L, but the wrap keeps it honest.
export function colorTag(index: number): string {
  let n = index;
  let tag = '';
  do {
    tag = String.fromCharCode(65 + (n % 26)) + tag;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return tag;
}

export type PixelPatternParts = {
  materials: PatternMaterial[];
  section: PatternSection;
};

// Build the material slots and the one charted section a pixel pattern is. The rows are oriented so
// the knitting chart (bottom-up, stitch 1 on the right — see stitch-chart.tsx) draws the picture
// the right way up and the right way round, matching the photo rather than a mirror of it.
export function buildPixelPattern(grid: QuantizedGrid, craft: TechniqueCraft): PixelPatternParts {
  const stitch = craft === 'crochet' ? 'sc' : 'knit';
  const materials: PatternMaterial[] = grid.palette.map((rgb, i) => ({
    id: entityId('mat'),
    label: `Colour ${colorTag(i)}`,
    short: colorTag(i),
    color: rgbToHex(rgb),
  }));

  const rows: PatternRow[] = [];
  // Pattern row 0 is the bottom of the picture, because the chart draws row 0 lowest.
  for (let r = 0; r < grid.height; r++) {
    const imageRow = grid.height - 1 - r;
    const stitches = [];
    // Right-to-left across the image: the chart reverses each row to read right-to-left, so storing
    // the rightmost cell first lands the picture unmirrored on the screen.
    let x = grid.width - 1;
    while (x >= 0) {
      const idx = grid.cells[imageRow * grid.width + x];
      let run = 0;
      while (x >= 0 && grid.cells[imageRow * grid.width + x] === idx) {
        run++;
        x--;
      }
      stitches.push({
        id: entityId('g'),
        type: stitch,
        span: 'exact' as const,
        count: run,
        materialSlot: materials[idx].id,
        note: '',
      });
    }
    rows.push({ id: entityId('r'), label: '', side: 'RS' as const, marker: false, instruction: '', stitches });
  }

  const section = newPatternSection({
    name: 'Pixel chart',
    totalRows: grid.height,
    castOn: grid.width,
    materials: materials.map((m) => m.id),
    tools: [],
    techniques: [],
    description: '',
    rows,
    rowNotes: [],
    notes: `${grid.width} × ${grid.height} stitches, ${materials.length} colours. One cell is one stitch.`,
    markers: [],
    stitchMultiple: null,
  });

  return { materials, section };
}
