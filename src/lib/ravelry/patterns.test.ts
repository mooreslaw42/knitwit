import { ravelryPatternToPattern } from './patterns';
import type { RavelryPattern } from './types';

const IMPORTED_AT = '2026-10-13T00:00:00.000Z';

// Shaped on a real /patterns/{id}.json response (a fingering-weight camisole), with the name,
// author, ids and permalink anonymised.
const samplePattern: RavelryPattern = {
  id: 2222222,
  permalink: 'sample-camisole',
  name: 'Sample Camisole',
  notes: 'A sample camisole description.',
  gauge: 30,
  row_gauge: 38,
  gauge_divisor: 4,
  yardage_description: '656 - 1312 yards',
  yarn_weight_description: 'Fingering (14 wpi)',
  sizes_available: 'XS-4XL',
  difficulty_average: 4.245,
  difficulty_count: 428,
  craft: { name: 'Knitting' },
  pattern_type: { name: 'Tank/Camisole' },
  pattern_categories: [
    { name: 'Sleeveless Top', parent: { name: 'Tops', parent: { name: 'Clothing' } } },
  ],
  pattern_needle_sizes: [
    { metric: 3.0, hook: null, name: 'US 2½ - 3.0 mm' },
    { metric: 2.5, hook: null, name: 'US 1½ - 2.5 mm' },
    { metric: 2.0, hook: null, name: 'US 0 - 2.0 mm' },
  ],
  pattern_author: { name: 'Sample Designer' },
  photos: [{ medium_url: 'https://example.test/camisole_medium.jpg', square_url: 'https://example.test/camisole_square.jpg' }],
  languages: [{ name: 'Danish' }, { name: 'English' }, { name: 'German' }, { name: 'Norwegian' }, { name: 'Swedish' }],
  personal_attributes: { favorited: false },
};

describe('ravelryPatternToPattern', () => {
  it('maps a pattern to a metadata card with an empty counter', () => {
    expect(ravelryPatternToPattern(samplePattern, IMPORTED_AT)).toEqual({
      name: 'Sample Camisole',
      category: 'tops',
      craft: 'knit',
      weight: '',
      needleSize: '2–3mm',
      video: '',
      sourceName: '',
      sourceText: '',
      accentColor: '',
      photo: 'https://example.test/camisole_medium.jpg',
      gauge: { stitches: 30, rows: 38, width: 4, height: 4, unit: 'inch' },
      swatchGauge: null,
      favorited: false,
      // five languages → no single written language claimed
      notes: 'By Sample Designer\n\nSizes: XS-4XL\n\nYardage: 656 - 1312 yards\n\nYarn: Fingering (14 wpi)\n\nA sample camisole description.',
      level: 'easy',
      sizes: [],
      materials: [],
      tools: [],
      techniques: [],
      sections: [],
      ravelrySource: {
        id: '2222222',
        kind: 'pattern',
        url: 'https://www.ravelry.com/patterns/library/sample-camisole',
        importedAt: IMPORTED_AT,
      },
    });
  });

  it('does not set language when five are offered, but does when exactly one is', () => {
    expect(ravelryPatternToPattern(samplePattern, IMPORTED_AT)).not.toHaveProperty('language');
    const single: RavelryPattern = { ...samplePattern, languages: [{ name: 'Dutch' }] };
    expect(ravelryPatternToPattern(single, IMPORTED_AT).language).toBe('Dutch');
  });

  it('prefers the more specific category word (cardigan over sweater)', () => {
    const cardi: RavelryPattern = {
      id: 1,
      pattern_type: { name: 'Pullover/Cardigan' },
      pattern_categories: [{ name: 'Cardigan', parent: { name: 'Sweater' } }],
    };
    expect(ravelryPatternToPattern(cardi, IMPORTED_AT).category).toBe('cardigans');
  });

  it('falls back to "other" for a category it does not recognise', () => {
    const odd: RavelryPattern = { id: 2, pattern_categories: [{ name: 'Fingerpuppet Bunting' }] };
    expect(ravelryPatternToPattern(odd, IMPORTED_AT).category).toBe('other');
  });

  it('formats a single needle size without a range, and no gauge when none is given', () => {
    const one: RavelryPattern = { id: 3, pattern_needle_sizes: [{ metric: 4.5 }] };
    const p = ravelryPatternToPattern(one, IMPORTED_AT);
    expect(p.needleSize).toBe('4.5mm');
    expect(p.gauge).toBeNull();
    expect(p.level).toBe('intermediate'); // no difficulty data
  });
});
