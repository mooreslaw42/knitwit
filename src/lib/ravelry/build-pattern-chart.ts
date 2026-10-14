import { invokeEdgeFunction } from '@/lib/edge-function';
import { importPatternDocument, type ImportedPattern } from '@/lib/import-pattern-document';
import { extractPdf } from '@/lib/read-pattern-file';
import { useKnitwitStore } from '@/store/useKnitwitStore';

import { mergePatternChart } from './merge-pattern-chart';

// Charting an imported pattern from the PDF the knitter owns.
//
// Phase 4 of docs/plans/ravelry-import.md, and the one place the import spends the model. The server
// returns the owned PDF's bytes; from there it is exactly the path a pasted PDF takes — extract the
// text locally, run it through parse-pattern, and merge the result into the card. Opt-in per pattern
// because it costs, takes a minute, and is imperfect; the metadata card is enough on its own.

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i += 1) view[i] = binary.charCodeAt(i);
  return buffer;
}

type PdfResponse = { owned?: boolean; reason?: string; pdfBase64?: string };

export async function buildPatternChartFromRavelry(patternId: string): Promise<ImportedPattern> {
  const existing = useKnitwitStore.getState().patterns[patternId];
  if (!existing) throw new Error('That pattern is not in your library.');
  const ravelryId = existing.ravelrySource?.id;
  if (!ravelryId) {
    throw new Error('That pattern did not come from Ravelry, so there is no PDF to chart.');
  }

  const response = (await invokeEdgeFunction(
    'ravelry-import',
    { task: 'pattern-pdf', patternId: Number(ravelryId) },
    {
      timeoutMs: 60_000,
      timeoutMessage: 'Fetching the pattern PDF took too long. Try again in a moment.',
    },
  )) as PdfResponse;

  if (!response?.owned || !response.pdfBase64) {
    // Not every pattern has a PDF Ravelry will hand over — a reason comes back when it can.
    throw new Error(response?.reason ?? 'There is no PDF to chart for this pattern.');
  }

  const { text } = await extractPdf(base64ToArrayBuffer(response.pdfBase64));
  const imported = await importPatternDocument(text, {
    catalogue: Object.values(useKnitwitStore.getState().catalogue),
  });

  // Re-read the card: the parse took a minute, and the knitter may have touched it meanwhile.
  const current = useKnitwitStore.getState().patterns[patternId] ?? existing;
  useKnitwitStore.getState().savePattern(patternId, mergePatternChart(current, imported.pattern));
  return imported;
}
