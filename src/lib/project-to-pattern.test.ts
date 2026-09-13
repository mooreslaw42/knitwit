import {
  categoryFromName,
  describeConversion,
  projectToPattern,
  type Stash,
} from '@/lib/project-to-pattern';
import type {
  Gauge,
  Material,
  Pattern,
  PatternRow,
  Project,
  ProjectSection,
  Tool,
} from '@/types/knitwit';

const gauge = (stitches: number): Gauge => ({
  stitches,
  rows: 30,
  width: 10,
  height: 10,
  unit: 'cm',
});

const row = (label: string): PatternRow => ({
  id: `r-${label}`,
  label,
  side: 'RS',
  marker: false,
  instruction: '',
  stitches: [{ id: 'g1', type: 'knit', span: 'all', count: null, materialSlot: null, note: '' }],
});

const material = (brand: string, colorName: string): Material =>
  ({ brand, colorName, thickness: '4.5mm' }) as Material;

const tool = (thickness: string): Tool => ({ type: 'circular', thickness, length: '80cm', quantity: 1 });

const section = (over: Partial<ProjectSection> = {}): ProjectSection => ({
  name: 'Back',
  totalRows: 40,
  row: 12,
  complete: false,
  seconds: 900,
  notes: [],
  materialIds: [],
  toolIds: [],
  techniqueIds: [],
  description: '',
  stitchMultiple: null,
  markers: [],
  castOn: 88,
  rows: [],
  ...over,
});

const project = (over: Partial<Project> = {}): Project => ({
  name: 'Meadow Cardigan',
  startedOn: '2026-06-14',
  craft: 'knit',
  category: 'sweaters',
  level: 'intermediate',
  needleSize: '',
  video: '',
  sourceName: '',
  sourceText: '',
  photo: null,
  color: '#E8B4C0',
  colorDeep: '#A78189',
  patternId: null,
  sizeIndex: 0,
  status: 'active',
  gauge: null,
  sections: [section()],
  ...over,
});

const stash: Stash = {
  materials: { m1: material('Rico Design', 'Blossom Pink'), m2: material('Drops', 'Sage Green') },
  tools: { t1: tool('4.5mm'), t2: tool('3.0mm') },
  techniques: {
    q1: { name: 'German short rows', craft: 'knit', notes: 'Turn without a wrap.', link: '' },
    q2: { name: 'Tubular cast-on', craft: 'knit', notes: '', link: '' },
  },
};

const bare: Stash = { materials: {}, tools: {}, techniques: {} };

describe('projectToPattern', () => {
  it('carries the project across as a pattern of its own', () => {
    const p = projectToPattern(
      project({ photo: 'data:image/png;base64,x' }),
      bare,
      null,
    );
    expect(p).toMatchObject({
      name: 'Meadow Cardigan',
      craft: 'knit',
      photo: 'data:image/png;base64,x',
      favorited: false,
    });
    expect(p.sections[0]).toMatchObject({ name: 'Back', totalRows: 40, castOn: 88 });
  });

  // The project's colour has to survive the round trip: the store re-derives a project's colours
  // from the pattern it links to, and it links to this one the moment it's created.
  it('takes its accent from the project, so re-deriving is a no-op', () => {
    const proj = project();
    expect(projectToPattern(proj, bare, null).accentColor).toBe(proj.color);
  });

  it('is a one-size pattern, because a project is knitted in one size', () => {
    expect(projectToPattern(project(), bare, null).sizes).toEqual(['One size']);
  });

  it('names that size the way the source pattern named it', () => {
    const source = { sizes: ['S', 'M', 'L'], sections: [] } as unknown as Pattern;
    expect(projectToPattern(project({ sizeIndex: 1 }), bare, source).sizes).toEqual(['M']);
  });

  // Progress is the project's, not the pattern's. A pattern that remembered you were on row 12
  // would put the next knitter there too.
  it('keeps no progress — only the shape that can be knitted again', () => {
    const p = projectToPattern(project({ sections: [section({ row: 12, seconds: 900 })] }), bare, null);
    expect(p.sections[0]).not.toHaveProperty('row');
    expect(p.sections[0]).not.toHaveProperty('seconds');
    expect(p.sections[0]).not.toHaveProperty('complete');
  });

  it('copies the chart, which is the pattern', () => {
    const rows = [row('1'), row('2')];
    const p = projectToPattern(project({ sections: [section({ rows })] }), bare, null);
    expect(p.sections[0].rows).toEqual(rows);
  });
});

