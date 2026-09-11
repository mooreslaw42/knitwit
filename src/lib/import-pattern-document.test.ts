import { MaxNameLength } from '@/constants/theme';
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
  gauge: { stitches: 22, rows: 30, width: 10, height: 10, unit: 'cm' },
  sizes: ['s', 'M', '6 months'],
  materials: [{ label: 'Yarn A — DK wool', short: 'aa' }, { label: 'Yarn B', short: '' }],
  tools: [{ type: 'circular', thickness: '4.5mm', note: 'US 7' }],
  techniques: [{ name: 'German short rows', note: '' }, { name: '', note: 'dropped' }],
  sections: [
    {
      name: 'Back',
      castOn: [30, 30, 40],
      totalRows: [60, 60, 60],
      description: 'Row 1: knit\nRow 2: purl',
      usesMaterials: [0],
      usesTools: [0],
      usesTechniques: [0],
    },
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

  it('keeps the window a gauge was measured over', () => {
    const { pattern } = toImportedPattern(wrap(full));
    expect(pattern.gauge).toEqual({ stitches: 22, rows: 30, width: 10, height: 10, unit: 'cm' });
  });

  // Before gauge had a unit this was coerced to a bare number, so every US pattern was recorded as
  // if it were metric — a 1.6% error in every stitch count the rescale would later produce.
  it('keeps an imperial gauge imperial instead of silently calling it metric', () => {
    const { pattern } = toImportedPattern(
      wrap({ ...full, gauge: { stitches: 22, rows: 30, width: 4, height: 4, unit: 'inch' } }),
    );
    expect(pattern.gauge).toMatchObject({ width: 4, unit: 'inch' });
  });

  it('defaults the window to the convention of whichever unit was stated', () => {
    expect(
      toImportedPattern(wrap({ ...full, gauge: { stitches: 22, rows: 30, unit: 'inch' } })).pattern
        .gauge,
    ).toMatchObject({ width: 4, height: 4 });
    expect(
      toImportedPattern(wrap({ ...full, gauge: { stitches: 22, rows: 30, unit: 'cm' } })).pattern
        .gauge,
    ).toMatchObject({ width: 10, height: 10 });
  });

  it('treats an all-zero gauge as not stated rather than as a gauge of zero', () => {
    const { pattern } = toImportedPattern(
      wrap({ ...full, gauge: { stitches: 0, rows: 0, width: 10, height: 10, unit: 'cm' } }),
    );
    expect(pattern.gauge).toBeNull();
  });

  it("canonicalises sizes it recognises and keeps the pattern's own wording otherwise", () => {
    const { pattern } = toImportedPattern(wrap(full));
    expect(pattern.sizes).toEqual(['S', 'M', '6 months']);
  });

  it('gives every yarn slot a single-letter chart tag, inventing one when missing', () => {
    const { pattern } = toImportedPattern(wrap(full));
    expect(pattern.materials.map((m) => m.short)).toEqual(['A', 'B']);
  });

  // A real import produced this: the model packed weight, fibre and per-size yardage into the
  // slot name, and the chip it lands on ran off the edge of the card.
  it('caps an over-long yarn name rather than letting it overflow', () => {
    const long =
      'Yarn A — fingering weight merino, cotton-merino or silk, 50 g / 250 m: 150 (150) 150 (200) 200 (250) 250 (250)';
    const { pattern } = toImportedPattern(
      wrap({ ...full, materials: [{ label: long, short: 'A' }] }),
    );
    expect(pattern.materials[0].label.length).toBeLessThanOrEqual(MaxNameLength);
    expect(pattern.materials[0].label).toContain('Yarn A');
  });

  it('caps technique and section names too', () => {
    const long = 'x'.repeat(200);
    const { pattern } = toImportedPattern(
      wrap({
        ...full,
        techniques: [{ name: long, note: '' }],
        sections: [{ ...full.sections[0], name: long }],
      }),
    );
    expect(pattern.techniques[0].name.length).toBeLessThanOrEqual(MaxNameLength);
    expect(pattern.sections[0].name.length).toBeLessThanOrEqual(MaxNameLength);
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

  // The model refers to slots by position; the app refers to them by id. Without this a section
  // imports with nothing selected, which is what a real import turned out to do.
  it('links each section to the yarn, tool and technique slots it uses', () => {
    const { pattern } = toImportedPattern(wrap(full));
    const section = pattern.sections[0];
    expect(section.materials).toEqual([pattern.materials[0].id]);
    expect(section.tools).toEqual([pattern.tools[0].id]);
    expect(section.techniques).toEqual([pattern.techniques[0].id]);
  });

  it('drops a slot index that points past the end rather than dangling', () => {
    const { pattern } = toImportedPattern(
      wrap({ ...full, sections: [{ ...full.sections[0], usesMaterials: [0, 9] }] }),
    );
    expect(pattern.sections[0].materials).toEqual([pattern.materials[0].id]);
  });

  it('warns when a per-size run does not have one number per size', () => {
    // Three sizes, two cast-on numbers: every number is now against the wrong size.
    const { warnings } = toImportedPattern(
      wrap({ ...full, sections: [{ ...full.sections[0], castOn: [30, 40] }] }),
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('2 cast-on numbers for 3 sizes');
  });

  it('does not warn when the runs line up', () => {
    expect(toImportedPattern(wrap(full)).warnings).toEqual([]);
  });

  it('does not warn about a one-size pattern, where runs are meaningless', () => {
    const { warnings } = toImportedPattern(wrap({ ...full, sizes: ['One size'] }));
    expect(warnings).toEqual([]);
  });

  it('surfaces an error body as an error', () => {
    expect(() => toImportedPattern({ error: 'too long' })).toThrow('too long');
  });

  it('rejects a response with no draft', () => {
    expect(() => toImportedPattern({ model: 'x' })).toThrow();
  });
});
