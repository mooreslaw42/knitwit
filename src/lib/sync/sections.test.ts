import { projectSectionsEntity, resetOrphans } from '@/lib/sync/sections';
import { useKnitwitStore } from '@/store/useKnitwitStore';
import type { Project, ProjectSection } from '@/types/knitwit';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const section = (id: string, over: Partial<ProjectSection> = {}): ProjectSection =>
  ({
    id,
    updatedAt: '2026-01-01T00:00:00.000Z',
    name: id,
    totalRows: 10,
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
    ...over,
  }) as ProjectSection;

const project = (sections: ProjectSection[]) => ({ name: 'P', sections }) as unknown as Project;

function setProjects(projects: Record<string, Project>) {
  useKnitwitStore.setState({ projects });
}

// Sections are nested here and flat on the server, and this is the seam between those two truths.
describe('flattening sections for the server', () => {
  beforeEach(() => resetOrphans());

  it('gives each section its parent and its place', () => {
    setProjects({ p1: project([section('s1'), section('s2')]) });

    const flat = projectSectionsEntity.local();

    expect(flat.s1).toMatchObject({ parentId: 'p1', position: 0 });
    expect(flat.s2).toMatchObject({ parentId: 'p1', position: 1 });
  });

  // A foreign key cannot point inside JSONB, and neither can an index worth having.
  it('sends the parent and the order as real columns, not payload', () => {
    setProjects({ p1: project([section('s1')]) });
    const entry = projectSectionsEntity.local().s1;

    expect(projectSectionsEntity.columns?.(entry)).toEqual({ project_id: 'p1', position: 0 });
    expect(projectSectionsEntity.toRow(entry)).not.toHaveProperty('project_id');
    expect(projectSectionsEntity.toRow(entry)).toMatchObject({ id: 's1', name: 's1' });
  });

  // project_id is NOT NULL, and a section being deleted is already gone from the store — so the
  // parent has to be remembered from before.
  it('still knows the parent of a section that has been deleted', () => {
    setProjects({ p1: project([section('s1')]) });
    projectSectionsEntity.local();
    setProjects({ p1: project([]) });

    expect(projectSectionsEntity.tombstoneColumns?.('s1')).toEqual({
      project_id: 'p1',
      position: 0,
    });
  });
});

describe('reassembling sections that arrived', () => {
  beforeEach(() => resetOrphans());

  it('puts them back on their project, in order', () => {
    setProjects({ p1: project([]) });

    projectSectionsEntity.replace({
      s2: { parentId: 'p1', position: 1, section: section('s2') },
      s1: { parentId: 'p1', position: 0, section: section('s1') },
    });

    expect(useKnitwitStore.getState().projects.p1.sections.map((s) => s.id)).toEqual(['s1', 's2']);
  });

  // Dropping it would be silent and permanent: the watermark moves on regardless, so the section
  // would never be offered again.
  it('holds a section whose project has not arrived yet, and places it when it does', () => {
    setProjects({});
    projectSectionsEntity.replace({
      orphan: { parentId: 'later', position: 0, section: section('orphan') },
    });
    expect(useKnitwitStore.getState().projects.later).toBeUndefined();

    // The project turns up on a subsequent pull.
    setProjects({ later: project([]) });
    projectSectionsEntity.replace(projectSectionsEntity.local());

    expect(useKnitwitStore.getState().projects.later.sections.map((s) => s.id)).toEqual(['orphan']);
  });
});

describe('merging a section that changed in both places', () => {
  const flat = (s: ProjectSection) => ({ parentId: 'p1', position: 0, section: s });

  // Time spent counts; everything else on a section describes.
  it('keeps the larger time spent', () => {
    const merged = projectSectionsEntity.merge?.(
      flat(section('s1', { seconds: 900, name: 'mine' })),
      flat(section('s1', { seconds: 300, name: 'theirs' })),
    );
    expect(merged?.section.seconds).toBe(900);
    expect(merged?.section.name).toBe('theirs');
  });

  // Taking the maximum here would mean a knitter who frogged back to row 10 on their phone had
  // row 40 restored from a stale laptop — the opposite of what they asked for.
  it('lets the row count go down, because frogging is deliberate', () => {
    const merged = projectSectionsEntity.merge?.(
      flat(section('s1', { row: 40 })),
      flat(section('s1', { row: 10 })),
    );
    expect(merged?.section.row).toBe(10);
  });
});