describe('stash slots', () => {
  it('turns each yarn the project used into one slot, labelled from the stash', () => {
    const p = projectToPattern(
      project({
        sections: [section({ materialIds: ['m1'] }), section({ name: 'Front', materialIds: ['m2'] })],
      }),
      stash,
      null,
    );
    expect(p.materials.map((m) => m.label)).toEqual([
      'Rico Design — Blossom Pink',
      'Drops — Sage Green',
    ]);
    expect(p.materials.map((m) => m.short)).toEqual(['A', 'B']);
  });

  it('gives two sections on the same yarn one slot, not two', () => {
    const p = projectToPattern(
      project({
        sections: [section({ materialIds: ['m1'] }), section({ name: 'Front', materialIds: ['m1'] })],
      }),
      stash,
      null,
    );
    expect(p.materials).toHaveLength(1);
    expect(p.sections[0].materials).toEqual(p.sections[1].materials);
  });

  it('points each section at its own slot id', () => {
    const p = projectToPattern(
      project({
        sections: [section({ materialIds: ['m2'], toolIds: ['t1'] }), section({ name: 'Front' })],
      }),
      stash,
      null,
    );
    expect(p.sections[0].materials).toEqual([p.materials[0].id]);
    expect(p.sections[0].tools).toEqual([p.tools[0].id]);
    // A section that called for nothing gets nothing, rather than inheriting the first slot.
    expect(p.sections[1].materials).toEqual([]);
    expect(p.sections[1].tools).toEqual([]);
  });

  it('numbers a yarn that is no longer in the stash rather than dropping the slot', () => {
    const p = projectToPattern(project({ sections: [section({ materialIds: ['gone'] })] }), bare, null);
    expect(p.materials[0].label).toBe('Yarn A');
    expect(p.sections[0].materials).toEqual([p.materials[0].id]);
  });

  it('reads the needle size off the first tool the project used', () => {
    const p = projectToPattern(project({ sections: [section({ toolIds: ['t2'] })] }), stash, null);
    expect(p.needleSize).toBe('3.0mm Circular');
  });
});

describe('gauge', () => {
  it('states the gauge the fabric was knitted at', () => {
    const p = projectToPattern(
      project({ gauge: { pattern: gauge(22), mine: gauge(20) } }),
      bare,
      null,
    );
    expect(p.gauge).toEqual(gauge(20));
    // Recording it again as a swatch would make re-gauging compare the number against itself.
    expect(p.swatchGauge).toBeNull();
  });

  it('falls back to the pattern gauge for a project worked at it', () => {
    const source = { gauge: gauge(22), sizes: [], sections: [] } as unknown as Pattern;
    expect(projectToPattern(project({ gauge: null }), bare, source).gauge).toEqual(gauge(22));
  });

  it('leaves gauge empty when nothing ever measured one', () => {
    expect(projectToPattern(project(), bare, null).gauge).toBeNull();
  });
});

describe('carrying a source pattern across', () => {
  const source = {
    name: 'Meadow',
    category: 'sweaters',
    level: 'advanced',
    needleSize: '4.0mm',
    video: 'https://example.test/v',
    gauge: null,
    sizes: ['S'],
    techniques: [{ id: 'tq1', name: 'German short rows', note: '' }],
    sections: [
      {
        name: 'Back',
        description: 'Row 1 (RS): K to end.',
        techniques: ['tq1'],
        stitchMultiple: { of: 4, plus: 2 },
      },
    ],
  } as unknown as Pattern;

  // The wording is the one thing a project genuinely doesn't hold — it keeps the chart, not the
  // prose — so losing it on the way back would make the new pattern unreadable.
  it('brings back the wording the project never kept', () => {
    const p = projectToPattern(project(), bare, source);
    expect(p.sections[0].description).toBe('Row 1 (RS): K to end.');
    expect(p.sections[0].stitchMultiple).toEqual({ of: 4, plus: 2 });
  });

  it('keeps technique ids resolvable by copying the techniques with them', () => {
    const p = projectToPattern(project(), bare, source);
    expect(p.sections[0].techniques).toEqual(['tq1']);
    expect(p.techniques.map((t) => t.id)).toContain('tq1');
  });

  // Matched by name, since a project's sections get added, renamed and deleted after it's cast on
  // and the index stops meaning anything.
  it('matches sections by name, not position', () => {
    const p = projectToPattern(
      project({ sections: [section({ name: 'Sleeve' }), section({ name: 'Back' })] }),
      bare,
      source,
    );
    expect(p.sections[0].description).toBe('');
    expect(p.sections[1].description).toBe('Row 1 (RS): K to end.');
  });

  it('does not carry the source pattern slot ids, which mean nothing here', () => {
    const p = projectToPattern(project({ sections: [section({ materialIds: ['m1'] })] }), stash, source);
    expect(p.sections[0].materials).toEqual([p.materials[0].id]);
  });

  // These used to come from the source pattern, because a project had nowhere to keep them. It
  // does now, so its own answers win even when it was made from a pattern that disagrees.
  it('prefers the project\u2019s own details over the source pattern\u2019s', () => {
    const p = projectToPattern(
      project({ category: 'blankets', level: 'beginner', needleSize: '6mm' }),
      bare,
      source,
    );
    expect(p).toMatchObject({ category: 'blankets', level: 'beginner', needleSize: '6mm' });
  });

  it('keeps the project name, not the source pattern name', () => {
    expect(projectToPattern(project(), bare, source).name).toBe('Meadow Cardigan');
  });
});

