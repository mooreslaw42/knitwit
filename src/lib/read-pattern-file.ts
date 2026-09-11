import * as DocumentPicker from 'expo-document-picker';

// Reading a pattern file the knitter uploaded. Plain text goes straight through; a PDF is read
// through its text layer. There is deliberately no OCR — a scanned pattern is detected and
// refused with an explanation, because a bad OCR pass produces plausible-looking nonsense and
// this app's whole approach is to refuse rather than invent.

export type PatternFile =
  | { status: 'read'; name: string; text: string; pages: number | null }
  | { status: 'cancelled' }
  // Everything below is a refusal the knitter should see, phrased for them rather than for a log.
  | { status: 'refused'; name: string; message: string };

// A PDF that yields almost nothing from its text layer is a scan: the words are pixels, not text.
// The threshold is per page rather than absolute, so a long scanned document doesn't sneak past on
// the strength of a single page's header. A real pattern page carries hundreds of characters.
const MIN_CHARS_PER_PAGE = 40;

// Bigger than any plausible written pattern, and small enough that a wrong file doesn't lock up
// the tab while we try to read it.
const MAX_BYTES = 12 * 1024 * 1024;

const TEXT_EXTENSIONS = ['.txt', '.md', '.markdown', '.text', '.rtf'];

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot).toLowerCase();
}

// PDF text layers arrive as a stream of positioned fragments, so joining them naively gives either
// run-together words or a space between every letter. Collapse runs of whitespace but keep line
// breaks, since row boundaries are what the parser reads.
export function tidyExtractedText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Split out so the rule is testable without conjuring a PDF.
export function looksLikeScan(text: string, pages: number): boolean {
  return text.trim().length < MIN_CHARS_PER_PAGE * Math.max(1, pages);
}

async function bytesOf(asset: DocumentPicker.DocumentPickerAsset): Promise<ArrayBuffer> {
  // On web the picker hands back the actual File; everywhere else there's a URI to fetch.
  const file = (asset as { file?: File }).file;
  if (file) return await file.arrayBuffer();
  const response = await fetch(asset.uri);
  return await response.arrayBuffer();
}

async function extractPdf(bytes: ArrayBuffer): Promise<{ text: string; pages: number }> {
  // Imported on demand: it's the largest dependency in the app, and most sessions never upload a
  // PDF. unpdf bundles a pdfjs build that needs no worker setup, which is the usual sharp edge.
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text, totalPages } = await extractText(pdf, { mergePages: true });
  return { text: Array.isArray(text) ? text.join('\n\n') : text, pages: totalPages };
}

export async function pickPatternFile(): Promise<PatternFile> {
  let asset: DocumentPicker.DocumentPickerAsset;
  try {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      type: ['application/pdf', 'text/plain', 'text/markdown', 'text/*'],
    });
    if (result.canceled || !result.assets?.[0]) return { status: 'cancelled' };
    asset = result.assets[0];
  } catch {
    return { status: 'cancelled' };
  }

  const name = asset.name || 'pattern';
  const ext = extensionOf(name);
  const isPdf = ext === '.pdf' || asset.mimeType === 'application/pdf';
  const isText = TEXT_EXTENSIONS.includes(ext) || (asset.mimeType ?? '').startsWith('text/');

  if (!isPdf && !isText) {
    return {
      status: 'refused',
      name,
      message: `Knitwit can read PDFs and text files. ${ext || 'That file type'} isn't one — try pasting the pattern instead.`,
    };
  }

  if (typeof asset.size === 'number' && asset.size > MAX_BYTES) {
    return { status: 'refused', name, message: 'That file is too big to read (over 12MB).' };
  }

  let bytes: ArrayBuffer;
  try {
    bytes = await bytesOf(asset);
  } catch {
    return { status: 'refused', name, message: "Couldn't open that file. Try pasting the text instead." };
  }

  if (!isPdf) {
    const text = tidyExtractedText(new TextDecoder().decode(bytes));
    if (!text) return { status: 'refused', name, message: 'That file is empty.' };
    return { status: 'read', name, text, pages: null };
  }

  let extracted: { text: string; pages: number };
  try {
    extracted = await extractPdf(bytes);
  } catch {
    return {
      status: 'refused',
      name,
      message: "Couldn't read that PDF. If it's password-protected, try pasting the text instead.",
    };
  }

  const text = tidyExtractedText(extracted.text);
  if (looksLikeScan(text, extracted.pages)) {
    return {
      status: 'refused',
      name,
      message:
        'This PDF looks like a scan or photos — the words are images, so there is no text to read. ' +
        'Copy the pattern text and paste it in instead.',
    };
  }

  return { status: 'read', name, text, pages: extracted.pages };
}
