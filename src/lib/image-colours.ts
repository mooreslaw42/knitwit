import { invokeEdgeFunction } from '@/lib/edge-function';

// Asking the server what colours a picture is made of.
//
// Reading pixels needs a canvas and Hermes has none, so this happens in an Edge Function — the
// same reason `read-pattern-file.ts` sends a PDF out rather than opening it here. See
// supabase/functions/image-colours.

// A handful of colours off one photo is a small job. Long enough for a cold start, short enough
// that a knitter waiting on a swatch is not left wondering.
const TIMEOUT_MS = 30_000;

export type ImageColours = {
  colours: string[];
  width: number;
  height: number;
  // Present only when a grid was asked for: one palette index per stitch, row-major.
  grid?: number[];
};

// A data URL is what the app holds a photo as; bytes are what the function wants. Done by hand
// rather than with fetch(), which cannot read a data: URL on every runtime this app runs on —
// the same reason sync/photos.ts does it this way.
export function dataUrlToBytes(dataUrl: string): Uint8Array | null {
  const comma = dataUrl.indexOf(',');
  if (comma === -1) return null;
  try {
    const binary = atob(dataUrl.slice(comma + 1));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

// What the server's one-word refusals mean, said to a knitter. Kept here with the rest of the
// wording rather than in a server log.
export function colourMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message === 'unsupported') return 'That needs to be a PNG or a JPEG.';
  if (message === 'unreadable') return "Couldn't read that picture.";
  if (message === 'blank') return 'That picture has nothing in it to read.';
  if (message) return message;
  return "Couldn't read the colours from that picture.";
}

export async function imageColours(
  bytes: Uint8Array,
  options: { colours: number; stitches?: number; rows?: number; signal?: AbortSignal },
): Promise<ImageColours> {
  const query = new URLSearchParams({ colours: String(options.colours) });
  // Both or neither — a width without a row count is not a chart.
  if (options.stitches && options.rows) {
    query.set('stitches', String(options.stitches));
    query.set('rows', String(options.rows));
  }

  const data = await invokeEdgeFunction(`image-colours?${query}`, bytes, {
    timeoutMs: TIMEOUT_MS,
    timeoutMessage: 'Reading that picture took too long.',
    signal: options.signal,
  });

  const body = data as Partial<ImageColours>;
  if (!Array.isArray(body?.colours) || typeof body?.width !== 'number') {
    throw new Error('Malformed response.');
  }
  return body as ImageColours;
}
