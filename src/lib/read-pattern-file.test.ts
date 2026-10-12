import { extractMessage, looksLikeScan, tidyExtractedText } from '@/lib/read-pattern-file';

// Reading a PDF now goes through an Edge Function, so this module reaches Supabase and, under
// Jest, AsyncStorage's missing native module. Same stub as the other suites that cross that line —
// nothing here calls the network. (jest.mock is hoisted, so its position does not matter.)
jest.mock('@/lib/supabase', () => ({ getSupabase: jest.fn() }));

describe('tidyExtractedText', () => {
  it('collapses the stray spacing a PDF text layer produces, keeping line breaks', () => {
    expect(tidyExtractedText('Row 1   (RS):  K2,   p4  \n   Row 2: purl')).toBe(
      'Row 1 (RS): K2, p4\nRow 2: purl',
    );
  });

  it('normalises Windows line endings and caps runs of blank lines', () => {
    expect(tidyExtractedText('Sleeve\r\n\r\n\r\n\r\nRow 1: knit')).toBe('Sleeve\n\nRow 1: knit');
  });

  it('strips the non-breaking spaces PDFs are full of', () => {
    expect(tidyExtractedText('Row 1: knit')).toBe('Row 1: knit');
  });
});

describe('looksLikeScan', () => {
  // The distinction that matters: a scanned pattern has pixels where its words should be, so the
  // text layer comes back near-empty. Calling that "imported" would hand the parser nothing.
  it('treats a near-empty text layer as a scan', () => {
    expect(looksLikeScan('Sleeve', 3)).toBe(true);
  });

  it('accepts a page with real text on it', () => {
    expect(looksLikeScan('Row 1 (RS): K1, M1L, knit to last st, M1R, K1. '.repeat(3), 1)).toBe(
      false,
    );
  });

  // A long scan often has a title page or a header that survives as text — judging the whole
  // document by an absolute threshold would let it through.
  it('scales with page count, so one readable page does not vouch for twenty', () => {
    const onePageOfText = 'Row 1 (RS): K1, M1L, knit to last st, M1R, K1. '.repeat(3);
    expect(looksLikeScan(onePageOfText, 1)).toBe(false);
    expect(looksLikeScan(onePageOfText, 20)).toBe(true);
  });
});

describe('extractMessage', () => {
  it("turns the server's sentinel into something a knitter can act on", () => {
    expect(extractMessage(new Error('unreadable'))).toContain('password-protected');
  });

  it('passes a real explanation straight through rather than burying it', () => {
    // A timeout or a size refusal already says what happened; the old code replaced every one of
    // them with a guess about encryption.
    expect(extractMessage(new Error('That file is too big to read (over 12MB).'))).toBe(
      'That file is too big to read (over 12MB).',
    );
  });

  it('still says something when it is handed nothing useful', () => {
    expect(extractMessage(undefined)).toMatch(/pasting the text/);
  });
});
