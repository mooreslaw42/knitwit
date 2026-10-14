import type { Project, ProjectSection } from '@/types/knitwit';

import { knitwitProjectToRavelry } from './export-project';

function section(overrides: Partial<ProjectSection> = {}): ProjectSection {
  return {
    id: 'psec_1',
    updatedAt: '2026-10-14T00:00:00.000Z',
    name: 'Body',
    totalRows: 100,
    row: 0,
    complete: false,
    seconds: 0,
    rowNotes: [],
    notes: '',
    materialIds: [],
    toolIds: [],
    techniqueIds: [],
    description: '',
    stitchMultiple: null,
    markers: [],
    castOn: 0,
    rows: [],
    ...overrides,
  };
}

const sampleProject: Project = {
  name: 'Winter cardigan',
  startedOn: '2026-10-01',
  craft: 'knit',
  photo: null,
  color: '#c8a2c8',
  colorDeep: '#8f6f8f',
  category: 'cardigans',
  level: 'intermediate',
  needleSize: '4mm',
  video: '',
  sourceName: 'Pattern booklet, page 12',
  sourceText: '',
  notes: 'Lengthened the body by 10 rows.',
  labels: ['for Mum', 'stash-bust'],
  patternId: null,
  sizeIndex: 1,
  status: 'active',
  gauge: {
    pattern: { stitches: 22, rows: 30, width: 10, height: 10, unit: 'cm' },
    mine: { stitches: 24, rows: 32, width: 10, height: 10, unit: 'cm' },
  },
  sections: [section({ row: 25 })],
};

describe('knitwitProjectToRavelry', () => {
  it('sends the facts of a project, in the shapes Ravelry uses', () => {
    expect(knitwitProjectToRavelry(sampleProject)).toEqual({
      name: 'Winter cardigan',
      craft_name: 'Knitting',
      status_name: 'In progress',
      // Ravelry writes dates with slashes, which is how it hands them back on a read.
      started: '2026/10/01',
      progress: 25,
      notes: 'Lengthened the body by 10 rows.',
      personal_source_name: 'Pattern booklet, page 12',
      // The knitter's measured gauge, not the pattern's — Ravelry's project gauge means theirs.
      gauge: 24,
      row_gauge: 32,
      gauge_divisor: 10,
    });
  });

  it('never publishes the knitter’s private labels as Ravelry tags', () => {
    const draft = knitwitProjectToRavelry(sampleProject) as Record<string, unknown>;
    // Labels are made-up private groupings; Ravelry's tags are public. Not ours to convert.
    expect(draft.tag_names).toBeUndefined();
    expect(JSON.stringify(draft)).not.toContain('for Mum');
  });

  it('counts progress from the rows, and calls a finished project finished', () => {
    const progress = (p: Partial<Project>) =>
      knitwitProjectToRavelry({ ...sampleProject, ...p }).progress;

    expect(progress({ sections: [section({ row: 0 })] })).toBe(0);
    expect(progress({ sections: [section({ row: 50 }), section({ id: 'b', row: 0 })] })).toBe(25);
    // Finished outranks an un-tapped last row — the knitter said so.
    expect(progress({ status: 'finished', sections: [section({ row: 3 })] })).toBe(100);
    // A frogged project keeps how far it got.
    expect(progress({ status: 'frogged', sections: [section({ row: 60 })] })).toBe(60);
    // A project with nothing to count is 0, not NaN.
    expect(progress({ sections: [] })).toBe(0);
  });

  it('maps the three statuses and both crafts', () => {
    const of = (p: Partial<Project>) => knitwitProjectToRavelry({ ...sampleProject, ...p });
    expect(of({ status: 'active' }).status_name).toBe('In progress');
    expect(of({ status: 'finished' }).status_name).toBe('Finished');
    expect(of({ status: 'frogged' }).status_name).toBe('Frogged');
    expect(of({ craft: 'crochet' }).craft_name).toBe('Crochet');
  });

  it('leaves out what the knitter never filled in rather than sending blanks', () => {
    const bare = knitwitProjectToRavelry({
      ...sampleProject,
      startedOn: null,
      notes: '   ',
      sourceName: '',
      gauge: null,
    });
    expect(bare).toEqual({
      name: 'Winter cardigan',
      craft_name: 'Knitting',
      status_name: 'In progress',
      progress: 25,
    });
  });

  it('links the pattern only when Ravelry has one, and carries the size across', () => {
    const linked = knitwitProjectToRavelry(sampleProject, {
      ravelryPatternId: 1344864,
      sizeName: 'M',
    });
    expect(linked.pattern_id).toBe(1344864);
    expect(linked.size).toBe('M');

    // A pattern the knitter wrote themselves has no counterpart there; inventing a link to a
    // stranger's pattern would be worse than leaving it blank.
    const unlinked = knitwitProjectToRavelry(sampleProject, { ravelryPatternId: null });
    expect(unlinked.pattern_id).toBeUndefined();
    expect(unlinked.size).toBeUndefined();
  });
});
