import { SEED_PATTERNS } from '@/data/seed';
import { summarizePattern } from '@/lib/pattern-summary';
import type { Pattern } from '@/types/knitwit';

const base: Pattern = {
  ...SEED_PATTERNS.p1,
  category: 'sweaters',
  craft: 'knit',
  level: 'intermediate',
  needleSize: '4.5mm',
  weight: '',
  sizes: ['One size'],
  materials: [],
  sections: [],
  ravelrySource: undefined,
};

describe('summarizePattern', () => {
  it('says what kind of pattern it is', () => {
    expect(summarizePattern(base, 0).kind).toBe('Sweater & jumper · Knitting · Intermediate · 4.5mm');
  });

  it('falls back to the legacy yarn weight when there is no needle size', () => {
    expect(summarizePattern({ ...base, needleSize: '', weight: 'DK' }, 0).kind).toMatch(/· DK$/);
  });

  it('has nothing to add for a pattern that is still just a name', () => {
    expect(summarizePattern(base, 0)).toMatchObject({ contents: '', colors: [] });
  });

  it('lists sizes as a run, and leaves out "One size"', () => {
    const s = summarizePattern({ ...base, sizes: ['XS', 'S', 'M', 'L', 'XL'] }, 0);
    expect(s.contents).toBe('XS–XL (5 sizes)');
  });

  it('counts sections, yarns, projects, and says where it came from', () => {
    const s = summarizePattern(
      {
        ...base,
        sections: SEED_PATTERNS.p1.sections,
        materials: [
          { id: 'a', label: 'Main', short: 'A' },
          { id: 'b', label: 'Contrast', short: 'B' },
        ],
        ravelrySource: { id: '1', kind: 'pattern', url: 'https://ravelry.com', importedAt: '' },
      },
      2,
    );
    const n = SEED_PATTERNS.p1.sections.length;
    expect(s.contents).toContain(`${n} section`);
    expect(s.contents).toContain('2 yarns');
    expect(s.contents).toContain('from Ravelry');
    expect(s.contents).toContain('2 projects');
  });

  it('says a section is charted only once it has rows drawn', () => {
    const blank = { ...SEED_PATTERNS.p1.sections[0], rows: [] };
    expect(summarizePattern({ ...base, sections: [blank] }, 0).contents).toBe('1 section');
    const charted = SEED_PATTERNS.p1.sections.find((s) => s.rows.length > 0)!;
    expect(summarizePattern({ ...base, sections: [charted] }, 0).contents).toBe(
      '1 section, charted',
    );
  });

  // Two pixel patterns are both called "Pixel pattern"; their palettes are what tell them apart.
  it('hands back a colourwork pattern’s colours, and counts them as colours', () => {
    const s = summarizePattern(
      {
        ...base,
        materials: [
          { id: 'a', label: 'Colour A', short: 'A', color: '#aa0000' },
          { id: 'b', label: 'Colour B', short: 'B', color: '#00aa00' },
        ],
      },
      0,
    );
    expect(s.colors).toEqual(['#aa0000', '#00aa00']);
    expect(s.contents).toBe('2 colours');
  });
});
