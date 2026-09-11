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

  it('inherits the pattern sections, reset to zero progress with re-issued note ids', () => {
    const { patterns, noteSeq } = useKnitwitStore.getState();
    const key = useKnitwitStore
      .getState()
      .createProject({ name: 'Cardi', started: '', patternId: 'p1', totalRows: 10 });
    const project = useKnitwitStore.getState().projects[key];

    // p1 defines two sections; the manual totalRows is ignored in favour of them.
    expect(project.sections.map((s) => s.name)).toEqual(
      patterns.p1.sections.map((s) => s.name),
    );
    project.sections.forEach((s) => {
      expect(s).toMatchObject({ row: 0, complete: false, seconds: 0 });
    });
    // Stitch markers come across from the template.
    expect(project.sections[0].markers).toEqual(patterns.p1.sections[0].markers);

    // The single inherited note is re-keyed from the store's own sequence, not the template id.
    const inheritedNote = project.sections[1].notes[0];
    expect(inheritedNote.text).toBe(patterns.p1.sections[1].notes[0].text);
    expect(inheritedNote.id).toBe(noteSeq);
    expect(useKnitwitStore.getState().noteSeq).toBe(noteSeq + 1);
  });

  it('resolves single-slot sections to the mapped stash item, and stores the slot maps', () => {
    // p1's sections each use exactly the p1m1 yarn slot and p1t1 tool slot.
    const key = useKnitwitStore.getState().createProject({
      name: 'Cardi',
      started: '',
      patternId: 'p1',
      totalRows: 10,
      slotMaterials: { p1m1: 'm3', p1m2: 'm1' },
      slotTools: { p1t1: 't3' },
    });
    const project = useKnitwitStore.getState().projects[key];
    // Body/Sleeve both call for p1m1 (→ m3) and p1t1 (→ t3).
    expect(project.sections[0].materialId).toBe('m3');
    expect(project.sections[0].toolId).toBe('t3');
    // The full mapping is kept on the project for later reference.
    expect(project.slotMaterials).toEqual({ p1m1: 'm3', p1m2: 'm1' });
    expect(project.slotTools).toEqual({ p1t1: 't3' });
  });

  it('leaves an unmapped slot section without a concrete stash item', () => {
    const key = useKnitwitStore
      .getState()
      .createProject({ name: 'Cardi', started: '', patternId: 'p1', totalRows: 10 });
    const project = useKnitwitStore.getState().projects[key];
    expect(project.sections[0].materialId).toBeNull();
    expect(project.sections[0].toolId).toBeNull();
  });

  it('carries stitch markers flagged on charted rows into the project the counter reads', () => {
    // Flag row 3 of p1's Body section in the stitch editor, alongside its existing markers.
    const patterns = useKnitwitStore.getState().patterns;
    const body = patterns.p1.sections[0];
    useKnitwitStore.setState({
      patterns: {
        ...patterns,
        p1: {
          ...patterns.p1,
          sections: [
            {
              ...body,
              rows: [
                { id: 'r1', label: '', side: 'RS', marker: false, instruction: '', stitches: [] },
                { id: 'r2', label: '', side: 'WS', marker: false, instruction: '', stitches: [] },
                { id: 'r3', label: '', side: 'RS', marker: true, instruction: '', stitches: [] },
              ],
            },
            ...patterns.p1.sections.slice(1),
          ],
        },
      },
    });

    const key = useKnitwitStore
      .getState()
      .createProject({ name: 'Cardi', started: '', patternId: 'p1', totalRows: 10 });
    // The counter prompts off section.markers, so the flagged row must land there (row 3),
    // merged with the section's own markers (20, 40).
    expect(useKnitwitStore.getState().projects[key].sections[0].markers).toEqual([3, 20, 40]);
  });

  it('snapshots the pattern chart onto the project, so later pattern edits leave it alone', () => {
    const patterns = useKnitwitStore.getState().patterns;
    const body = patterns.p1.sections[0];
    const row = {
      id: 'r1',
      label: 'Row 1',
      side: 'RS' as const,
      marker: false,
      instruction: 'Knit all.',
      stitches: [
        { id: 'g1', type: 'knit', span: 'all' as const, count: null, materialSlot: null, note: '' },
      ],
    };
    useKnitwitStore.setState({
      patterns: {
        ...patterns,
        p1: {
          ...patterns.p1,
          sections: [
            { ...body, castOn: 20, rows: [row] },
            ...patterns.p1.sections.slice(1),
          ],
        },
      },
    });

    const key = useKnitwitStore
      .getState()
      .createProject({ name: 'Cardi', started: '', patternId: 'p1', totalRows: 10 });
    expect(useKnitwitStore.getState().projects[key].sections[0]).toMatchObject({
      castOn: 20,
      rows: [expect.objectContaining({ instruction: 'Knit all.' })],
    });

    // Now rewrite the pattern's chart; the in-progress project must not change.
    const after = useKnitwitStore.getState().patterns;
    useKnitwitStore.setState({
      patterns: {
        ...after,
        p1: {
          ...after.p1,
          sections: [{ ...after.p1.sections[0], castOn: 99, rows: [] }, ...after.p1.sections.slice(1)],
        },
      },
    });
    const projectSection = useKnitwitStore.getState().projects[key].sections[0];
    expect(projectSection.castOn).toBe(20);
    expect(projectSection.rows).toHaveLength(1);
  });

  it('falls back to a single section for a pattern that defines none', () => {
    const key = useKnitwitStore
      .getState()
      .createProject({ name: 'Mitts', started: '', patternId: 'p3', totalRows: 24 });
    const project = useKnitwitStore.getState().projects[key];
    expect(project.sections).toHaveLength(1);
    expect(project.sections[0]).toMatchObject({ name: 'Main', totalRows: 24 });
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

describe('updateProject', () => {
  it('moves the colour with the pattern when relinking', () => {
    const patterns = useKnitwitStore.getState().patterns;
    useKnitwitStore
      .getState()
      .updateProject('clover', { name: 'Clover', started: 'x', patternId: 'p2' });
    expect(useKnitwitStore.getState().projects.clover.color).toBe(patterns.p2.accentColor);

    useKnitwitStore
      .getState()
      .updateProject('clover', { name: 'Clover', started: 'x', patternId: null });
    expect(useKnitwitStore.getState().projects.clover.color).toBe('#F7EBDD');
  });

  it('keeps sections and their progress untouched', () => {
    const before = useKnitwitStore.getState().projects.clover.sections;
    useKnitwitStore
      .getState()
      .updateProject('clover', { name: 'Renamed', started: 'x', patternId: null });
    expect(useKnitwitStore.getState().projects.clover.sections).toEqual(before);
  });
});

describe('deleteProject', () => {
  it('moves the active project on so the counter has something to read', () => {
    useKnitwitStore.getState().setActiveSection('clover', 0);
    useKnitwitStore.getState().deleteProject('clover');
    expect(useKnitwitStore.getState().projects.clover).toBeUndefined();
    const { activeProjectKey, projects } = useKnitwitStore.getState();
    expect(Object.keys(projects)).toContain(activeProjectKey);
  });

  it('stops a timer belonging to the deleted project', () => {
    useKnitwitStore.getState().setActiveSection('clover', 0);
    useKnitwitStore.getState().toggleTimer();
    expect(useKnitwitStore.getState().timerKey).toBe('clover|0');
    useKnitwitStore.getState().deleteProject('clover');
    expect(useKnitwitStore.getState().timerKey).toBeNull();
  });

  it('survives deleting every project', () => {
    Object.keys(useKnitwitStore.getState().projects).forEach((k) =>
      useKnitwitStore.getState().deleteProject(k),
    );
    expect(useKnitwitStore.getState().projects).toEqual({});
    expect(useKnitwitStore.getState().activeProjectKey).toBe('');
  });
});

describe('sections', () => {
  it('adds a section at row zero', () => {
    useKnitwitStore.getState().addSection('clover', { name: 'Border', totalRows: 12 });
    const sections = useKnitwitStore.getState().projects.clover.sections;
    expect(sections.at(-1)).toMatchObject({ name: 'Border', totalRows: 12, row: 0 });
  });

  it('names an unnamed section rather than leaving it blank', () => {
    useKnitwitStore.getState().addSection('clover', { name: '  ', totalRows: 5 });
    expect(useKnitwitStore.getState().projects.clover.sections.at(-1)!.name).toBe('Section 2');
  });

  it('pulls progress back when a section is shortened below the current row', () => {
    // clover's only section sits at row 31 of 60.
    useKnitwitStore.getState().updateSection('clover', 0, { name: 'Cable panel', totalRows: 20 });
    const s = useKnitwitStore.getState().projects.clover.sections[0];
    expect(s.totalRows).toBe(20);
    expect(s.row).toBe(20); // never "row 31 of 20"
  });

  it('refuses to delete the last section, since a project must have something to count', () => {
    expect(useKnitwitStore.getState().projects.clover.sections).toHaveLength(1);
    useKnitwitStore.getState().deleteSection('clover', 0);
    expect(useKnitwitStore.getState().projects.clover.sections).toHaveLength(1);
  });

  it('keeps the active section pointing at the same work when an earlier one is removed', () => {
    // meadow has two sections; sit on the second, then delete the first.
    useKnitwitStore.getState().setActiveSection('meadow', 1);
    const target = useKnitwitStore.getState().projects.meadow.sections[1];
    useKnitwitStore.getState().deleteSection('meadow', 0);
    const { activeSectionIndex, projects } = useKnitwitStore.getState();
    expect(projects.meadow.sections[activeSectionIndex].name).toBe(target.name);
  });
});
