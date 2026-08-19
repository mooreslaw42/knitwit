import {
  currentSectionIndexOf,
  formatClock,
  projectProgress,
  sectionStatus,
} from '@/lib/knitwit-helpers';
import type { Project, ProjectSection } from '@/types/knitwit';

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
