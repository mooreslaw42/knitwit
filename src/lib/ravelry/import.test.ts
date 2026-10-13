import type { Material, Pattern, Project, Tool } from '@/types/knitwit';

import { applyRavelryImport, type ImportTarget, type RavelryImportData } from './import';

const IMPORTED_AT = '2026-10-13T00:00:00.000Z';

// A fake store with the same save semantics as the real one: an existing key updates, null makes a
// new sequential key.
function fakeTarget() {
  const materials: Record<string, Material> = {};
  const tools: Record<string, Tool> = {};
  const patterns: Record<string, Pattern> = {};
  const projects: Record<string, Project> = {};
  let m = 0;
  let t = 0;
  let p = 0;
  let pr = 0;
  const target: ImportTarget & {
    materials: Record<string, Material>;
    tools: Record<string, Tool>;
    patterns: Record<string, Pattern>;
    projects: Record<string, Project>;
  } = {
    materials,
    tools,
    patterns,
    projects,
    getMaterials: () => materials,
    getTools: () => tools,
    getPatterns: () => patterns,
    getProjects: () => projects,
    saveMaterial: (id, data) => {
      const key = id ?? `m${(m += 1)}`;
      materials[key] = data;
      return key;
    },
    saveTool: (id, data) => {
      const key = id ?? `t${(t += 1)}`;
      tools[key] = data;
      return key;
    },
    savePattern: (id, data) => {
      const key = id ?? `p${(p += 1)}`;
      patterns[key] = data;
      return key;
    },
    saveProject: (id, data) => {
      const key = id ?? `proj${(pr += 1)}`;
      projects[key] = data;
      return key;
    },
  };
  return target;
}

const data: RavelryImportData = {
  stash: [
    {
      id: 11111111,
      permalink: 'drops-saga',
      name: 'Garnstudio DROPS Saga',
      yarn: { permalink: 'garnstudio-drops-saga', grams: 50 },
      user: { username: 'testknitter' },
    },
  ],
  needles: [
    { id: 1, needle_type_id: 69, needle_type: { metric_name: '3.25', type_name: 'dp', length: 8 } },
    { id: 2, needle_type_id: 69, needle_type: { metric_name: '3.25', type_name: 'dp', length: 8 } },
  ],
  patterns: [{ id: 2222222, permalink: 'sample-camisole', name: 'Sample Camisole', craft: { name: 'Knitting' } }],
  projects: [
    {
      id: 3333333,
      permalink: 'test-project-1',
      name: 'Test project 1',
      pattern_id: 2222222,
      craft_name: 'Knitting',
      status_name: 'Finished',
      packs: [{ stash_id: 11111111, yarn_id: 2085, skeins: 2 }],
      user: { username: 'testknitter' },
    },
  ],
};

describe('applyRavelryImport', () => {
  it('imports every entity and stitches the project to its pattern and yarn', () => {
    const target = fakeTarget();
    const summary = applyRavelryImport(data, target, IMPORTED_AT);

    expect(summary).toEqual({ materials: 1, tools: 1, patterns: 1, projects: 1 });
    expect(Object.keys(target.materials)).toHaveLength(1);
    expect(Object.keys(target.tools)).toHaveLength(1); // two dp records collapsed into one
    expect(target.tools.t1.quantity).toBe(2);
    expect(Object.keys(target.patterns)).toHaveLength(1);

    const [projectKey] = Object.keys(target.projects);
    const project = target.projects[projectKey];
    // Linked to the pattern that was imported in the same run…
    expect(project.patternId).toBe('p1');
    // …and to the stash yarn, by the Material key it resolved to.
    expect(project.materialSkeins).toEqual({ m1: 2 });
  });

  it('reconciles a second import in place instead of duplicating', () => {
    const target = fakeTarget();
    applyRavelryImport(data, target, IMPORTED_AT);
    applyRavelryImport(data, target, '2026-11-01T00:00:00.000Z');

    expect(Object.keys(target.materials)).toHaveLength(1);
    expect(Object.keys(target.tools)).toHaveLength(1);
    expect(Object.keys(target.patterns)).toHaveLength(1);
    expect(Object.keys(target.projects)).toHaveLength(1);
    // The second run's timestamp won, proving it rewrote the same row.
    expect(target.materials.m1.ravelrySource?.importedAt).toBe('2026-11-01T00:00:00.000Z');
    expect(target.projects.proj1.patternId).toBe('p1');
  });

  it('leaves a yarn unlinked when it was not tied to a stash entry', () => {
    const target = fakeTarget();
    const noStashLink: RavelryImportData = {
      ...data,
      projects: [{ ...data.projects[0], packs: [{ stash_id: null, yarn_id: 2085, skeins: 2 }] }],
    };
    applyRavelryImport(noStashLink, target, IMPORTED_AT);
    expect(target.projects.proj1.materialSkeins).toBeUndefined();
  });
});
