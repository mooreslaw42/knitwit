import {
  matchesCraft,
  currentSectionIndexOf,
  darken,
  deriveProjectColors,
  formatClock,
  formatSizeRun,
  formatStarted,
  inUseLabel,
  parseSizeRun,
  parseStartedText,
  patternSectionMarkers,
  projectProgress,
  projectState,
  resolveRowGroups,
  rowStitchesAfter,
  sectionRowCounts,
  sectionStatus,
  sizeValue,
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

function project(sections: ProjectSection[]): Project {
  return {
    name: 'Project',
    startedOn: null, craft: 'knit',
    category: 'sweaters',
    level: 'intermediate',
    needleSize: '',
    video: '',
    sourceName: '',
    sourceText: '',
    notes: '',
    labels: [],
    photo: null,
    color: '#F4C6D3',
    colorDeep: '#E58AA0',
    patternId: null,
    sizeIndex: 0,
    status: 'active',
    gauge: null,
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

describe('per-size numbers', () => {
  it('treats a plain number as the same for every size', () => {
    expect(sizeValue(6, 0)).toBe(6);
    expect(sizeValue(6, 4)).toBe(6);
  });

  it('picks the entry for the size, clamping past the end rather than throwing', () => {
    const run = [6, 6, 7, 7, 9];
    expect(sizeValue(run, 0)).toBe(6);
    expect(sizeValue(run, 2)).toBe(7);
    expect(sizeValue(run, 4)).toBe(9);
    // A short run is a data error; knitting the largest size beats crashing mid-pattern.
    expect(sizeValue(run, 99)).toBe(9);
    expect(sizeValue([], 0)).toBe(0);
  });

  it('round-trips knitting\'s own notation', () => {
    expect(formatSizeRun([6, 6, 7, 7, 9])).toBe('6 (6) 7 (7) 9');
    expect(formatSizeRun(6)).toBe('6');
    expect(parseSizeRun('6 (6) 7 (7) 9')).toEqual([6, 6, 7, 7, 9]);
    // Comma notation means the same thing.
    expect(parseSizeRun('6, 6, 7, 7, 9')).toEqual([6, 6, 7, 7, 9]);
    // One number stays scalar, so patterns that don't vary by size stay simple.
    expect(parseSizeRun('6')).toBe(6);
    expect(parseSizeRun('')).toBeNull();
  });

  it('resolves per-size counts when working out a row', () => {
    // "k2 (4) 6" then knit to end, on 20 sts: the fixed run differs per size.
    const r = row([
      group({ type: 'k2tog', span: 'exact', count: [2, 4, 6] }),
      group({ type: 'knit', span: 'all' }),
    ]);
    // k2tog twice removes 2 sts; four times removes 4; six times removes 6.
    expect(rowStitchesAfter(r, 20, 0)).toBe(18);
    expect(rowStitchesAfter(r, 20, 1)).toBe(16);
    expect(rowStitchesAfter(r, 20, 2)).toBe(14);
  });

  it('resolves a per-size cast-on', () => {
    const rows = [row([group({ type: 'knit', span: 'all' })])];
    expect(sectionRowCounts(rows, [20, 30, 40], 0)).toEqual([20]);
    expect(sectionRowCounts(rows, [20, 30, 40], 2)).toEqual([40]);
  });
});

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
        section({ toolIds: ['t1'], complete: false }),
        section({ toolIds: ['t1'], complete: true }), // finished — releases the tool
      ]),
      b: project([section({ toolIds: ['t1'], complete: false })]),
      c: project([section({ toolIds: ['t2'], complete: false })]),
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

describe('formatStarted', () => {
  it('reads the way a person writes a date', () => {
    expect(formatStarted('2026-06-14')).toBe('Started 14 June 2026');
  });

  // No date is a real answer, not an error — plenty of projects are already on the needles when
  // they get added.
  it('says something sensible when no date was given', () => {
    expect(formatStarted(null)).toBe('Just cast on');
    expect(formatStarted('not a date')).toBe('Just cast on');
  });
});

describe('parseStartedText', () => {
  const today = new Date(2026, 8, 13); // 13 September 2026

  it('reads the free text a previous version stored', () => {
    expect(parseStartedText('Started Jun 14', today)).toBe('2026-06-14');
    expect(parseStartedText('Started Jan 1', today)).toBe('2026-01-01');
  });

  // The year was never recorded, so it's inferred — and a date later this year has to mean last
  // year, because you cannot have cast on next month.
  it('puts a date still to come this year into last year', () => {
    expect(parseStartedText('Started Dec 25', today)).toBe('2025-12-25');
  });

  it('gives up rather than inventing a date', () => {
    expect(parseStartedText('')).toBeNull();
    expect(parseStartedText('Just cast on')).toBeNull();
  });
});

describe('projectState', () => {
  const partWorked = () => project([section({ row: 10, totalRows: 20 })]);
  const allCounted = () => project([section({ row: 20, totalRows: 20 })]);

  it('is active while there are rows left', () => {
    expect(projectState(partWorked())).toBe('active');
  });

  it('is finished once every row is counted, without anyone saying so', () => {
    expect(projectState(allCounted())).toBe('finished');
  });

  it('honours a status the knitter set, over what the rows say', () => {
    expect(projectState({ ...partWorked(), status: 'finished' })).toBe('finished');
    expect(projectState({ ...allCounted(), status: 'frogged' })).toBe('frogged');
  });

  // The bug this fixes: a frogged project was filed by its row count, so it turned up under
  // "In progress" or "Completed" depending on how far it had got before being ripped out.
  it('keeps a part-worked frogged project out of "in progress"', () => {
    expect(projectState({ ...partWorked(), status: 'frogged' })).toBe('frogged');
  });
});

describe('matchesCraft', () => {
  it('lets everything through when no craft is chosen', () => {
    expect(matchesCraft('knit', 'all')).toBe(true);
    expect(matchesCraft('crochet', 'all')).toBe(true);
    expect(matchesCraft('both', 'all')).toBe(true);
  });

  it('matches the craft asked for', () => {
    expect(matchesCraft('knit', 'knit')).toBe(true);
    expect(matchesCraft('crochet', 'knit')).toBe(false);
  });

  // A knitted garment with a crocheted edging is something you'd go looking for under either, and
  // it's the rule the craft awards already use.
  it('shows a both-craft piece under knitting and under crochet alike', () => {
    expect(matchesCraft('both', 'knit')).toBe(true);
    expect(matchesCraft('both', 'crochet')).toBe(true);
  });

  // The narrow one: asking for Both means pieces that are actually a mix, not everything.
  it('does not answer Both with a single-craft piece', () => {
    expect(matchesCraft('knit', 'both')).toBe(false);
    expect(matchesCraft('crochet', 'both')).toBe(false);
    expect(matchesCraft('both', 'both')).toBe(true);
  });
});
