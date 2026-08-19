import { useKnitwitStore } from '@/store/useKnitwitStore';

// The store persists through AsyncStorage, which has no implementation under the jest-expo
// preset — without this mock the whole suite fails to load. jest.mock factories are hoisted
// above imports, so require() is the only way to reference the mock here.
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const pristine = useKnitwitStore.getState();

function activeSection() {
  const { projects, activeProjectKey, activeSectionIndex } = useKnitwitStore.getState();
  return projects[activeProjectKey].sections[activeSectionIndex];
}

beforeEach(() => {
  useKnitwitStore.setState(pristine, true);
  // 'clover' has a single 60-row section sitting at row 31 — a simple mid-progress case.
  useKnitwitStore.getState().setActiveSection('clover', 0);
});

describe('changeRow', () => {
  it('counts a row up and down', () => {
    const start = activeSection().row;
    useKnitwitStore.getState().changeRow(1);
    expect(activeSection().row).toBe(start + 1);
    useKnitwitStore.getState().changeRow(-1);
    expect(activeSection().row).toBe(start);
  });

  it('applies the -5 / -10 shortcuts', () => {
    const start = activeSection().row;
    useKnitwitStore.getState().changeRow(-10);
    expect(activeSection().row).toBe(start - 10);
  });

  it('never goes below zero', () => {
    useKnitwitStore.getState().changeRow(-9999);
    expect(activeSection().row).toBe(0);
  });

  it('never counts past the final row', () => {
    const { totalRows } = activeSection();
    useKnitwitStore.getState().changeRow(9999);
    expect(activeSection().row).toBe(totalRows);
  });

  it('does not disturb other projects', () => {
    const before = useKnitwitStore.getState().projects.meadow;
    useKnitwitStore.getState().changeRow(1);
    expect(useKnitwitStore.getState().projects.meadow).toEqual(before);
  });
});

describe('the timer', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts automatically when a row is counted, since that means work is happening', () => {
    expect(useKnitwitStore.getState().timerKey).toBeNull();
    useKnitwitStore.getState().changeRow(1);
    expect(useKnitwitStore.getState().timerKey).toBe('clover|0');
  });

  it('does not restart an already-running timer, which would lose the current run', () => {
    useKnitwitStore.getState().changeRow(1);
    const startedAt = useKnitwitStore.getState().timerStartedAt;
    useKnitwitStore.getState().changeRow(1);
    expect(useKnitwitStore.getState().timerStartedAt).toBe(startedAt);
  });

  it('banks elapsed time into the section when stopped', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-19T12:00:00Z'));
    const before = activeSection().seconds;

    useKnitwitStore.getState().toggleTimer();
    jest.setSystemTime(new Date('2026-08-19T12:02:30Z')); // 150s later
    useKnitwitStore.getState().stopTimer();

    expect(activeSection().seconds).toBe(before + 150);
    expect(useKnitwitStore.getState().timerKey).toBeNull();
  });

  it('toggling off then on again does not double-count the first run', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-19T12:00:00Z'));
    const before = activeSection().seconds;

    useKnitwitStore.getState().toggleTimer();
    jest.setSystemTime(new Date('2026-08-19T12:01:00Z'));
    useKnitwitStore.getState().toggleTimer(); // stop, banks 60s
    jest.setSystemTime(new Date('2026-08-19T12:05:00Z')); // 4 idle minutes
    useKnitwitStore.getState().toggleTimer(); // start again
    jest.setSystemTime(new Date('2026-08-19T12:05:30Z'));
    useKnitwitStore.getState().stopTimer(); // banks 30s

    // The four idle minutes must not be counted as knitting time.
    expect(activeSection().seconds).toBe(before + 90);
  });
});

