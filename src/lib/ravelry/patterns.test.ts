import type { CatalogueTechnique } from '@/types/knitwit';

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
  url: 'https://example.test/shop/sample-camisole',
  // Verbatim from the real response: eleven attributes, of which nine are not techniques at all.
  pattern_attributes: [
    { id: 2, permalink: 'female' },
    { id: 3, permalink: 'unisex' },
    { id: 10, permalink: 'adult' },
    { id: 12, permalink: 'negative-ease' },
    { id: 18, permalink: 'fitted' },
    { id: 97, permalink: 'crew-neck' },
    { id: 121, permalink: 'sleeveless' },
    { id: 211, permalink: 'top-down' },
    { id: 267, permalink: 'written-pattern' },
    { id: 286, permalink: 'in-the-round' },
    { id: 295, permalink: 'other-edging' },
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
      link: 'https://example.test/shop/sample-camisole',
      video: '',
      sourceName: '',
      sourceText: '',
      accentColor: '',
      photo: 'https://example.test/camisole_medium.jpg',
      gauge: { stitches: 30, rows: 38, width: 4, height: 4, unit: 'inch' },
      swatchGauge: null,
      favorited: false,
      // five languages → no single written language claimed. Every attribute the catalogue did not
      // claim is described here rather than dropped: it is a fair description of the garment.
      notes:
        'By Sample Designer\n\nSizes: XS-4XL\n\nYardage: 656 - 1312 yards\n\n' +
        'Yarn: Fingering (14 wpi)\n\n' +
        'Details: female, unisex, adult, negative ease, fitted, crew neck, sleeveless, top down, ' +
        'written pattern, in the round, other edging\n\n' +
        'A sample camisole description.',
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

  describe('pattern attributes', () => {
    // Shaped like the real catalogue entries, including the alias that makes `lace` work.
    const entry = (
      id: string,
      name: string,
      craft: 'knit' | 'crochet' | 'both',
      aliases: string[] = [],
    ) =>
      ({
        id,
        name,
        craft,
        family: 'texture',
        abbr: '',
        summary: '',
        aliases,
        video: '',
        link: '',
      }) as CatalogueTechnique;

    const catalogue = [
      entry('cables', 'Cables', 'knit', ['cabling']),
      entry('lace-knitting', 'Lace knitting', 'knit', ['lace']),
      entry('stranded-colourwork', 'Stranded colourwork', 'knit', ['fair isle']),
      entry('mosaic-knitting', 'Mosaic knitting', 'knit'),
      entry('mosaic-crochet', 'Mosaic crochet', 'crochet'),
      entry('filet-crochet', 'Filet crochet', 'crochet'),
      entry('blocking', 'Blocking', 'both'),
    ];

    const tagged = (permalinks: string[], over: Partial<RavelryPattern> = {}): RavelryPattern => ({
      ...samplePattern,
      pattern_attributes: permalinks.map((permalink, id) => ({ id, permalink })),
      ...over,
    });

    const namesFor = (permalinks: string[], over: Partial<RavelryPattern> = {}) =>
      ravelryPatternToPattern(tagged(permalinks, over), IMPORTED_AT, catalogue).techniques.map(
        (t) => t.name,
      );

    it('keeps the attributes that name a technique and ignores the rest', () => {
      // `cables` matches by name, `lace` by its alias, `blocking` across both crafts.
      expect(namesFor(['cables', 'lace', 'blocking'])).toEqual([
        'Cables',
        'Lace knitting',
        'Blocking',
      ]);

      // Who it is for, how it fits, what shape it is — none of these is a skill, and the catalogue
      // deliberately has no garment construction, so `top-down` finds nothing either.
      expect(
        namesFor(['female', 'adult', 'negative-ease', 'crew-neck', 'top-down', 'written-pattern']),
      ).toEqual([]);
    });

    it('reaches the entry when Ravelry’s word is not the catalogue’s', () => {
      // 'stranded' is not an alias of Stranded colourwork, and a contained match would not find it.
      expect(namesFor(['stranded'])).toEqual(['Stranded colourwork']);
    });

    it('never matches a technique from the wrong craft', () => {
      // A crochet pattern tagged `lace` must not land on Lace knitting.
      expect(namesFor(['lace'], { craft: { name: 'Crochet' } })).toEqual([]);
      // And `mosaic`, which is ambiguous on its own, resolves by craft.
      expect(namesFor(['mosaic'])).toEqual(['Mosaic knitting']);
      expect(namesFor(['mosaic'], { craft: { name: 'Crochet' } })).toEqual(['Mosaic crochet']);
    });

    it('does not list the same technique twice', () => {
      expect(namesFor(['cables', 'cabling'])).toEqual(['Cables']);
    });

    it('describes in the notes only what it could not match', () => {
      const p = ravelryPatternToPattern(tagged(['cables', 'adult', 'crew-neck']), IMPORTED_AT, catalogue);
      expect(p.techniques.map((t) => t.name)).toEqual(['Cables']);
      // Cables is a technique now, so repeating it in the prose would be noise.
      expect(p.notes).toContain('Details: adult, crew neck');
      expect(p.notes).not.toContain('Details: cables');
    });

    it('matches nothing when the catalogue has not loaded, and still says what Ravelry said', () => {
      // The catalogue is fetched and cached separately; an import must not wait on it or fail.
      const p = ravelryPatternToPattern(tagged(['cables', 'adult']), IMPORTED_AT);
      expect(p.techniques).toEqual([]);
      expect(p.notes).toContain('Details: cables, adult');
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
