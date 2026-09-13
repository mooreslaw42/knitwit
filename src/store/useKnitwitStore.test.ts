import { projectToPattern } from '@/lib/project-to-pattern';
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
      startedOn: null, craft: 'knit',
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
      startedOn: null, craft: 'knit',
      patternId: 'p1',
      totalRows: 10,
    });
    const improvised = useKnitwitStore.getState().createProject({
      name: 'B',
      startedOn: null, craft: 'knit',
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
      .createProject({ name: '   ', startedOn: null, craft: 'knit', patternId: null, totalRows: 0 });
    const p = useKnitwitStore.getState().projects[key];
    expect(p.name).toBe('Untitled project');
    // No date given is a real answer — "I don't remember when I cast this on".
    expect(p.startedOn).toBeNull();
    // A zero-row section would be uncountable, so it must be coerced to a usable default.
    expect(p.sections[0].totalRows).toBe(60);
  });

  it('inherits the pattern sections, reset to zero progress with re-issued note ids', () => {
    const { patterns, noteSeq } = useKnitwitStore.getState();
    const key = useKnitwitStore
      .getState()
      .createProject({ name: 'Cardi', startedOn: null, craft: 'knit', patternId: 'p1', totalRows: 10 });
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
      startedOn: null, craft: 'knit',
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
      .createProject({ name: 'Cardi', startedOn: null, craft: 'knit', patternId: 'p1', totalRows: 10 });
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
      .createProject({ name: 'Cardi', startedOn: null, craft: 'knit', patternId: 'p1', totalRows: 10 });
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
      .createProject({ name: 'Cardi', startedOn: null, craft: 'knit', patternId: 'p1', totalRows: 10 });
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

  it('resolves every per-size number to the size the project is being knitted in', () => {
    const patterns = useKnitwitStore.getState().patterns;
    const body = patterns.p1.sections[0];
    useKnitwitStore.setState({
      patterns: {
        ...patterns,
        p1: {
          ...patterns.p1,
          sizes: ['S', 'M', 'L'],
          sections: [
            {
              ...body,
              castOn: [20, 30, 40],
              totalRows: [50, 60, 70],
              rows: [
                {
                  id: 'r1',
                  label: 'Row 1',
                  side: 'RS',
                  marker: false,
                  instruction: '',
                  stitches: [
                    {
                      id: 'g1',
                      type: 'knit',
                      span: 'exact',
                      count: [2, 4, 6],
                      materialSlot: null,
                      note: '',
                    },
                  ],
                },
              ],
            },
            ...patterns.p1.sections.slice(1),
          ],
        },
      },
    });

    const key = useKnitwitStore.getState().createProject({
      name: 'Medium',
      startedOn: null, craft: 'knit',
      patternId: 'p1',
      totalRows: 10,
      sizeIndex: 1, // "M"
    });
    const project = useKnitwitStore.getState().projects[key];
    expect(project.sizeIndex).toBe(1);
    // From here on the project holds plain numbers — no size runs leak into a project.
    expect(project.sections[0].castOn).toBe(30);
    expect(project.sections[0].totalRows).toBe(60);
    expect(project.sections[0].rows[0].stitches[0].count).toBe(4);
  });

  // G5: the knitter's gauge is resolved once, at creation, exactly like sizeIndex — so nothing in
  // the counter has to know about gauge, and a pattern edited later can't re-scale a project
  // already on the needles.
  it('resolves the knitter’s gauge into the project it creates', () => {
    const { patterns } = useKnitwitStore.getState();
    useKnitwitStore.setState({
      patterns: {
        ...patterns,
        p1: {
          ...patterns.p1,
          gauge: { stitches: 20, rows: 28, width: 10, height: 10, unit: 'cm' },
          sections: [
            { ...patterns.p1.sections[0], castOn: 40, rows: [], stitchMultiple: null },
            ...patterns.p1.sections.slice(1),
          ],
        },
      },
    });

    const key = useKnitwitStore.getState().createProject({
      name: 'Looser',
      startedOn: null, craft: 'knit',
      patternId: 'p1',
      totalRows: 10,
      // Half the pattern's stitch gauge, so every count halves.
      swatchGauge: { stitches: 10, rows: 28, width: 10, height: 10, unit: 'cm' },
    });
    const project = useKnitwitStore.getState().projects[key];
    expect(project.sections[0].castOn).toBe(20);
    // Both gauges are snapshotted, so editing the pattern later can't move this project.
    expect(project.gauge).toEqual({
      pattern: { stitches: 20, rows: 28, width: 10, height: 10, unit: 'cm' },
      mine: { stitches: 10, rows: 28, width: 10, height: 10, unit: 'cm' },
    });
  });

  it('leaves a project at the pattern’s own numbers when no swatch is given', () => {
    const { patterns } = useKnitwitStore.getState();
    useKnitwitStore.setState({
      patterns: {
        ...patterns,
        p1: {
          ...patterns.p1,
          gauge: { stitches: 20, rows: 28, width: 10, height: 10, unit: 'cm' },
          sections: [
            { ...patterns.p1.sections[0], castOn: 40, rows: [], stitchMultiple: null },
            ...patterns.p1.sections.slice(1),
          ],
        },
      },
    });
    const key = useKnitwitStore
      .getState()
      .createProject({ name: 'As written', startedOn: null, craft: 'knit', patternId: 'p1', totalRows: 10 });
    const project = useKnitwitStore.getState().projects[key];
    expect(project.sections[0].castOn).toBe(40);
    expect(project.gauge).toBeNull();
  });

  it('falls back to a single section for a pattern that defines none', () => {
    const key = useKnitwitStore
      .getState()
      .createProject({ name: 'Mitts', startedOn: null, craft: 'knit', patternId: 'p3', totalRows: 24 });
    const project = useKnitwitStore.getState().projects[key];
    expect(project.sections).toHaveLength(1);
    expect(project.sections[0]).toMatchObject({ name: 'Main', totalRows: 24 });
  });

  it('gives each project a distinct key', () => {
    const a = useKnitwitStore
      .getState()
      .createProject({ name: 'A', startedOn: null, craft: 'knit', patternId: null, totalRows: 10 });
    const b = useKnitwitStore
      .getState()
      .createProject({ name: 'B', startedOn: null, craft: 'knit', patternId: null, totalRows: 10 });
    expect(a).not.toBe(b);
    expect(Object.keys(useKnitwitStore.getState().projects)).toContain(b);
  });
});

