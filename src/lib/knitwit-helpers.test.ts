import {
  currentSectionIndexOf,
  darken,
  deriveProjectColors,
  formatClock,
  inUseLabel,
  patternSectionMarkers,
  projectProgress,
  resolveRowGroups,
  rowStitchesAfter,
  sectionRowCounts,
  sectionStatus,
  todayStarted,
  toolInUseCount,
} from '@/lib/knitwit-helpers';
import type { PatternRow, PatternStitchGroup, Project, ProjectSection } from '@/types/knitwit';

function section(overrides: Partial<ProjectSection> = {}): ProjectSection {
  return {
    name: 'Section',
    totalRows: 10,
    row: 0,
    complete: false,
    seconds: 0,
    notes: [],
    materialId: null,
    toolId: null,
    markers: [],
    castOn: 0,
    rows: [],
    ...overrides,
  };
}

function project(sections: ProjectSection[]): Project {
  return {
    name: 'Project',
    started: 'Started Jun 1',
    photo: null,
    color: '#F4C6D3',
    colorDeep: '#E58AA0',
    patternId: null,
    sections,
  };
}

let gid = 0;
function group(overrides: Partial<PatternStitchGroup> = {}): PatternStitchGroup {
  return {
    id: `g${gid++}`,
    type: 'knit',
    span: 'all',
    count: null,
    materialSlot: null,
    note: '',
    ...overrides,
  };
}
function row(stitches: PatternStitchGroup[], overrides: Partial<PatternRow> = {}): PatternRow {
  return { id: `r${gid++}`, label: '', side: 'RS', marker: false, instruction: '', stitches, ...overrides };
}

// A classic sleeve increase: K1, M1L, knit to last st, M1R, K1 → grows by 2.
const increaseRow = () =>
  row([
    group({ type: 'knit', span: 'exact', count: 1 }),
    group({ type: 'm1l', span: 'all' }),
    group({ type: 'knit', span: 'to-last', count: 1 }),
    group({ type: 'm1r', span: 'all' }),
    group({ type: 'knit', span: 'exact', count: 1 }),
  ]);

describe('rowStitchesAfter', () => {
  it('grows by two on a M1L/M1R increase row regardless of width', () => {
    expect(rowStitchesAfter(increaseRow(), 20)).toBe(22);
    expect(rowStitchesAfter(increaseRow(), 61)).toBe(63);
  });

  it('leaves a plain knit/purl row unchanged', () => {
    expect(rowStitchesAfter(row([group({ type: 'purl', span: 'all' })]), 40)).toBe(40);
  });

  it('halves the count on k2tog across, and doubles on kfb across', () => {
    expect(rowStitchesAfter(row([group({ type: 'k2tog', span: 'all' })]), 40)).toBe(20);
    expect(rowStitchesAfter(row([group({ type: 'kfb', span: 'all' })]), 20)).toBe(40);
  });

  it('adds one per yarn-over in a lace repeat, netting zero with matching decreases', () => {
    // *yo, k2tog* across 40 sts: 20 yo (+20) and the k2tog run (−20) net to 40.
    const lace = row([
      group({ type: 'yo', span: 'exact', count: 20 }),
      group({ type: 'k2tog', span: 'all' }),
    ]);
    expect(rowStitchesAfter(lace, 40)).toBe(40);
  });
});

describe('resolveRowGroups', () => {
  it('reserves fixed spans and gives the pool to the flexible consuming group', () => {
    const resolved = resolveRowGroups(increaseRow(), 20);
    // K1, M1L, (knit to last 1), M1R, K1 → the "knit to last" absorbs 17, M1s do 1 each.
    expect(resolved.map((r) => r.units)).toEqual([1, 1, 17, 1, 1]);
  });
});

describe('patternSectionMarkers', () => {
  it('merges bare section markers with rows flagged in the stitch editor', () => {
    const rows = [
      row([group()], { marker: false }),
      row([group()], { marker: true }), // row 2
      row([group()], { marker: false }),
      row([group()], { marker: true }), // row 4
    ];
    expect(patternSectionMarkers({ markers: [3], rows })).toEqual([2, 3, 4]);
  });

  it('de-duplicates when a row is flagged and also listed, and copes with no rows', () => {
    const rows = [row([group()], { marker: true })];
    expect(patternSectionMarkers({ markers: [1], rows })).toEqual([1]);
    expect(patternSectionMarkers({ markers: [5, 2], rows: [] })).toEqual([2, 5]);
  });
});

describe('sectionRowCounts', () => {
  it('reports the live stitch count entering each row from the cast-on', () => {
    const rows = [increaseRow(), row([group({ type: 'purl', span: 'all' })]), increaseRow()];
    // enter row1 at 20 → after 22; row2 plain → 22; row3 → after 24.
    expect(sectionRowCounts(rows, 20)).toEqual([20, 22, 22]);
  });
});

