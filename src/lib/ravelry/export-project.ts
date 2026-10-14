// Turn a Knitwit project into a Ravelry one.
//
// The other direction, and deliberately much smaller than the import. Ravelry is where a knitter's
// public notebook lives, so writing to it is writing to something other people read: this sends the
// facts of a project and nothing else, creates only (never updates or deletes), and happens only
// when the knitter presses the button.
//
// Pure. The ids Ravelry wants for craft and status are names here — the function resolves them
// against Ravelry's own lists, because hardcoding numbers found in one fixture is how an export
// silently files everything as the wrong craft.

import { projectProgress } from '@/lib/knitwit-helpers';
import type { Project, ProjectStatus, TechniqueCraft } from '@/types/knitwit';

// Flat parameters for `POST /projects/{username}/create.json`. The two `*_name` fields are not
// Ravelry's — they are what the function swaps for `craft_id` and `project_status_id`.
export type RavelryProjectDraft = {
  name: string;
  craft_name: string;
  status_name: string;
  pattern_id?: number;
  started?: string;
  progress?: number;
  notes?: string;
  size?: string;
  personal_source_name?: string;
  gauge?: number;
  row_gauge?: number;
  gauge_divisor?: number;
};

export type RavelryExportContext = {
  // Ravelry's own id for the pattern this project was made from — set only when the linked pattern
  // came from Ravelry in the first place. A pattern the knitter wrote themselves has no id there,
  // and inventing a link to a stranger's pattern would be worse than leaving it blank.
  ravelryPatternId?: number | null;
  // What the knitter calls the size they are making, when a pattern is linked. Ravelry's `size` is
  // free text, which is exactly what Pattern.sizes holds.
  sizeName?: string | null;
};

// Ravelry files a project under exactly one craft, so a project that is both goes in as knitting —
// which is the craft its needles, gauge and row counts are already described in. Nothing is lost:
// the knitter can change it there, and the notes travel with it.
const CRAFT_NAMES: Record<TechniqueCraft, string> = {
  knit: 'Knitting',
  crochet: 'Crochet',
  both: 'Knitting',
};

// Knitwit's three onto the names Ravelry uses. Hibernating exists there and not here, so an active
// project goes across as in progress — the knitter can hibernate it on Ravelry if that is what it is.
const STATUS_NAMES: Record<ProjectStatus, string> = {
  active: 'In progress',
  finished: 'Finished',
  frogged: 'Frogged',
};

// "2026-10-01" → "2026/10/01", the form Ravelry's own reads come back in.
function toRavelryDate(iso: string | null): string | undefined {
  const match = (iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[1]}/${match[2]}/${match[3]}` : undefined;
}

// Rows counted, as the percentage Ravelry keeps. A finished project is 100 whatever its sections
// say, because the knitter calling it finished outranks an un-tapped last row.
function toRavelryProgress(project: Project): number {
  if (project.status === 'finished') return 100;
  return Math.max(0, Math.min(100, Math.round(projectProgress(project).pct * 100)));
}

export function knitwitProjectToRavelry(
  project: Project,
  context: RavelryExportContext = {},
): RavelryProjectDraft {
  const draft: RavelryProjectDraft = {
    name: project.name,
    craft_name: CRAFT_NAMES[project.craft],
    status_name: STATUS_NAMES[project.status],
    progress: toRavelryProgress(project),
  };

  if (context.ravelryPatternId != null) draft.pattern_id = context.ravelryPatternId;

  const started = toRavelryDate(project.startedOn);
  if (started) draft.started = started;

  // Only what the knitter actually wrote. An empty field sent as an empty string is still a field
  // Ravelry would store, and a notebook full of blanks is worse than one with gaps.
  if (project.notes.trim()) draft.notes = project.notes;
  if (context.sizeName?.trim()) draft.size = context.sizeName;
  if (project.sourceName.trim()) draft.personal_source_name = project.sourceName;

  // The knitter's measured gauge, not the pattern's — Ravelry's project gauge means theirs.
  const mine = project.gauge?.mine;
  if (mine && mine.stitches > 0) {
    draft.gauge = mine.stitches;
    draft.gauge_divisor = mine.width;
    if (mine.rows > 0) draft.row_gauge = mine.rows;
  }

  // Labels are not sent. They are Knitwit's own invention — private groupings a knitter makes up
  // ("for Mum", "stash-bust") — and Ravelry's tags are public. Publishing one as the other on the
  // knitter's behalf is not a mapping, it is a decision that is not ours to make.

  // Nor are photos. A project's photo may be a Ravelry URL we imported in the first place, or a
  // local file, and uploading images is a separate endpoint and a separate conversation.

  return draft;
}
