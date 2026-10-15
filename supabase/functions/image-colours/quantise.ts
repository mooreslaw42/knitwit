// Reducing a picture to the few colours a knitter would actually work it in.
//
// Kept apart from the handler so the arithmetic can be read, and tested, without an image or a
// server in the way.

export type Rgb = [number, number, number];

export function toHex([r, g, b]: Rgb): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

// Sampling rather than reading every pixel: a palette does not get better for being drawn from
// three quarters of a million samples instead of twenty thousand, and the difference is the whole
// cost of the call.
const MAX_SAMPLES = 20_000;

export function samplePixels(data: ArrayLike<number>, pixels: number): Rgb[] {
  const stride = Math.max(1, Math.floor(pixels / MAX_SAMPLES));
  const out: Rgb[] = [];
  for (let i = 0; i < pixels; i += stride) {
    const o = i * 4;
    // Transparent pixels are not a colour anyone knits; they would otherwise drag the palette
    // towards whatever happens to sit in the unused channels.
    if (data[o + 3] < 128) continue;
    out.push([data[o], data[o + 1], data[o + 2]]);
  }
  return out;
}

function spread(box: Rgb[], channel: number): number {
  let lo = 255;
  let hi = 0;
  for (const p of box) {
    if (p[channel] < lo) lo = p[channel];
    if (p[channel] > hi) hi = p[channel];
  }
  return hi - lo;
}

function widestChannel(box: Rgb[]): number {
  let channel = 0;
  let best = -1;
  for (let c = 0; c < 3; c++) {
    const s = spread(box, c);
    if (s > best) {
      best = s;
      channel = c;
    }
  }
  return channel;
}

function average(box: Rgb[]): Rgb {
  const sum = box.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0]);
  return [
    Math.round(sum[0] / box.length),
    Math.round(sum[1] / box.length),
    Math.round(sum[2] / box.length),
  ];
}

// Two colours a knitter could not tell apart are not two colours — they are one, and a second
// skein bought for nothing. Median cut happily returns near-duplicates when an image is mostly one
// shade, so near-identical entries are merged rather than offered.
//
// The threshold is a plain channel distance. It does not need to be perceptual to catch the case
// it is for, which is two entries a few units apart.
const MIN_DISTANCE = 18;

function distance(a: Rgb, b: Rgb): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

export function dedupe(colours: Rgb[]): Rgb[] {
  const out: Rgb[] = [];
  for (const c of colours) {
    if (!out.some((kept) => distance(kept, c) < MIN_DISTANCE)) out.push(c);
  }
  return out;
}

// Median cut: split the box with the widest spread in any channel, along that channel, until there
// are as many boxes as colours wanted. Each box's average is its colour.
export function medianCut(pixels: Rgb[], want: number): Rgb[] {
  if (!pixels.length) return [];
  let boxes: Rgb[][] = [pixels];

  while (boxes.length < want) {
    let target = -1;
    let widest = -1;
    boxes.forEach((box, i) => {
      if (box.length < 2) return;
      const s = spread(box, widestChannel(box));
      if (s > widest) {
        widest = s;
        target = i;
      }
    });
    // Everything left is a single pixel or a flat block: splitting further invents distinctions
    // the picture does not contain.
    if (target === -1 || widest <= 0) break;

    const box = boxes[target];
    const channel = widestChannel(box);
    box.sort((a, b) => a[channel] - b[channel]);
    const mid = box.length >> 1;
    boxes = [
      ...boxes.slice(0, target),
      box.slice(0, mid),
      box.slice(mid),
      ...boxes.slice(target + 1),
    ];
  }

  return dedupe(boxes.filter((b) => b.length).map(average));
}

export function nearestIndex(colour: Rgb, palette: Rgb[]): number {
  let best = 0;
  let bestDistance = Infinity;
  palette.forEach((p, i) => {
    const d = distance(colour, p);
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  });
  return best;
}

// Averaging the block a stitch covers, rather than sampling its middle pixel, so a single stray
// pixel can't decide a stitch. Returns one palette index per stitch, row-major.
export function toGrid(
  data: ArrayLike<number>,
  imageWidth: number,
  imageHeight: number,
  stitches: number,
  rows: number,
  palette: Rgb[],
): number[] {
  const grid: number[] = [];
  for (let row = 0; row < rows; row++) {
    for (let stitch = 0; stitch < stitches; stitch++) {
      const x0 = Math.floor((stitch * imageWidth) / stitches);
      const x1 = Math.max(x0 + 1, Math.floor(((stitch + 1) * imageWidth) / stitches));
      const y0 = Math.floor((row * imageHeight) / rows);
      const y1 = Math.max(y0 + 1, Math.floor(((row + 1) * imageHeight) / rows));
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const o = (y * imageWidth + x) * 4;
          if (data[o + 3] < 128) continue;
          r += data[o];
          g += data[o + 1];
          b += data[o + 2];
          n++;
        }
      }
      // A wholly transparent block takes the nearest palette entry to mid-grey rather than
      // dropping a stitch — a chart with a hole in it is not knittable.
      const avg: Rgb = n
        ? [Math.round(r / n), Math.round(g / n), Math.round(b / n)]
        : [128, 128, 128];
      grid.push(nearestIndex(avg, palette));
    }
  }
  return grid;
}