describe('toolInUseCount', () => {
  it('counts one per unfinished section that calls for the tool, across projects', () => {
    const projects = {
      a: project([
        section({ toolId: 't1', complete: false }),
        section({ toolId: 't1', complete: true }), // finished — releases the tool
      ]),
      b: project([section({ toolId: 't1', complete: false })]),
      c: project([section({ toolId: 't2', complete: false })]),
    };
    expect(toolInUseCount(projects, 't1')).toBe(2);
    expect(toolInUseCount(projects, 't2')).toBe(1);
    expect(toolInUseCount(projects, 't3')).toBe(0);
  });
});

describe('inUseLabel', () => {
  it('agrees subject and verb with the count', () => {
    expect(inUseLabel(0)).toBe('None in use');
    expect(inUseLabel(1)).toBe('1 in use');
    expect(inUseLabel(2)).toBe('2 are in use');
    expect(inUseLabel(3)).toBe('3 are in use');
  });
});

describe('formatClock', () => {
  it('formats under an hour without an hour part', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(5)).toBe('0:05');
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(599)).toBe('9:59');
  });

  it('adds an hour part and zero-pads minutes past an hour', () => {
    expect(formatClock(3600)).toBe('1:00:00');
    expect(formatClock(3665)).toBe('1:01:05');
    // The seeded "Sleeve 2 of 2" section, as shown on the section detail screen.
    expect(formatClock(5100)).toBe('1:25:00');
  });

  it('floors fractional seconds rather than rounding up', () => {
    expect(formatClock(59.9)).toBe('0:59');
  });

  it('never renders negative time', () => {
    expect(formatClock(-30)).toBe('0:00');
  });
});

describe('projectProgress', () => {
  it('sums rows across sections', () => {
    // Matches the seeded Meadow Cardigan: 60/60 + 24/60 = 84/120 = 70%.
    const p = project([
      section({ totalRows: 60, row: 60, complete: true }),
      section({ totalRows: 60, row: 24 }),
    ]);
    expect(projectProgress(p)).toEqual({ done: 84, total: 120, pct: 0.7 });
  });

  it('reports zero progress rather than dividing by zero when there are no rows', () => {
    const p = project([section({ totalRows: 0, row: 0 })]);
    expect(projectProgress(p).pct).toBe(0);
  });
});

describe('sectionStatus', () => {
  it('is complete when flagged, regardless of row count', () => {
    expect(sectionStatus(section({ complete: true, row: 0 }))).toBe('complete');
  });

  it('is in-progress once any row is counted', () => {
    expect(sectionStatus(section({ row: 1 }))).toBe('in-progress');
  });

  it('is not-started at row zero', () => {
    expect(sectionStatus(section({ row: 0 }))).toBe('not-started');
  });

  it('counts a fully-counted but unconfirmed section as in-progress, not complete', () => {
    // Reaching the last row is not the same as casting off — the counter still
    // prompts to finish, so this must not report as complete.
    expect(sectionStatus(section({ totalRows: 10, row: 10, complete: false }))).toBe('in-progress');
  });
});

describe('currentSectionIndexOf', () => {
  it('picks the first unfinished section', () => {
    const p = project([section({ complete: true }), section(), section()]);
    expect(currentSectionIndexOf(p)).toBe(1);
  });

  it('falls back to the last section when everything is done', () => {
    const p = project([section({ complete: true }), section({ complete: true })]);
    expect(currentSectionIndexOf(p)).toBe(1);
  });
});

describe('darken', () => {
  it('scales each channel toward black', () => {
    expect(darken('#FFFFFF', 0.5)).toBe('#808080');
    expect(darken('#000000', 0.5)).toBe('#000000');
  });

  it('falls back to the neutral deep colour for anything that is not a 6-digit hex', () => {
    expect(darken('nonsense')).toBe('#8A7873');
    expect(darken('#FFF')).toBe('#8A7873');
  });
});

describe('deriveProjectColors', () => {
  it('takes its colour from the pattern accent', () => {
    const { color, colorDeep } = deriveProjectColors('#F4C6D3');
    expect(color).toBe('#F4C6D3');
    expect(colorDeep).not.toBe('#F4C6D3'); // visibly deeper, for the progress bar
  });

  it('is neutral when improvising without a pattern', () => {
    expect(deriveProjectColors(null)).toEqual({ color: '#F7EBDD', colorDeep: '#8A7873' });
  });
});

describe('todayStarted', () => {
  it('formats as the seeded projects do', () => {
    expect(todayStarted(new Date(2026, 5, 14))).toBe('Started Jun 14');
    expect(todayStarted(new Date(2026, 0, 1))).toBe('Started Jan 1');
  });
});
