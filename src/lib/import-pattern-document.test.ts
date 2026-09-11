import { toImportedPattern } from '@/lib/import-pattern-document';

// Stubbed to keep AsyncStorage out of this suite — importing it under Jest reaches for a native
// module that isn't there. Nothing here calls the network.
jest.mock('@/lib/supabase', () => ({ getSupabase: jest.fn() }));

const wrap = (draft: Record<string, unknown>) => ({ model: 'glm-5.3-flash', draft });

const full = {
  name: 'Meadow Cardigan',
  category: 'sweaters',
  level: 'easy',
  needleSize: '4.5mm',
  gaugeStitches: '22 sts per 10cm',
  gaugeRows: '30',
  sizes: ['s', 'M', '6 months'],
  materials: [{ label: 'Yarn A — DK wool', short: 'aa' }, { label: 'Yarn B', short: '' }],
  tools: [{ type: 'circular', thickness: '4.5mm', note: 'US 7' }],
  techniques: [{ name: 'German short rows', note: '' }, { name: '', note: 'dropped' }],
  sections: [
    { name: 'Back', castOn: [30, 30, 40], totalRows: [60, 60, 60], description: 'Row 1: knit\nRow 2: purl' },
  ],
  notes: 'Gauge was given in inches.',
};

describe('toImportedPattern', () => {
  it('maps the metadata a pattern states', () => {
    const { pattern } = toImportedPattern(wrap(full));
    expect(pattern.name).toBe('Meadow Cardigan');
    expect(pattern.category).toBe('sweaters');
    expect(pattern.level).toBe('easy');
    expect(pattern.needleSize).toBe('4.5mm');
  });

  it('pulls the number out of a gauge written as prose', () => {
    const { pattern } = toImportedPattern(wrap(full));
    expect(pattern.gaugeStitches).toBe('22');
    expect(pattern.gaugeRows).toBe('30');
  });

  it("canonicalises sizes it recognises and keeps the pattern's own wording otherwise", () => {
    const { pattern } = toImportedPattern(wrap(full));
    expect(pattern.sizes).toEqual(['S', 'M', '6 months']);
  });

  it('gives every yarn slot a single-letter chart tag, inventing one when missing', () => {
    const { pattern } = toImportedPattern(wrap(full));
    expect(pattern.materials.map((m) => m.short)).toEqual(['A', 'B']);
  });

  it('drops a technique with no name', () => {
    const { pattern } = toImportedPattern(wrap(full));
    expect(pattern.techniques.map((t) => t.name)).toEqual(['German short rows']);
  });

  it('charts each section by running its text through the deterministic parser', () => {
    const { pattern, summary } = toImportedPattern(wrap(full));
    expect(pattern.sections[0].rows).toHaveLength(2);
    expect(pattern.sections[0].rows[0].stitches[0].type).toBe('knit');
    expect(summary).toEqual({ sections: 1, rowsCharted: 2, rowsUnparsed: 0 });
  });

  it('keeps a per-size cast-on as a run but collapses one that never varies', () => {
    const { pattern } = toImportedPattern(wrap(full));
    expect(pattern.sections[0].castOn).toEqual([30, 30, 40]);
    expect(pattern.sections[0].totalRows).toBe(60);
  });

  it('counts rows the parser refused, which is what the AI step exists for', () => {
    const { summary } = toImportedPattern(
      wrap({
        ...full,
        sections: [{ name: 'Back', castOn: [], totalRows: [], description: 'Row 1: *k2tog; rep from *' }],
      }),
    );
    expect(summary).toEqual({ sections: 1, rowsCharted: 0, rowsUnparsed: 1 });
  });

  it('falls back rather than breaking on a category or level it has no label for', () => {
    const { pattern } = toImportedPattern(wrap({ ...full, category: 'spacesuit', level: 'wizard' }));
    expect(pattern.category).toBe('sweaters');
    expect(pattern.level).toBe('intermediate');
  });

  it('survives a draft with nothing in it', () => {
    const { pattern, summary } = toImportedPattern(wrap({}));
    expect(pattern.name).toBe('');
    expect(pattern.sizes).toEqual([]);
    expect(pattern.sections).toEqual([]);
    expect(summary.sections).toBe(0);
  });

  it('drops a section with neither text nor rows instead of creating an empty one', () => {
    const { pattern } = toImportedPattern(
      wrap({ ...full, sections: [{ name: 'Ghost', castOn: [], totalRows: [], description: '  ' }] }),
    );
    expect(pattern.sections).toEqual([]);
  });

  it('surfaces an error body as an error', () => {
    expect(() => toImportedPattern({ error: 'too long' })).toThrow('too long');
  });

  it('rejects a response with no draft', () => {
    expect(() => toImportedPattern({ model: 'x' })).toThrow();
  });
});