describe('describeConversion', () => {
  it('counts what is actually coming across', () => {
    const p = projectToPattern(
      project({
        sections: [
          section({ rows: [row('1'), row('2')], materialIds: ['m1'], toolIds: ['t1'] }),
          section({ name: 'Front', rows: [row('1')] }),
        ],
      }),
      stash,
      null,
    );
    expect(describeConversion(p)).toBe('2 sections · 3 rows charted · 1 yarn · 1 tool');
  });

  it('counts the sections that have been written up', () => {
    const p = projectToPattern(
      project({
        sections: [section({ description: 'Row 1: K.' }), section({ name: 'Front' })],
      }),
      bare,
      null,
    );
    expect(describeConversion(p)).toBe('2 sections · 0 rows charted · 1 written up');
  });

  it('says so plainly when there is nothing charted', () => {
    const p = projectToPattern(project(), bare, null);
    expect(describeConversion(p)).toBe('1 section · 0 rows charted');
  });
});

describe('categoryFromName', () => {
  it('reads the category off the name when the name says it', () => {
    expect(categoryFromName('Rowan Socks')).toBe('socks');
    expect(categoryFromName('Autumn Cowl')).toBe('scarves');
    expect(categoryFromName('Meadow Cardigan')).toBe('sweaters');
  });

  // "Clover Baby Blanket" is a blanket that happens to be for a baby. The object noun wins.
  it('prefers the thing over who it is for', () => {
    expect(categoryFromName('Clover Baby Blanket')).toBe('blankets');
    expect(categoryFromName('Baby Booties')).toBe('socks');
  });

  it('still categorises a name that only says who it is for', () => {
    expect(categoryFromName('Something for the baby')).toBe('baby');
  });

  it('falls through rather than guessing harder', () => {
    expect(categoryFromName('Marker Test')).toBe('sweaters');
    expect(categoryFromName('')).toBe('sweaters');
  });

  it('does not care about case', () => {
    expect(categoryFromName('BIG STRIPY BLANKET')).toBe('blankets');
  });
});

// The whole point of the plural: a section worked in two colours used to resolve to neither,
// because a stash item was only ever banked when the pattern named exactly one slot.
describe('a section worked with more than one of a thing', () => {
  it('gives every yarn its own slot and points the section at all of them', () => {
    const p = projectToPattern(
      project({ sections: [section({ materialIds: ['m1', 'm2'] })] }),
      stash,
      null,
    );
    expect(p.materials).toHaveLength(2);
    expect(p.sections[0].materials).toEqual(p.materials.map((m) => m.id));
    expect(p.materials.map((m) => m.short)).toEqual(['A', 'B']);
  });

  it('does the same for tools', () => {
    const p = projectToPattern(project({ sections: [section({ toolIds: ['t1', 't2'] })] }), stash, null);
    expect(p.tools.map((t) => t.thickness)).toEqual(['4.5mm', '3.0mm']);
    expect(p.sections[0].tools).toHaveLength(2);
  });

  it('shares a slot between sections that use the same yarn, and adds one for the extra', () => {
    const p = projectToPattern(
      project({
        sections: [
          section({ materialIds: ['m1'] }),
          section({ name: 'Yoke', materialIds: ['m1', 'm2'] }),
        ],
      }),
      stash,
      null,
    );
    expect(p.materials).toHaveLength(2);
    expect(p.sections[0].materials).toEqual([p.materials[0].id]);
    expect(p.sections[1].materials).toEqual([p.materials[0].id, p.materials[1].id]);
  });
});

