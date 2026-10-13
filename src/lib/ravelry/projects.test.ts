import { ravelryProjectToProject } from './projects';
import type { RavelryProject } from './types';

const IMPORTED_AT = '2026-10-13T00:00:00.000Z';

// Shaped on a real /projects/{user}/{id}.json response, ids and username anonymised. A finished
// project made from a pattern, with its own gauge, two needle sizes and one yarn.
const sampleProject: RavelryProject = {
  id: 3333333,
  permalink: 'test-project-1',
  name: 'Test project 1',
  pattern_id: 2222222,
  craft_name: 'Knitting',
  status_name: 'Finished',
  started: '2026/10/01',
  personal_source_name: null,
  notes: 'Notes for the entire project',
  tag_names: [],
  size: 'M',
  gauge: 30,
  row_gauge: 38,
  gauge_divisor: 4,
  photos: [{ medium_url: 'https://example.test/proj_medium.jpg', square_url: 'https://example.test/proj_square.jpg' }],
  needle_sizes: [{ metric: 4.0 }, { metric: 4.5 }],
  packs: [{ stash_id: null, yarn_id: 2085, skeins: 2.0 }],
  user: { username: 'testknitter' },
};

describe('ravelryProjectToProject', () => {
  it('maps a project, keeping its links as Ravelry ids to resolve later', () => {
    expect(ravelryProjectToProject(sampleProject, IMPORTED_AT)).toEqual({
      project: {
        name: 'Test project 1',
        startedOn: '2026-10-01',
        craft: 'knit',
        photo: 'https://example.test/proj_medium.jpg',
        color: '#F7EBDD',
        colorDeep: '#8A7873',
        category: 'other',
        level: 'intermediate',
        needleSize: '4–4.5mm',
        video: '',
        sourceName: '',
        sourceText: '',
        notes: 'Notes for the entire project',
        labels: [],
        patternId: null,
        sizeIndex: 0,
        status: 'finished',
        gauge: {
          pattern: { stitches: 30, rows: 38, width: 4, height: 4, unit: 'inch' },
          mine: { stitches: 30, rows: 38, width: 4, height: 4, unit: 'inch' },
        },
        sections: [],
        ravelrySource: {
          id: '3333333',
          kind: 'project',
          url: 'https://www.ravelry.com/projects/testknitter/test-project-1',
          importedAt: IMPORTED_AT,
        },
      },
      ravelryPatternId: 2222222,
      yarns: [{ stashId: null, yarnId: 2085, skeins: 2 }],
    });
  });

  it('maps Ravelry statuses onto the three Knitwit ones', () => {
    const status = (name: string) =>
      ravelryProjectToProject({ ...sampleProject, status_name: name }, IMPORTED_AT).project.status;
    expect(status('Finished')).toBe('finished');
    expect(status('Frogged')).toBe('frogged');
    expect(status('In progress')).toBe('active');
    expect(status('Hibernating')).toBe('active');
  });

  it('leaves startedOn null when there is no start date', () => {
    const p = ravelryProjectToProject({ ...sampleProject, started: null }, IMPORTED_AT);
    expect(p.project.startedOn).toBeNull();
  });

  it('carries no pattern link and no yarns when the project has neither', () => {
    const bare = ravelryProjectToProject(
      { ...sampleProject, pattern_id: null, packs: [] },
      IMPORTED_AT,
    );
    expect(bare.ravelryPatternId).toBeNull();
    expect(bare.yarns).toEqual([]);
    expect(bare.project.patternId).toBeNull();
  });
});