describe('updateProject', () => {
  it('moves the colour with the pattern when relinking', () => {
    const patterns = useKnitwitStore.getState().patterns;
    useKnitwitStore
      .getState()
      .updateProject('clover', { name: 'Clover', startedOn: null, craft: 'knit', patternId: 'p2' });
    expect(useKnitwitStore.getState().projects.clover.color).toBe(patterns.p2.accentColor);

    useKnitwitStore
      .getState()
      .updateProject('clover', { name: 'Clover', startedOn: null, craft: 'knit', patternId: null });
    expect(useKnitwitStore.getState().projects.clover.color).toBe('#F7EBDD');
  });

  it('keeps sections and their progress untouched', () => {
    const before = useKnitwitStore.getState().projects.clover.sections;
    useKnitwitStore
      .getState()
      .updateProject('clover', { name: 'Renamed', startedOn: null, craft: 'knit', patternId: null });
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

// Home's "Continue" has to land somewhere you can knit. It used to follow activeProjectKey with
// no check at all, so frogging the project you were last on left the button pointing at it.
describe('recent sections', () => {
  it('remembers a section when it is selected', () => {
    useKnitwitStore.getState().setActiveSection('rowan', 0);
    useKnitwitStore.getState().setActiveSection('meadow', 1);
    expect(useKnitwitStore.getState().recentSections.slice(0, 2)).toEqual(['meadow|1', 'rowan|0']);
  });

  it('moves a section back to the front rather than repeating it', () => {
    useKnitwitStore.getState().setActiveSection('rowan', 0);
    useKnitwitStore.getState().setActiveSection('meadow', 1);
    useKnitwitStore.getState().setActiveSection('rowan', 0);
    const recent = useKnitwitStore.getState().recentSections;
    expect(recent[0]).toBe('rowan|0');
    expect(recent.filter((r) => r === 'rowan|0')).toHaveLength(1);
  });

  it('keeps the trail fresh when a row is counted, not only when a section is picked', () => {
    useKnitwitStore.getState().setActiveSection('meadow', 1);
    useKnitwitStore.getState().setActiveSection('rowan', 0);
    useKnitwitStore.setState({ activeProjectKey: 'meadow', activeSectionIndex: 1 });
    useKnitwitStore.getState().changeRow(1);
    expect(useKnitwitStore.getState().recentSections[0]).toBe('meadow|1');
  });

  it('stays bounded', () => {
    for (let i = 0; i < 30; i++) useKnitwitStore.getState().setActiveSection('meadow', i % 3);
    expect(useKnitwitStore.getState().recentSections.length).toBeLessThanOrEqual(12);
  });
});

// The cast-off flow: reaching the last row prompts you to bind off, and "not yet" has to leave a
// counter you can still use rather than one that stops dead.
describe('finishing a section', () => {
  const setup = () => {
    useKnitwitStore.getState().setActiveSection('rowan', 0);
    const s = useKnitwitStore.getState().projects.rowan.sections[0];
    useKnitwitStore.setState({
      projects: {
        ...useKnitwitStore.getState().projects,
        rowan: {
          ...useKnitwitStore.getState().projects.rowan,
          sections: [{ ...s, row: s.totalRows - 1, complete: false }, ...useKnitwitStore.getState().projects.rowan.sections.slice(1)],
        },
      },
      castOffDismissed: false,
    });
    return useKnitwitStore.getState().projects.rowan.sections[0].totalRows;
  };
  const section = () => useKnitwitStore.getState().projects.rowan.sections[0];

  it('stops at the last row while the bind-off prompt is still standing', () => {
    const total = setup();
    useKnitwitStore.getState().changeRow(1);
    useKnitwitStore.getState().changeRow(1);
    expect(section().row).toBe(total);
    expect(section().totalRows).toBe(total);
  });

  // "Not yet" means the knitter isn't done — the counter has to keep going, not sit at the cap.
  it('keeps counting past the planned total once bind-off is declined', () => {
    const total = setup();
    useKnitwitStore.getState().changeRow(1);
    useKnitwitStore.getState().dismissCastOff();
    useKnitwitStore.getState().changeRow(1);
    expect(section().row).toBe(total + 1);
    expect(section().totalRows).toBe(total + 1);
  });

  it('un-finishes a section ripped back below its last row', () => {
    setup();
    useKnitwitStore.getState().changeRow(1);
    useKnitwitStore.getState().confirmCastOff();
    expect(section().complete).toBe(true);
    useKnitwitStore.getState().changeRow(-1);
    // A section sitting short of its end must not still call itself finished.
    expect(section().complete).toBe(false);
  });

  // Counting the last row used to record the finish, so tapping back and forward counted it again.
  it('records a finish once, however often the last row is re-counted', () => {
    setup();
    const before = useKnitwitStore.getState().achievements.totals.projectsFinished;
    useKnitwitStore.getState().changeRow(1);
    useKnitwitStore.getState().changeRow(-1);
    useKnitwitStore.getState().changeRow(1);
    expect(useKnitwitStore.getState().achievements.totals.projectsFinished).toBe(before);
  });
});

describe('deleting a project', () => {
  it('actually removes it', () => {
    expect(useKnitwitStore.getState().projects.rowan).toBeDefined();
    useKnitwitStore.getState().deleteProject('rowan');
    expect(useKnitwitStore.getState().projects.rowan).toBeUndefined();
  });

  // Home walks this trail looking for somewhere to resume; a deleted project must not linger in it.
  it('takes its sections out of the recent trail', () => {
    useKnitwitStore.getState().setActiveSection('rowan', 0);
    useKnitwitStore.getState().setActiveSection('meadow', 1);
    useKnitwitStore.getState().deleteProject('rowan');
    expect(useKnitwitStore.getState().recentSections.some((r) => r.startsWith('rowan|'))).toBe(false);
    expect(useKnitwitStore.getState().recentSections).toContain('meadow|1');
  });

  it('moves the counter off a project that no longer exists', () => {
    useKnitwitStore.getState().setActiveSection('rowan', 0);
    useKnitwitStore.getState().deleteProject('rowan');
    expect(useKnitwitStore.getState().activeProjectKey).not.toBe('rowan');
    expect(useKnitwitStore.getState().projects[useKnitwitStore.getState().activeProjectKey]).toBeDefined();
  });
});

describe('savePatternFromProject', () => {
  const store = () => useKnitwitStore.getState();

  const draft = () => {
    const project = store().projects.clover;
    return projectToPattern(project, { materials: store().materials, tools: store().tools }, null);
  };

  it('saves the pattern and links the project to it in one go', () => {
    const id = store().savePatternFromProject('clover', draft());
    expect(store().patterns[id]).toBeDefined();
    expect(store().projects.clover.patternId).toBe(id);
  });

  // A project already linked to a pattern moves to the one it just produced — that's the point of
  // saving your own version of a pattern you altered.
  it('relinks a project that already had a pattern', () => {
    const before = store().projects.meadow.patternId;
    const id = store().savePatternFromProject('meadow', draft());
    expect(id).not.toBe(before);
    expect(store().projects.meadow.patternId).toBe(id);
    // The pattern it came from is untouched.
    expect(store().patterns[before!]).toBeDefined();
  });

  // updateProject re-derives a project's colours from the pattern it links to. Going through it
  // here would repaint the project from its own colour and darken it a shade every time.
  it('leaves the project looking exactly as it did', () => {
    const before = store().projects.clover;
    store().savePatternFromProject('clover', draft());
    const after = store().projects.clover;
    expect(after.color).toBe(before.color);
    expect(after.colorDeep).toBe(before.colorDeep);
    expect(after.sections).toEqual(before.sections);
    expect(after.status).toBe(before.status);
  });

  it('counts as making a pattern', () => {
    const before = store().achievements.totals.patternsCreated;
    store().savePatternFromProject('clover', draft());
    expect(store().achievements.totals.patternsCreated).toBe(before + 1);
  });

  it('still saves the pattern when the project has gone', () => {
    const id = store().savePatternFromProject('nope', draft());
    expect(store().patterns[id]).toBeDefined();
  });
});
