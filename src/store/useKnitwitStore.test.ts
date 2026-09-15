import AsyncStorage from '@react-native-async-storage/async-storage';

import { projectToPattern } from '@/lib/project-to-pattern';
import { finishHydration, useKnitwitStore } from '@/store/useKnitwitStore';

type KnitwitStore = ReturnType<typeof useKnitwitStore.getState>;

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
      p.sections.some((s) => s.materialIds.includes('m1')),
    );
    expect(stillReferenced).toBe(false);
  });

  it('clears the reference from any section using a deleted tool', () => {
    useKnitwitStore.getState().deleteTool('t1');
    const stillReferenced = Object.values(useKnitwitStore.getState().projects).some((p) =>
      p.sections.some((s) => s.toolIds.includes('t1')),
    );
    expect(stillReferenced).toBe(false);
  });
});

describe('notes', () => {
  it('records a note against a row and closes the form', () => {
    useKnitwitStore.getState().openNoteForm();
    useKnitwitStore.getState().saveNote(12, 'Dropped a stitch here');
    const note = activeSection().rowNotes.at(-1);
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
    const inheritedNote = project.sections[1].rowNotes[0];
    expect(inheritedNote.text).toBe(patterns.p1.sections[1].rowNotes[0].text);
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
    expect(project.sections[0].materialIds).toEqual(['m3']);
    expect(project.sections[0].toolIds).toEqual(['t3']);
    // The full mapping is kept on the project for later reference.
    expect(project.slotMaterials).toEqual({ p1m1: 'm3', p1m2: 'm1' });
    expect(project.slotTools).toEqual({ p1t1: 't3' });
  });

  it('leaves an unmapped slot section without a concrete stash item', () => {
    const key = useKnitwitStore
      .getState()
      .createProject({ name: 'Cardi', startedOn: null, craft: 'knit', patternId: 'p1', totalRows: 10 });
    const project = useKnitwitStore.getState().projects[key];
    expect(project.sections[0].materialIds).toEqual([]);
    expect(project.sections[0].toolIds).toEqual([]);
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
    return projectToPattern(
      project,
      {
        materials: store().materials,
        tools: store().tools,
        techniques: store().techniques,
        catalogue: store().catalogue,
      },
      null,
    );
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

describe('a section’s yarn, tools and techniques', () => {
  const store = () => useKnitwitStore.getState();
  const section = () => store().projects.clover.sections[0];

  it('takes more than one yarn, which is the whole point', () => {
    store().setSectionKit('clover', 0, { materialIds: ['m1', 'm2'] });
    expect(section().materialIds).toEqual(['m1', 'm2']);
  });

  it('takes more than one tool', () => {
    store().setSectionKit('clover', 0, { toolIds: ['t1', 't2'] });
    expect(section().toolIds).toEqual(['t1', 't2']);
  });

  it('gives a project techniques, which it never had before', () => {
    const [id] = Object.keys(store().techniques);
    store().setSectionKit('clover', 0, { techniqueIds: [id] });
    expect(section().techniqueIds).toEqual([id]);
  });

  it('clears a list back to empty', () => {
    store().setSectionKit('clover', 0, { materialIds: ['m1'] });
    store().setSectionKit('clover', 0, { materialIds: [] });
    expect(section().materialIds).toEqual([]);
  });

  // An omitted list means "not touching that one" — toggling a yarn must not clear the needles.
  it('leaves a list the patch does not mention alone', () => {
    store().setSectionKit('clover', 0, { materialIds: ['m1'], toolIds: ['t1'] });
    store().setSectionKit('clover', 0, { materialIds: ['m2'] });
    expect(section().toolIds).toEqual(['t1']);
  });

  // A section pointing at a yarn that isn't in the stash renders as nothing on every screen, so
  // storing the id would be a lie none of them could see.
  it('drops ids that are not in the stash, keeping the ones that are', () => {
    store().setSectionKit('clover', 0, { materialIds: ['m1', 'not-a-yarn'] });
    expect(section().materialIds).toEqual(['m1']);
  });

  it('does not store the same id twice', () => {
    store().setSectionKit('clover', 0, { materialIds: ['m1', 'm1'] });
    expect(section().materialIds).toEqual(['m1']);
  });

  it('touches nothing else about the section', () => {
    const before = section();
    store().setSectionKit('clover', 0, { materialIds: ['m1'] });
    const after = section();
    expect(after.row).toBe(before.row);
    expect(after.totalRows).toBe(before.totalRows);
    expect(after.seconds).toBe(before.seconds);
    expect(after.rowNotes).toEqual(before.rowNotes);
  });

  it('leaves the other sections alone', () => {
    const before = store().projects.meadow.sections[1];
    store().setSectionKit('meadow', 0, { materialIds: ['m1'] });
    expect(store().projects.meadow.sections[1]).toEqual(before);
  });

  it('shrugs off a section index that is not there', () => {
    const before = store().projects.clover;
    store().setSectionKit('clover', 99, { materialIds: ['m1'] });
    store().setSectionKit('nope', 0, { materialIds: ['m1'] });
    expect(store().projects.clover).toEqual(before);
  });

  it('can be set as the section is created', () => {
    const [q] = Object.keys(store().techniques);
    store().addSection('clover', {
      name: 'Edging',
      totalRows: 12,
      materialIds: ['m1', 'm2'],
      toolIds: ['t1'],
      techniqueIds: [q],
    });
    expect(store().projects.clover.sections.at(-1)).toMatchObject({
      name: 'Edging',
      materialIds: ['m1', 'm2'],
      toolIds: ['t1'],
      techniqueIds: [q],
    });
  });

  it('still defaults to empty when a section is added without them', () => {
    store().addSection('clover', { name: 'Edging', totalRows: 12 });
    expect(store().projects.clover.sections.at(-1)).toMatchObject({
      materialIds: [],
      toolIds: [],
      techniqueIds: [],
    });
  });
});

describe('deleting a stash item lets its sections go', () => {
  const store = () => useKnitwitStore.getState();
  const section = () => store().projects.clover.sections[0];

  it('removes a deleted yarn without disturbing the others', () => {
    store().setSectionKit('clover', 0, { materialIds: ['m1', 'm2'] });
    store().deleteMaterial('m1');
    expect(section().materialIds).toEqual(['m2']);
  });

  it('removes a deleted tool without disturbing the others', () => {
    store().setSectionKit('clover', 0, { toolIds: ['t1', 't2'] });
    store().deleteTool('t1');
    expect(section().toolIds).toEqual(['t2']);
  });

  // Techniques never needed this before, because a project couldn't reference one.
  it('removes a deleted technique', () => {
    const [id] = Object.keys(store().techniques);
    store().setSectionKit('clover', 0, { techniqueIds: [id] });
    store().deleteTechnique(id);
    expect(section().techniqueIds).toEqual([]);
  });
});

// The repair that this pins is the one that already went wrong once: it lived inside `migrate`,
// zustand skips `migrate` when the stored version already matches, and a store written by a build
// that had the bumped version but not yet the back-fill could never be repaired. It lives in
// `merge` now, which runs every hydration, and keys off the shape rather than the version.
describe('hydrating a store saved before sections had kit lists', () => {
  const persist = useKnitwitStore.persist;

  const saved = (sections: unknown[], extra: Record<string, unknown> = {}) => ({
    state: {
      projects: {
        p: { name: 'Improvised', patternId: null, sections, ...extra },
      },
      patterns: {},
    },
    // Deliberately the current version, so migrate does not run at all.
    version: 24,
  });

  const hydrate = async (payload: unknown) => {
    await AsyncStorage.setItem('knitwit-store', JSON.stringify(payload));
    await persist.rehydrate();
    return useKnitwitStore.getState().projects.p.sections;
  };

  it('turns the old single yarn and tool into lists', async () => {
    const [section] = await hydrate(
      saved([{ name: 'Main', materialId: 'm1', toolId: 't1', notes: [], markers: [], rows: [] }]),
    );
    expect(section.materialIds).toEqual(['m1']);
    expect(section.toolIds).toEqual(['t1']);
    expect(section.techniqueIds).toEqual([]);
    expect(section).not.toHaveProperty('materialId');
  });

  it('reads a section that had neither as empty rather than undefined', async () => {
    const [section] = await hydrate(
      saved([{ name: 'Main', materialId: null, toolId: null, notes: [], markers: [], rows: [] }]),
    );
    expect(section.materialIds).toEqual([]);
    expect(section.toolIds).toEqual([]);
  });

  // The recovery half: a two-colour section used to resolve to no yarn at all, because a stash
  // item was only banked when the pattern named exactly one slot. The pattern still knows.
  it('recovers both yarns of a section the old code could only drop', async () => {
    const [section] = await hydrate({
      state: {
        patterns: {
          pat: {
            sections: [{ name: 'Yoke', materials: ['sA', 'sB'], tools: ['sT'] }],
          },
        },
        projects: {
          p: {
            name: 'Fair Isle',
            patternId: 'pat',
            slotMaterials: { sA: 'm1', sB: 'm2' },
            slotTools: { sT: 't1' },
            sections: [
              { name: 'Yoke', materialId: null, toolId: null, notes: [], markers: [], rows: [] },
            ],
          },
        },
      },
      version: 24,
    });
    expect(section.materialIds).toEqual(['m1', 'm2']);
    expect(section.toolIds).toEqual(['t1']);
  });

  it('leaves a section that already has lists exactly as it is', async () => {
    const [section] = await hydrate(
      saved([
        {
          name: 'Main',
          materialIds: ['m2'],
          toolIds: [],
          techniqueIds: ['q1'],
          notes: [],
          markers: [],
          rows: [],
        },
      ]),
    );
    expect(section.materialIds).toEqual(['m2']);
    expect(section.techniqueIds).toEqual(['q1']);
  });
});

describe('a project section’s instructions and chart', () => {
  const store = () => useKnitwitStore.getState();
  const section = () => store().projects.clover.sections[0];

  const row = (id: string) => ({
    id,
    label: id,
    side: 'RS' as const,
    marker: false,
    instruction: '',
    stitches: [
      { id: `g-${id}`, type: 'knit', span: 'all' as const, count: null, materialSlot: null, note: '' },
    ],
  });

  it('saves the written instructions and the rows charted from them', () => {
    store().setSectionStitches('clover', 0, {
      description: 'Row 1 (RS): K to end.',
      castOn: 88,
      rows: [row('r1'), row('r2')],
    });
    expect(section().description).toBe('Row 1 (RS): K to end.');
    expect(section().castOn).toBe(88);
    expect(section().rows).toHaveLength(2);
  });

  it('keeps the cast-on a whole number that a chart can count from', () => {
    store().setSectionStitches('clover', 0, { description: '', castOn: -4, rows: [] });
    expect(section().castOn).toBe(0);
  });

  it('leaves progress and everything else alone', () => {
    const before = section();
    store().setSectionStitches('clover', 0, { description: 'x', castOn: 10, rows: [] });
    const after = section();
    expect(after.row).toBe(before.row);
    expect(after.seconds).toBe(before.seconds);
    expect(after.rowNotes).toEqual(before.rowNotes);
    expect(after.materialIds).toEqual(before.materialIds);
  });

  it('shrugs off a section that is not there', () => {
    const before = store().projects.clover;
    store().setSectionStitches('clover', 99, { description: 'x', castOn: 1, rows: [] });
    expect(store().projects.clover).toEqual(before);
  });
});

describe('a project created without a pattern', () => {
  const store = () => useKnitwitStore.getState();

  it('reads its category off its own name rather than waiting to be converted', () => {
    const key = store().createProject({
      name: 'Stripy Baby Blanket',
      startedOn: null,
      craft: 'knit',
      patternId: null,
      totalRows: 40,
    });
    expect(store().projects[key].category).toBe('blankets');
    expect(store().projects[key].level).toBe('intermediate');
  });

  it('takes the details off the pattern when there is one', () => {
    const patternId = store().savePattern(null, {
      ...store().patterns[Object.keys(store().patterns)[0]],
      category: 'socks',
      level: 'advanced',
      needleSize: '2.5mm',
      video: 'https://x.test',
    });
    const key = store().createProject({
      name: 'Anything',
      startedOn: null,
      craft: 'knit',
      patternId,
      totalRows: 40,
    });
    expect(store().projects[key]).toMatchObject({
      category: 'socks',
      level: 'advanced',
      needleSize: '2.5mm',
      video: 'https://x.test',
    });
  });

  it('starts its one section with room for instructions and a chart', () => {
    const key = store().createProject({
      name: 'Improvised',
      startedOn: null,
      craft: 'knit',
      patternId: null,
      totalRows: 40,
    });
    expect(store().projects[key].sections[0]).toMatchObject({
      description: '',
      stitchMultiple: null,
      rows: [],
    });
  });
});

describe('hydrating a store saved before a project held what a pattern holds', () => {
  const persist = useKnitwitStore.persist;

  const hydrate = async (payload: unknown) => {
    await AsyncStorage.setItem('knitwit-store', JSON.stringify(payload));
    await persist.rehydrate();
    return useKnitwitStore.getState().projects.p;
  };

  const bareSection = { name: 'Main', materialIds: [], toolIds: [], techniqueIds: [] };

  it('gives an improvised project a category read off its name', async () => {
    const project = await hydrate({
      state: {
        patterns: {},
        projects: { p: { name: 'Winter Socks', patternId: null, sections: [bareSection] } },
      },
      version: 24,
    });
    expect(project.category).toBe('socks');
    expect(project.level).toBe('intermediate');
    expect(project.needleSize).toBe('');
  });

  it('seeds a linked project from the pattern it was made from', async () => {
    const project = await hydrate({
      state: {
        patterns: {
          pat: { category: 'hats', level: 'easy', needleSize: '5mm', video: 'https://v.test', sections: [] },
        },
        projects: { p: { name: 'Anything', patternId: 'pat', sections: [bareSection] } },
      },
      version: 24,
    });
    expect(project).toMatchObject({
      category: 'hats',
      level: 'easy',
      needleSize: '5mm',
      video: 'https://v.test',
    });
  });

  it('gives every section somewhere to write instructions', async () => {
    const project = await hydrate({
      state: {
        patterns: {},
        projects: { p: { name: 'Improvised', patternId: null, sections: [bareSection] } },
      },
      version: 24,
    });
    expect(project.sections[0].description).toBe('');
    expect(project.sections[0].stitchMultiple).toBeNull();
  });

  it('does not overwrite what a project already says about itself', async () => {
    const project = await hydrate({
      state: {
        patterns: { pat: { category: 'hats', level: 'easy', sections: [] } },
        projects: {
          p: {
            name: 'Mine',
            patternId: 'pat',
            category: 'toys',
            level: 'advanced',
            needleSize: '3mm',
            video: '',
            sourceName: '',
            sourceText: 'kept',
            sections: [{ ...bareSection, description: 'Row 1: K.', stitchMultiple: { of: 4, plus: 0 } }],
          },
        },
      },
      version: 24,
    });
    expect(project).toMatchObject({ category: 'toys', level: 'advanced', sourceText: 'kept' });
    expect(project.sections[0].description).toBe('Row 1: K.');
    expect(project.sections[0].stitchMultiple).toEqual({ of: 4, plus: 0 });
  });
});

describe('improvising a project with planned sections', () => {
  const store = () => useKnitwitStore.getState();

  type Planned = NonNullable<Parameters<KnitwitStore['createProject']>[0]['sections']>;

  const make = (sections: Planned) =>
    store().createProject({
      name: 'Improvised',
      startedOn: null,
      craft: 'knit',
      patternId: null,
      totalRows: 60,
      sections,
    });

  it('creates every section the wizard planned', () => {
    const key = make([
      { name: 'Body', totalRows: 80 },
      { name: 'Left sleeve', totalRows: 40 },
    ]);
    expect(store().projects[key].sections.map((s) => [s.name, s.totalRows])).toEqual([
      ['Body', 80],
      ['Left sleeve', 40],
    ]);
  });

  it('carries each section’s yarn, tools, techniques and instructions', () => {
    const key = make([
      {
        name: 'Body',
        totalRows: 80,
        description: 'Row 1: K all.',
        materialIds: ['m1', 'm2'],
        toolIds: ['t1'],
        techniqueIds: [],
      },
    ]);
    expect(store().projects[key].sections[0]).toMatchObject({
      description: 'Row 1: K all.',
      materialIds: ['m1', 'm2'],
      toolIds: ['t1'],
    });
  });

  it('starts every planned section at zero, however it was planned', () => {
    const key = make([{ name: 'Body', totalRows: 80 }]);
    expect(store().projects[key].sections[0]).toMatchObject({ row: 0, complete: false, seconds: 0 });
  });

  it('names a section the knitter left blank rather than saving an empty one', () => {
    const key = make([{ name: '   ', totalRows: 20 }]);
    expect(store().projects[key].sections[0].name).toBe('Section 1');
  });

  it('never plans a section with no rows to count', () => {
    const key = make([{ name: 'Body', totalRows: 0 }]);
    expect(store().projects[key].sections[0].totalRows).toBe(1);
  });

  // Every screen reads sections[0], and the last section can't be deleted for the same reason.
  it('falls back to one section when none were planned', () => {
    const key = make([]);
    expect(store().projects[key].sections).toHaveLength(1);
    expect(store().projects[key].sections[0]).toMatchObject({ name: 'Main', totalRows: 60 });
  });

  // A pattern's sections are the thing being knitted; extras alongside them would give the
  // project two sources of truth.
  it('ignores planned sections when a pattern supplies its own', () => {
    const patternId = Object.entries(store().patterns).find(([, p]) => p.sections.length > 0)![0];
    const key = store().createProject({
      name: 'From a pattern',
      startedOn: null,
      craft: 'knit',
      patternId,
      totalRows: 60,
      sections: [{ name: 'Invented', totalRows: 5 }],
    });
    const names = store().projects[key].sections.map((s) => s.name);
    expect(names).not.toContain('Invented');
    expect(names).toEqual(store().patterns[patternId].sections.map((s) => s.name));
  });
});

describe('free-text notes', () => {
  const store = () => useKnitwitStore.getState();

  it('saves a project’s notes without a save step', () => {
    store().setProjectNotes('clover', 'Ran out of yarn at row 40.');
    expect(store().projects.clover.notes).toBe('Ran out of yarn at row 40.');
  });

  it('saves a section’s notes', () => {
    store().setSectionNotes('clover', 0, 'Cable crosses every 8th row.');
    expect(store().projects.clover.sections[0].notes).toBe('Cable crosses every 8th row.');
  });

  it('saves a pattern’s notes, and a pattern section’s', () => {
    const [id] = Object.keys(store().patterns);
    store().setPatternNotes(id, 'Errata: row 12 should read k2tog.');
    store().setPatternSectionNotes(id, 0, 'Worked flat, not in the round.');
    expect(store().patterns[id].notes).toBe('Errata: row 12 should read k2tog.');
    expect(store().patterns[id].sections[0].notes).toBe('Worked flat, not in the round.');
  });

  // Row-pinned notes and free text are different things that used to share a name.
  it('leaves the row-pinned notes alone', () => {
    const before = store().projects.clover.sections[0].rowNotes;
    store().setSectionNotes('clover', 0, 'anything');
    expect(store().projects.clover.sections[0].rowNotes).toEqual(before);
  });

  it('shrugs off a project, pattern or section that is not there', () => {
    const before = store().projects;
    store().setProjectNotes('nope', 'x');
    store().setSectionNotes('clover', 99, 'x');
    store().setPatternNotes('nope', 'x');
    store().setPatternSectionNotes('nope', 0, 'x');
    expect(store().projects).toEqual(before);
  });
});

describe('notes travelling between a pattern and a project', () => {
  const store = () => useKnitwitStore.getState();

  it('starts a project off with the pattern’s notes', () => {
    const patternId = Object.entries(store().patterns).find(([, p]) => p.sections.length > 0)![0];
    store().setPatternNotes(patternId, 'Knits large — go down a size.');
    store().setPatternSectionNotes(patternId, 0, 'Cast on loosely.');

    const key = store().createProject({
      name: 'From a pattern',
      startedOn: null,
      craft: 'knit',
      patternId,
      totalRows: 60,
    });
    expect(store().projects[key].notes).toBe('Knits large — go down a size.');
    expect(store().projects[key].sections[0].notes).toBe('Cast on loosely.');
  });

  // A project is a copy, not a view: what you scribble on your own make is yours.
  it('does not write a project’s notes back to the pattern it came from', () => {
    const patternId = Object.entries(store().patterns).find(([, p]) => p.sections.length > 0)![0];
    store().setPatternNotes(patternId, 'Original.');
    const key = store().createProject({
      name: 'Mine',
      startedOn: null,
      craft: 'knit',
      patternId,
      totalRows: 60,
    });
    store().setProjectNotes(key, 'Changed my mind.');
    expect(store().patterns[patternId].notes).toBe('Original.');
  });

  it('carries them back out when the project is saved as a pattern', () => {
    store().setProjectNotes('clover', 'Blocked to 90cm.');
    store().setSectionNotes('clover', 0, 'Two skeins, just.');
    const project = store().projects.clover;
    const draft = projectToPattern(
      project,
      {
        materials: store().materials,
        tools: store().tools,
        techniques: store().techniques,
        catalogue: store().catalogue,
      },
      null,
    );
    expect(draft.notes).toBe('Blocked to 90cm.');
    expect(draft.sections[0].notes).toBe('Two skeins, just.');
  });
});

// The rename this exists to survive: row-pinned notes were called `notes` until the plain
// free-text field took the name. A saved store has an array sitting where a string now goes, and
// every screen reads one or the other without checking.
describe('hydrating a store saved before notes split in two', () => {
  const persist = useKnitwitStore.persist;

  const hydrate = async (payload: unknown) => {
    await AsyncStorage.setItem('knitwit-store', JSON.stringify(payload));
    await persist.rehydrate();
    return useKnitwitStore.getState();
  };

  const oldNotes = [{ id: 1, row: 12, text: 'Dropped a stitch' }];
  // Read off the store rather than written down, so bumping the version can't quietly send these
  // back through `migrate` and make them pass for the wrong reason again.
  const CURRENT_VERSION = persist.getOptions().version;

  it('moves a project section’s row-pinned notes to rowNotes', async () => {
    const state = await hydrate({
      state: {
        patterns: {},
        projects: {
          p: {
            name: 'Old',
            patternId: null,
            sections: [{ name: 'Main', notes: oldNotes, materialIds: [], toolIds: [] }],
          },
        },
      },
      version: 24,
    });
    expect(state.projects.p.sections[0].rowNotes).toEqual(oldNotes);
    expect(state.projects.p.sections[0].notes).toBe('');
  });

  // At the *current* version, which is the whole point. This repair used to live in `migrate`
  // and this test passed only because it hydrated an older version — so the suite was green while
  // every pattern in a real store stayed unrepaired.
  it('does the same for a pattern section', async () => {
    const state = await hydrate({
      state: {
        patterns: { pat: { sections: [{ name: 'Body', notes: oldNotes }] } },
        projects: {},
      },
      version: CURRENT_VERSION,
    });
    expect(state.patterns.pat.sections[0].rowNotes).toEqual(oldNotes);
    expect(state.patterns.pat.sections[0].notes).toBe('');
  });

  // The reported crash: "Save project" on a pattern-linked project threw
  // "Cannot read properties of undefined (reading 'map')" at `ps.rowNotes.map`.
  it('lets a project be started from a pattern stored before the rename', async () => {
    await hydrate({
      state: {
        patterns: {
          pat: {
            name: 'Camisole',
            sections: [{ name: 'Body', totalRows: 10, castOn: 0, notes: oldNotes }],
          },
        },
        projects: {},
      },
      version: CURRENT_VERSION,
    });

    expect(() =>
      useKnitwitStore.getState().createProject({
        name: 'From pattern',
        startedOn: '2026-09-14',
        craft: 'knit',
        patternId: 'pat',
        totalRows: 60,
      }),
    ).not.toThrow();

    const project = Object.values(useKnitwitStore.getState().projects).find(
      (p) => p.name === 'From pattern',
    )!;
    expect(project.sections[0].rowNotes.map((n) => n.text)).toEqual(['Dropped a stitch']);
    expect(project.sections[0].notes).toBe('');
  });

  // Every screen reads these as arrays with no guard. Same gate, same failure.
  it('back-fills a pattern’s lists at the current version', async () => {
    const state = await hydrate({
      state: {
        patterns: { pat: { name: 'Bare', sections: [{ name: 'Body' }] } },
        projects: {},
      },
      version: CURRENT_VERSION,
    });
    const pattern = state.patterns.pat;
    expect(pattern.materials).toEqual([]);
    expect(pattern.tools).toEqual([]);
    expect(pattern.techniques).toEqual([]);
    expect(pattern.sizes).toEqual([]);
    expect(pattern.sections[0].rows).toEqual([]);
    expect(pattern.sections[0].markers).toEqual([]);
  });

  it('gives a project and a pattern somewhere to write notes', async () => {
    const state = await hydrate({
      state: {
        patterns: { pat: { sections: [] } },
        projects: { p: { name: 'Old', patternId: null, sections: [] } },
      },
      version: CURRENT_VERSION,
    });
    expect(state.projects.p.notes).toBe('');
    expect(state.patterns.pat.notes).toBe('');
  });

  it('leaves notes that are already split alone', async () => {
    const state = await hydrate({
      state: {
        patterns: {},
        projects: {
          p: {
            name: 'New',
            patternId: null,
            notes: 'project note',
            sections: [
              { name: 'Main', rowNotes: oldNotes, notes: 'section note', materialIds: [], toolIds: [] },
            ],
          },
        },
      },
      version: 24,
    });
    expect(state.projects.p.notes).toBe('project note');
    expect(state.projects.p.sections[0].notes).toBe('section note');
    expect(state.projects.p.sections[0].rowNotes).toEqual(oldNotes);
  });
});

// The failure that could quietly cost someone a year of work: storage that cannot be read used to
// leave the app on its loading screen for ever, looking broken while the data sat intact on disk.
//
// Tested at the callback rather than through the storage layer, because the AsyncStorage jest mock
// does not reject the way the real one does — so driving it from a corrupt string would test the
// mock, not this.
describe('finishing hydration when the saved data cannot be read', () => {
  afterEach(() => {
    useKnitwitStore.setState({ hydrationError: null, hasHydrated: true });
  });

  it('still finishes starting up, so there is something to rescue the data from', () => {
    useKnitwitStore.setState({ hasHydrated: false, hydrationError: null });
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => {});

    finishHydration(undefined, new SyntaxError('Unexpected token h in JSON at position 2'));

    // Both halves matter. Without the first the root layout never renders at all; without the
    // second it renders an empty app indistinguishable from a fresh install.
    expect(useKnitwitStore.getState().hasHydrated).toBe(true);
    expect(useKnitwitStore.getState().hydrationError).toMatch(/Unexpected token/);
    quiet.mockRestore();
  });

  it('describes a thrown value that is not an Error', () => {
    useKnitwitStore.setState({ hasHydrated: false, hydrationError: null });
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => {});

    finishHydration(undefined, 'storage unavailable');

    expect(useKnitwitStore.getState().hasHydrated).toBe(true);
    expect(useKnitwitStore.getState().hydrationError).toBe('storage unavailable');
    quiet.mockRestore();
  });

  it('leaves no error behind on an ordinary start', () => {
    useKnitwitStore.setState({ hasHydrated: false, hydrationError: null });

    finishHydration(useKnitwitStore.getState());

    expect(useKnitwitStore.getState().hasHydrated).toBe(true);
    expect(useKnitwitStore.getState().hydrationError).toBeNull();
  });
});
