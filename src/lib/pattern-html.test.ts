import { EN, patternHtml } from '@/lib/pattern-html';
import type { Pattern, PatternSection } from '@/types/knitwit';

const section = (over: Partial<PatternSection> = {}): PatternSection => ({
  id: 's1',
  updatedAt: '2026-01-01T00:00:00.000Z',
  name: 'Sleeve',
  totalRows: 40,
  castOn: 60,
  materials: [],
  tools: [],
  techniques: [],
  description: '',
  rows: [],
  rowNotes: [],
  notes: '',
  markers: [],
  stitchMultiple: null,
  ...over,
});

const pattern = (over: Partial<Pattern> = {}): Pattern => ({
  name: 'Winter Jumper',
  category: 'sweaters',
  craft: 'knit',
  weight: '',
  needleSize: '4.5mm',
  video: '',
  sourceName: '',
  sourceText: '',
  accentColor: '#E58AA0',
  photo: null,
  gauge: null,
  swatchGauge: null,
  favorited: false,
  notes: '',
  level: 'beginner',
  sizes: [],
  materials: [],
  tools: [],
  techniques: [],
  sections: [],
  ...over,
});

// The document is going to be shared, so it carries other people's typing into markup. Everything
// below is about it staying a document rather than becoming a program.
describe('what reaches the page', () => {
  it('escapes a name that looks like markup', () => {
    const html = patternHtml({ pattern: pattern({ name: '<script>alert(1)</script>' }), photo: null });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes what a knitter wrote in a section', () => {
    const html = patternHtml({
      pattern: pattern({ sections: [section({ description: 'k2 <b>tog</b> & p1' })] }),
      photo: null,
    });
    expect(html).toContain('&lt;b&gt;');
    expect(html).toContain('&amp;');
  });

  // An accent colour is written straight into a stylesheet, which is the one place a string stops
  // being text and starts being syntax.
  it('refuses an accent colour that is not one', () => {
    const html = patternHtml({
      pattern: pattern({ accentColor: 'red; } body { display:none } .x {' }),
      photo: null,
    });
    expect(html).not.toContain('display:none');
  });
});

describe('the document itself', () => {
  it('puts the name and the picture on the cover', () => {
    const html = patternHtml({ pattern: pattern(), photo: 'data:image/jpeg;base64,AAAA' });
    expect(html).toContain('Winter Jumper');
    expect(html).toContain('src="data:image/jpeg;base64,AAAA"');
  });

  // Nothing is missing when there is no photo — a cover is still a cover.
  it('still prints a cover without a picture', () => {
    const html = patternHtml({ pattern: pattern(), photo: null });
    expect(html).toContain('class="shot blank"');
    expect(html).toContain('Winter Jumper');
  });

  it('gives each section its own page', () => {
    const html = patternHtml({
      pattern: pattern({ sections: [section({ name: 'Body' }), section({ name: 'Sleeve' })] }),
      photo: null,
    });
    expect(html).toContain('Body');
    expect(html).toContain('Sleeve');
    expect(html).toContain('page-break-before: always');
  });

  // Counts are stated per size on real patterns, and flattening them to the first size would print
  // a garment in one size and call it three.
  it('keeps every size of a per-size count', () => {
    const html = patternHtml({
      pattern: pattern({ sections: [section({ castOn: [96, 104, 112] })] }),
      photo: null,
    });
    expect(html).toContain('96 · 104 · 112');
  });

  // The knitter's own words beat the structured version: it is how knitters write to each other.
  it('prefers the written row to the charted one', () => {
    const html = patternHtml({
      pattern: pattern({
        sections: [
          section({
            rows: [
              {
                id: 'r1',
                label: 'Row 1',
                side: 'RS',
                marker: false,
                instruction: 'k2, p2 to end',
                stitches: [
                  { id: 'g1', type: 'knit', span: 'exact', count: 2, materialSlot: null, note: '' },
                ],
              },
            ],
          }),
        ],
      }),
      photo: null,
    });
    expect(html).toContain('k2, p2 to end');
  });

  it('falls back to the stitches for a row that was only ever charted', () => {
    const html = patternHtml({
      pattern: pattern({
        sections: [
          section({
            rows: [
              {
                id: 'r1',
                label: 'Row 1',
                side: 'RS',
                marker: false,
                instruction: '',
                stitches: [
                  { id: 'g1', type: 'knit', span: 'exact', count: 2, materialSlot: null, note: '' },
                  { id: 'g2', type: 'purl', span: 'all', count: null, materialSlot: null, note: '' },
                ],
              },
            ],
          }),
        ],
      }),
      photo: null,
    });
    expect(html).toContain('k2');
    expect(html).toContain('across');
  });

  it('says so rather than printing an empty section', () => {
    const html = patternHtml({ pattern: pattern({ sections: [section()] }), photo: null });
    expect(html).toContain(EN.noInstructions);
  });

  // The labels are an argument so that a translated document does not need a second copy of the
  // markup to put its own words in.
  it('takes its wording from the strings it is given', () => {
    const html = patternHtml({
      pattern: pattern({ sections: [section()] }),
      photo: null,
      strings: { ...EN, noInstructions: 'Nog geen instructies.', materials: 'Garen' },
    });
    expect(html).toContain('Nog geen instructies.');
  });
});