describe('techniques', () => {
  // A project points at the knitter's technique library; a pattern names its techniques inline.
  it('copies the technique out of the library as a slot of the pattern’s own', () => {
    const p = projectToPattern(
      project({ sections: [section({ techniqueIds: ['q1'] })] }),
      stash,
      null,
    );
    expect(p.techniques).toHaveLength(1);
    expect(p.techniques[0]).toMatchObject({
      name: 'German short rows',
      note: 'Turn without a wrap.',
    });
    expect(p.sections[0].techniques).toEqual([p.techniques[0].id]);
  });

  it('does not give the same technique two slots for two sections', () => {
    const p = projectToPattern(
      project({
        sections: [section({ techniqueIds: ['q1'] }), section({ name: 'Front', techniqueIds: ['q1'] })],
      }),
      stash,
      null,
    );
    expect(p.techniques).toHaveLength(1);
  });

  it('names an unknown technique rather than dropping the reference', () => {
    const p = projectToPattern(project({ sections: [section({ techniqueIds: ['gone'] })] }), bare, null);
    expect(p.techniques[0].name).toBe('Technique');
    expect(p.sections[0].techniques).toEqual([p.techniques[0].id]);
  });

  // A section that added its own techniques to a pattern that already had some: dropping either
  // list would leave a section pointing at an id that resolves to nothing.
  it('keeps the source pattern’s techniques alongside the project’s own', () => {
    const source = {
      sizes: [],
      techniques: [{ id: 'tq1', name: 'Kitchener stitch', note: '' }],
      sections: [{ name: 'Back', description: '', techniques: ['tq1'], stitchMultiple: null }],
    } as unknown as Pattern;
    const p = projectToPattern(
      project({
        sections: [section({ name: 'Back' }), section({ name: 'Yoke', techniqueIds: ['q1'] })],
      }),
      stash,
      source,
    );
    const ids = p.techniques.map((t) => t.id);
    expect(p.sections[0].techniques.every((id) => ids.includes(id))).toBe(true);
    expect(p.sections[1].techniques.every((id) => ids.includes(id))).toBe(true);
    expect(p.techniques.map((t) => t.name)).toEqual(['Kitchener stitch', 'German short rows']);
  });
});

describe('a project that holds what a pattern holds', () => {
  it('carries the section wording the knitter wrote on the project', () => {
    const p = projectToPattern(
      project({ sections: [section({ description: 'Row 1: K all.' })] }),
      bare,
      null,
    );
    expect(p.sections[0].description).toBe('Row 1: K all.');
  });

  // The fallback still exists for a section the knitter never wrote anything on — before a project
  // could hold a description at all, it was the only way to get one.
  it('falls back to the source pattern only for a section left blank', () => {
    const source = {
      sizes: [],
      techniques: [],
      sections: [
        { name: 'Back', description: 'From the pattern.', techniques: [], stitchMultiple: null },
      ],
    } as unknown as Pattern;
    const written = projectToPattern(
      project({ sections: [section({ name: 'Back', description: 'Mine.' })] }),
      bare,
      source,
    );
    const blank = projectToPattern(project({ sections: [section({ name: 'Back' })] }), bare, source);
    expect(written.sections[0].description).toBe('Mine.');
    expect(blank.sections[0].description).toBe('From the pattern.');
  });

  it('carries the stitch repeat, so a converted pattern still re-gauges correctly', () => {
    const p = projectToPattern(
      project({ sections: [section({ stitchMultiple: { of: 4, plus: 2 } })] }),
      bare,
      null,
    );
    expect(p.sections[0].stitchMultiple).toEqual({ of: 4, plus: 2 });
  });

  it('carries the whole-pattern text and video the project was given', () => {
    const p = projectToPattern(
      project({ sourceName: 'camisole.pdf', sourceText: 'Cast on 88 sts.', video: 'https://x.test' }),
      bare,
      null,
    );
    expect(p).toMatchObject({
      sourceName: 'camisole.pdf',
      sourceText: 'Cast on 88 sts.',
      video: 'https://x.test',
    });
  });

  // The needle size is a field now, but an improvised project that never filled it in still has a
  // better answer available than blank.
  it('falls back to the needle it was actually worked with', () => {
    const p = projectToPattern(
      project({ needleSize: '', sections: [section({ toolIds: ['t2'] })] }),
      stash,
      null,
    );
    expect(p.needleSize).toBe('3.0mm Circular');
  });
});
