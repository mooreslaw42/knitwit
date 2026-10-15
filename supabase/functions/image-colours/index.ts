import decodeJpeg from '@jsquash/jpeg/decode';
import decodePng from '@jsquash/png/decode';

import { medianCut, samplePixels, toGrid, toHex, type Rgb } from './quantise.ts';

// Reduces a picture to the few colours a knitter would work it in, and optionally to a grid of
// stitches.
//
// Server-side for the same reason as `extract-pdf`: reading pixels needs a canvas, and Hermes has
// none. The decoders here are WASM rather than native bindings, so they run on the Edge Runtime
// without a build step.
//
// Two callers, one job:
//   - the material editor, taking a yarn's real colour off its photo
//   - the pixel-pattern flow, turning a picture into a colourwork chart
//
// No model, no key, no spend. It is arithmetic on pixels.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// A photo the app already downscales before it ever gets here.
const MAX_BYTES = 8 * 1024 * 1024;
// Below two there is nothing to choose between; above this a knitter is managing more ends than
// stitches, and the palette stops meaning anything.
const MIN_COLOURS = 2;
const MAX_COLOURS = 24;
// A chart wider than this is not something anyone follows stitch by stitch, and the response grows
// with the square of it.
const MAX_STITCHES = 250;
const MAX_ROWS = 400;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// Trusting the declared content type would mean trusting the caller about what it is handing a
// decoder. The first bytes are the file saying what it is.
function sniff(bytes: Uint8Array): 'png' | 'jpeg' | null {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e) return 'png';
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  return null;
}

function intParam(url: URL, name: string, fallback: number): number {
  const raw = url.searchParams.get(name);
  if (raw === null) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return json({ error: 'Send the image as a POST body.' }, 405);

  const url = new URL(request.url);
  const colours = Math.min(MAX_COLOURS, Math.max(MIN_COLOURS, intParam(url, 'colours', 6)));
  // Both or neither: a width without a row count is not a chart, and guessing the other half is
  // the app's job — it is the one that knows the knitter's gauge.
  const stitches = intParam(url, 'stitches', 0);
  const rows = intParam(url, 'rows', 0);
  const wantsGrid = stitches > 0 && rows > 0;
  if (wantsGrid && (stitches > MAX_STITCHES || rows > MAX_ROWS)) {
    return json({ error: `That chart is too big (max ${MAX_STITCHES} × ${MAX_ROWS}).` }, 400);
  }

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await request.arrayBuffer());
  } catch {
    return json({ error: "Couldn't read the uploaded image." }, 400);
  }
  if (bytes.byteLength === 0) return json({ error: 'That image is empty.' }, 400);
  if (bytes.byteLength > MAX_BYTES) return json({ error: 'That image is too big (over 8MB).' }, 413);

  const kind = sniff(bytes);
  if (!kind) return json({ error: 'unsupported' }, 415);

  // ImageData is what both decoders hand back; naming it structurally fights its ArrayBufferLike
  // backing for no gain.
  let image: ImageData;
  try {
    const buffer = bytes.buffer as ArrayBuffer;
    image = kind === 'png' ? await decodePng(buffer) : await decodeJpeg(buffer);
  } catch (error) {
    console.error('image-colours decode failed', error);
    return json({ error: 'unreadable' }, 422);
  }

  const samples = samplePixels(image.data, image.width * image.height);
  if (!samples.length) return json({ error: 'blank' }, 422);

  const palette: Rgb[] = medianCut(samples, colours);
  const body: Record<string, unknown> = {
    colours: palette.map(toHex),
    width: image.width,
    height: image.height,
  };

  if (wantsGrid) {
    body.grid = toGrid(image.data, image.width, image.height, stitches, rows, palette);
    body.stitches = stitches;
    body.rows = rows;
  }

  return json(body);
});
