import { extractText, getDocumentProxy } from 'unpdf';

// Pulls the text layer out of a PDF a knitter uploaded, and nothing else.
//
// This runs on the server because it cannot run anywhere else. The library that reads a PDF is
// pdf.js, which wants DOMMatrix, Path2D and OffscreenCanvas — browser globals that exist on the
// web but not in Hermes, so the app's own copy threw on every upload from a phone and the knitter
// was told their PDF might be password-protected. Deno has them, so one call from either platform
// now takes the same path.
//
// Deliberately not a model call: no prompt, no key, no spend. It extracts characters and hands
// them back. Whether those characters amount to a pattern is `parse-pattern`'s question, and
// whether there are enough of them to be a text layer at all is the app's.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// The app refuses anything larger before it uploads, so this is the backstop rather than the rule.
// Matched to the client's own ceiling so the two can't disagree about what is too big.
const MAX_BYTES = 12 * 1024 * 1024;

// A pattern that runs past this is not a pattern. The cap is on what we send back, because the
// response crosses the wire and the app holds it in memory on a phone.
const MAX_TEXT_CHARS = 600_000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return json({ error: 'Send the PDF as a POST body.' }, 405);

  // Raw bytes rather than base64: a 12MB PDF becomes a 16MB string otherwise, which is a lot to
  // build and hold on a phone for no gain.
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await request.arrayBuffer());
  } catch {
    return json({ error: "Couldn't read the uploaded file." }, 400);
  }

  if (bytes.byteLength === 0) return json({ error: 'That file is empty.' }, 400);
  if (bytes.byteLength > MAX_BYTES) {
    return json({ error: 'That file is too big to read (over 12MB).' }, 413);
  }

  let text: string;
  let pages: number;
  try {
    const pdf = await getDocumentProxy(bytes);
    const extracted = await extractText(pdf, { mergePages: true });
    text = Array.isArray(extracted.text) ? extracted.text.join('\n\n') : extracted.text;
    pages = extracted.totalPages;
  } catch (error) {
    // An encrypted or truncated PDF lands here. The app turns this into something a knitter can
    // act on; the detail is for the log.
    console.error('extract-pdf failed', error);
    return json({ error: 'unreadable' }, 422);
  }

  return json({ text: text.slice(0, MAX_TEXT_CHARS), pages });
});
