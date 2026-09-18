// The web half of print-pattern.ts — see there for why this is split.
//
// The browser's print dialog is the whole feature: it paginates properly, it renders real vector
// text, and "Save as PDF" is a button already inside it. Generating a PDF in JavaScript instead
// would mean shipping a rendering engine to do worse what every browser already does well.
//
// ## Why an iframe rather than a new window
//
// `window.open` is a popup, and a popup opened even a tick after the click that asked for it is
// blocked by default — and a knitter who has just pressed Share sees nothing happen and no reason
// why. An iframe needs no permission. It also keeps the page they were on: after printing they are
// still looking at their pattern rather than at a stray tab.

export type PrintOutcome =
  | { status: 'shared' }
  | { status: 'cancelled' }
  | { status: 'failed'; message: string };

export async function printPattern(html: string, _filename: string): Promise<PrintOutcome> {
  if (typeof document === 'undefined') {
    return { status: 'failed', message: 'Printing needs a browser.' };
  }

  const frame = document.createElement('iframe');
  // Off-screen rather than `display: none`: a hidden frame is not laid out, and a frame that was
  // never laid out prints blank in some browsers.
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText =
    'position:fixed;right:0;bottom:0;width:1px;height:1px;opacity:0;border:0;pointer-events:none;';

  try {
    await new Promise<void>((resolve, reject) => {
      // `load` fires once the images inside have loaded too, which matters: printing before the
      // cover photo arrives produces a first page with a hole in it.
      frame.onload = () => resolve();
      frame.onerror = () => reject(new Error('frame'));
      frame.srcdoc = html;
      document.body.appendChild(frame);
    });

    const view = frame.contentWindow;
    if (!view) throw new Error('no frame window');
    view.focus();
    view.print();
  } catch {
    frame.remove();
    return { status: 'failed', message: "Knitwit couldn't open the print view." };
  }

  // The dialog is modal to the browser, not to this code: `print()` returns immediately in some
  // browsers and after the dialog closes in others, and neither says whether anything was saved.
  // So the frame is cleared on a timer rather than on an event that may never come — removing it
  // any sooner would cancel the print job that is still reading from it.
  setTimeout(() => frame.remove(), 60_000);

  // Whether a file was saved is the browser's business and it does not say. Reporting "shared"
  // would be a guess; this is simply the point at which Knitwit's part is over.
  return { status: 'shared' };
}
