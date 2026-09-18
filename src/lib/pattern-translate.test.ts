import { EN } from '@/lib/pattern-html';
import { applyTranslation, translatableStrings } from '@/lib/pattern-translate';
import type { Pattern } from '@/types/knitwit';

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
  sizes: ['S', 'M', 'L'],
  materials: [],
  tools: [],
  techniques: [],
  sections: [],
  ...over,
});

const section = () => ({
  id: 's1',
  updatedAt: '2026-01-01T00:00:00.000Z',
  name: 'Sleeve',
  totalRows: 40,
  castOn: [96, 104, 112],
  materials: [],
  tools: [],
  techniques: [],
  description: 'Work in the round.',
  rows: [
    {
      id: 'r1',
      label: 'Row 1',
      side: 'RS' as const,
      marker: false,
      instruction: 'k2, p2 to end',
      stitches: [],
    },
  ],
  rowNotes: [],
  notes: '',
  markers: [],
  stitchMultiple: null,
});

describe('what gets sent', () => {
  it('sends the words and not the numbers', () => {
    const ids = translatableStrings(pattern({ sections: [section()] })).map((t) => t.id);
    expect(ids).toContain('s0.description');
    expect(ids).toContain('s0.r0.instruction');
    // Sizes, cast-on counts and needle sizes are load-bearing and are not language. A model asked
    // to pass a number through is a model given the chance to round it.
    const texts = translatableStrings(pattern({ sections: [section()] })).map((t) => t.text);
    expect(texts).not.toContain('4.5mm');
    expect(texts.join('|')).not.toContain('96');
  });

  it('sends the document’s own wording too, so it is not an English form in Dutch', () => {
    const ids = translatableStrings(pattern()).map((t) => t.id);
    expect(ids).toContain('label.materials');
    expect(ids).toContain('label.row');
  });

  it('does not send empty fields', () => {
    const texts = translatableStrings(pattern({ notes: '   ' })).map((t) => t.text);
    expect(texts).not.toContain('   ');
  });
});

describe('putting it back together', () => {
  it('replaces what came back', () => {
    const p = pattern({ sections: [section()] });
    const { pattern: out, strings } = applyTranslation(p, EN, [
      { id: 'name', text: 'Wintertrui' },
      { id: 's0.name', text: 'Mouw' },
      { id: 's0.r0.instruction', text: '2 r, 2 av tot het einde' },
      { id: 'label.materials', text: 'Garen' },
    ]);

    expect(out.name).toBe('Wintertrui');
    expect(out.sections[0].name).toBe('Mouw');
    expect(out.sections[0].rows[0].instruction).toBe('2 r, 2 av tot het einde');
    expect(strings.materials).toBe('Garen');
  });

  // The failure this design exists to contain: a model returning less than it was given. Half a
  // translation is a pattern with some English left in it, never a pattern with holes.
  it('keeps the original words for anything that did not come back', () => {
    const p = pattern({ sections: [section()] });
    const { pattern: out } = applyTranslation(p, EN, [{ id: 'name', text: 'Wintertrui' }]);

    expect(out.sections[0].description).toBe('Work in the round.');
    expect(out.sections[0].rows[0].instruction).toBe('k2, p2 to end');
  });

  it('ignores an id it was never given', () => {
    const p = pattern();
    const { pattern: out } = applyTranslation(p, EN, [
      { id: 's9.r9.instruction', text: 'nonsense' },
      { id: 'name', text: 'Wintertrui' },
    ]);
    expect(out.name).toBe('Wintertrui');
    expect(out.sections).toEqual([]);
  });

  it('ignores an empty translation rather than blanking the line', () => {
    const p = pattern({ sections: [section()] });
    const { pattern: out } = applyTranslation(p, EN, [{ id: 's0.description', text: '  ' }]);
    expect(out.sections[0].description).toBe('Work in the round.');
  });

  // Numbers are untouched because they were never sent, and this is the test that would catch a
  // future change that started sending them.
  it('leaves the counts exactly as they were', () => {
    const p = pattern({ sections: [section()] });
    const { pattern: out } = applyTranslation(p, EN, [{ id: 'name', text: 'Wintertrui' }]);
    expect(out.sections[0].castOn).toEqual([96, 104, 112]);
    expect(out.needleSize).toBe('4.5mm');
    expect(out.sizes).toEqual(['S', 'M', 'L']);
  });
});
