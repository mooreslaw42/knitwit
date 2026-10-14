import type { ImportedPattern } from '@/lib/import-pattern-document';
import type { Pattern, PatternSection } from '@/types/knitwit';

import { ravelryPatternToPattern } from './patterns';
import { mergePatternChart } from './merge-pattern-chart';

const IMPORTED_AT = '2026-10-14T00:00:00.000Z';

// A real metadata card: has name, category, photo and ravelrySource, but empty sections.
const card: Pattern = ravelryPatternToPattern(
  {
    id: 2222222,
    permalink: 'sample-camisole',
    name: 'Sample Camisole',
    craft: { name: 'Knitting' },
    gauge: 30,
    row_gauge: 38,
    gauge_divisor: 4,
    pattern_needle_sizes: [{ metric: 3 }],
    pattern_categories: [{ name: 'Sleeveless Top', parent: { name: 'Tops' } }],
  },
  IMPORTED_AT,
);

const parsed: ImportedPattern['pattern'] = {
  name: 'Whatever the PDF called itself',
  category: 'other',
  craft: 'knit',
  weight: '',
  needleSize: '2.5mm',
  video: '',
  gauge: { stitches: 20, rows: 28, width: 10, height: 10, unit: 'cm' },
  swatchGauge: null,
  notes: 'parsed notes',
  level: 'advanced',
  sizes: ['S', 'M', 'L'],
  materials: [{ id: 'pm1', label: 'MC', short: 'A' }],
  tools: [{ id: 'pt1', type: 'circular', thickness: '3mm', note: '' }],
  techniques: [{ id: 'tq1', name: 'ssk', note: '' }],
  sections: [{ id: 'sec1', name: 'Body' } as PatternSection],
};

describe('mergePatternChart', () => {
  it('keeps the card metadata and takes the parsed structure', () => {
    const merged = mergePatternChart(card, parsed);

    // Identity and metadata stay the card's.
    expect(merged.name).toBe('Sample Camisole');
    expect(merged.category).toBe('tops');
    expect(merged.ravelrySource?.id).toBe('2222222');
    expect(merged.gauge).toEqual(card.gauge); // card had a gauge, so it wins
    expect(merged.needleSize).toBe(card.needleSize);

    // Structure comes from the parse.
    expect(merged.sections).toBe(parsed.sections);
    expect(merged.materials).toBe(parsed.materials);
    expect(merged.tools).toBe(parsed.tools);
    expect(merged.techniques).toBe(parsed.techniques);
    // The card had no sizes, so the parse fills them.
    expect(merged.sizes).toEqual(['S', 'M', 'L']);
  });

  it('keeps the card sizes and fills gauge from the parse when the card lacked one', () => {
    const noGauge: Pattern = { ...card, gauge: null, needleSize: '', sizes: ['One size'] };
    const merged = mergePatternChart(noGauge, parsed);
    expect(merged.sizes).toEqual(['One size']); // card's sizes kept
    expect(merged.gauge).toEqual(parsed.gauge); // filled from the parse
    expect(merged.needleSize).toBe('2.5mm'); // filled from the parse
  });
});