describe('materials and tools', () => {
  it('assigns a fresh id when creating, and reuses it when editing', () => {
    const { saveMaterial } = useKnitwitStore.getState();
    const id = saveMaterial(null, { ...useKnitwitStore.getState().materials.m1, brand: 'New' });
    expect(useKnitwitStore.getState().materials[id].brand).toBe('New');

    const sameId = saveMaterial(id, {
      ...useKnitwitStore.getState().materials[id],
      brand: 'Edited',
    });
    expect(sameId).toBe(id);
    expect(useKnitwitStore.getState().materials[id].brand).toBe('Edited');
  });

  it('clears the reference from any section using a deleted material', () => {
    // The seeded Meadow Cardigan uses m1 in both of its sections.
    useKnitwitStore.getState().deleteMaterial('m1');
    expect(useKnitwitStore.getState().materials.m1).toBeUndefined();
    const stillReferenced = Object.values(useKnitwitStore.getState().projects).some((p) =>
      p.sections.some((s) => s.materialId === 'm1'),
    );
    expect(stillReferenced).toBe(false);
  });

  it('clears the reference from any section using a deleted tool', () => {
    useKnitwitStore.getState().deleteTool('t1');
    const stillReferenced = Object.values(useKnitwitStore.getState().projects).some((p) =>
      p.sections.some((s) => s.toolId === 't1'),
    );
    expect(stillReferenced).toBe(false);
  });
});

describe('notes', () => {
  it('records a note against a row and closes the form', () => {
    useKnitwitStore.getState().openNoteForm();
    useKnitwitStore.getState().saveNote(12, 'Dropped a stitch here');
    const note = activeSection().notes.at(-1);
    expect(note).toMatchObject({ row: 12, text: 'Dropped a stitch here' });
    expect(useKnitwitStore.getState().noteFormOpen).toBe(false);
  });

  it('ignores an empty note rather than saving a blank one', () => {
    const before = activeSection().notes.length;
    useKnitwitStore.getState().saveNote(5, '   ');
    expect(activeSection().notes.length).toBe(before);
  });
});

describe('createProject', () => {
  it('adds a countable project and leaves it at row zero', () => {
    const key = useKnitwitStore.getState().createProject({
      name: 'Summer Tee',
      started: 'Started Aug 19',
      patternId: null,
      totalRows: 40,
    });
    const p = useKnitwitStore.getState().projects[key];
    expect(p.name).toBe('Summer Tee');
    expect(p.sections).toHaveLength(1);
    expect(p.sections[0]).toMatchObject({ totalRows: 40, row: 0, complete: false });
  });

  it('takes its colour from the linked pattern, and stays neutral without one', () => {
    const withPattern = useKnitwitStore.getState().createProject({
      name: 'A',
      started: '',
      patternId: 'p1',
      totalRows: 10,
    });
    const improvised = useKnitwitStore.getState().createProject({
      name: 'B',
      started: '',
      patternId: null,
      totalRows: 10,
    });
    const projects = useKnitwitStore.getState().projects;
    expect(projects[withPattern].color).toBe(useKnitwitStore.getState().patterns.p1.accentColor);
    expect(projects[improvised].color).toBe('#F7EBDD');
  });

  it('falls back to placeholder text rather than saving an empty name', () => {
    const key = useKnitwitStore
      .getState()
      .createProject({ name: '   ', started: '  ', patternId: null, totalRows: 0 });
    const p = useKnitwitStore.getState().projects[key];
    expect(p.name).toBe('Untitled project');
    expect(p.started).toBe('Just cast on');
    // A zero-row section would be uncountable, so it must be coerced to a usable default.
    expect(p.sections[0].totalRows).toBe(60);
  });

  it('gives each project a distinct key', () => {
    const a = useKnitwitStore
      .getState()
      .createProject({ name: 'A', started: '', patternId: null, totalRows: 10 });
    const b = useKnitwitStore
      .getState()
      .createProject({ name: 'B', started: '', patternId: null, totalRows: 10 });
    expect(a).not.toBe(b);
    expect(Object.keys(useKnitwitStore.getState().projects)).toContain(b);
  });
});
