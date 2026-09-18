import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// Turning the document into a file somebody can keep.
//
// The two platforms reach a PDF by genuinely different routes, which is why this is split rather
// than branched. On a phone `expo-print` renders the HTML itself and hands back a file, which then
// goes to the share sheet — where a knitter can mail it, drop it in Files, or send it to a printer.
// On the web the browser's own print dialog is the route, and "Save as PDF" is a button inside it;
// see print-pattern.web.ts.
//
// Both produce real vector text — selectable, searchable, sharp at any zoom. The alternative,
// drawing the screen into an image and wrapping that in a PDF, would give a knitter a photograph
// of a pattern rather than a pattern.

export type PrintOutcome =
  | { status: 'shared' }
  // Backing out of the share sheet is a decision, not a failure, and nothing should be said of it.
  | { status: 'cancelled' }
  | { status: 'failed'; message: string };

export async function printPattern(html: string, filename: string): Promise<PrintOutcome> {
  try {
    const { uri } = await Print.printToFileAsync({ html });

    if (!(await Sharing.isAvailableAsync())) {
      // No share sheet on this device — the file exists, but there is nowhere to send it from here.
      return { status: 'failed', message: 'This device has nowhere to send the file.' };
    }

    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: filename,
      UTI: 'com.adobe.pdf',
    });
    return { status: 'shared' };
  } catch (problem) {
    const message = problem instanceof Error ? problem.message : '';
    // expo-sharing rejects on dismissal on some platforms rather than resolving.
    if (/cancel|dismiss/i.test(message)) return { status: 'cancelled' };
    return { status: 'failed', message: "Knitwit couldn't make the PDF." };
  }
}
