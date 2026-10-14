// Turn a Ravelry project into a Knitwit project.
//
// Phase 3 of docs/plans/ravelry-import.md. A project does not stand alone — it points at a pattern
// and at the yarns it was worked in — and those links can only be resolved once the patterns and
// stash are imported too. So this fills every self-contained field and hands the links back as
// Ravelry ids for the orchestration to resolve: `ravelryPatternId` → `patternId`, and each pack's
// `stash_id` → the Material imported from that stash entry. Pure, clock passed in.

import { deriveProjectColors } from '@/lib/knitwit-helpers';
import type { Gauge, Project, ProjectSection, ProjectStatus, TechniqueCraft } from '@/types/knitwit';
import type { RavelryProject } from './types';

export type ImportedProject = {
  project: Project;
  // The pattern this was made from, by Ravelry id — resolved against imported patterns' ravelrySource.
  ravelryPatternId: number | null;
  // The yarns it used. `stashId` (when set) matches an imported Material; `skeins` seeds materialSkeins.
  yarns: { stashId: number | null; yarnId: number | null; skeins: number }[];
};

function mapCraft(name: string | null | undefined): TechniqueCraft {
  return (name ?? '').toLowerCase().includes('crochet') ? 'crochet' : 'knit';
}

// Ravelry's status names onto Knitwit's three. Hibernating and in-progress are both "still on the
// needles" as far as Knitwit is concerned, so they fall through to active.
function mapStatus(name: string | null | undefined): ProjectStatus {
  const n = (name ?? '').toLowerCase();
  if (n.includes('frog')) return 'frogged';
  if (n.includes('finish')) return 'finished';
  return 'active';
}

// "2026/10/01" → "2026-10-01"; anything unexpected → null rather than a bad date.
function toIsoDate(value: string | null | undefined): string | null {
  const match = (value ?? '').match(/^(\d{4})\/(\d{2})\/(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

// How far along, 0–100. A finished project is finished whatever the slider says — plenty of knitters
// never drag it to the end — and anything else falls back to Ravelry's percentage, clamped, or zero.
function percentDone(project: RavelryProject, status: ProjectStatus): number {
  if (status === 'finished') return 100;
  const progress = project.progress;
  if (typeof progress !== 'number' || !Number.isFinite(progress)) return 0;
  return Math.max(0, Math.min(100, Math.round(progress)));
}

function trimZero(n: number): string {
  return String(Number(n));
}

function formatNeedleSizes(project: RavelryProject): string {
  const metrics = (project.needle_sizes ?? [])
    .map((s) => s.metric)
    .filter((m): m is number => m != null);
  if (metrics.length === 0) return '';
  const min = Math.min(...metrics);
  const max = Math.max(...metrics);
  return min === max ? `${trimZero(min)}mm` : `${trimZero(min)}–${trimZero(max)}mm`;
}

function mapGauge(project: RavelryProject): { pattern: Gauge; mine: Gauge } | null {
  if (project.gauge == null || project.gauge_divisor == null) return null;
  const window = project.gauge_divisor;
  const gauge: Gauge = {
    stitches: project.gauge,
    rows: project.row_gauge ?? 0,
    width: window,
    height: window,
    unit: window === 10 ? 'cm' : 'inch',
  };
  // Only the knitter's own gauge is on a project; the pattern's is snapshotted separately when the
  // link is resolved. Until then both sides carry what we know, which is this.
  return { pattern: gauge, mine: gauge };
}

export function ravelryProjectToProject(
  project: RavelryProject,
  importedAt: string,
): ImportedProject {
  const photo = project.photos?.[0];
  const owner = project.user?.username ?? '';
  const status = mapStatus(project.status_name);

  // Ravelry tracks progress as a percentage, not rows, and a metadata-only pattern has no sections
  // to copy — but the app addresses a project through its *current section* (projects.tsx reads
  // sections[current].name), so a project with none crashes the list. An imported one therefore gets
  // one placeholder section that renders and counts until the knitter adds real sections or charts
  // the linked pattern. Deterministic id and timestamp keep the mapper pure.
  //
  // It counts in percent — 100 "rows", one per percentage point — because that is the only progress
  // Ravelry has. A one-row section would have had every unfinished import read "row 0 of 1", which
  // says nothing; this at least carries the knitter's own number across, and the section says so.
  const percent = percentDone(project, status);
  const section: ProjectSection = {
    id: `psec_rav_${project.id}`,
    updatedAt: importedAt,
    name: 'Whole project',
    totalRows: 100,
    row: percent,
    complete: percent >= 100,
    seconds: 0,
    rowNotes: [],
    notes: '',
    materialIds: [],
    toolIds: [],
    techniqueIds: [],
    description:
      'Imported from Ravelry, which tracks a project as a percentage rather than by row — so this ' +
      'section counts to 100. Chart the pattern, or add your own sections, to count real rows.',
    stitchMultiple: null,
    markers: [],
    castOn: 0,
    rows: [],
  };

  return {
    project: {
      name: project.name ?? '',
      startedOn: toIsoDate(project.started),
      finishedOn: toIsoDate(project.completed),
      craft: mapCraft(project.craft_name),
      photo: photo?.medium_url ?? photo?.square_url ?? null,
      // Ravelry has no accent colour for a project, so it lands on Knitwit's neutral pair; the
      // knitter can recolour it.
      ...deriveProjectColors(null),
      // These come from the pattern once the link is resolved; a pattern-less import keeps the
      // neutral defaults rather than guessing.
      category: 'other',
      level: 'intermediate',
      needleSize: formatNeedleSizes(project),
      video: '',
      sourceName: project.personal_source_name ?? '',
      sourceText: '',
      notes: project.notes ?? '',
      labels: project.tag_names ?? [],
      // Resolved by the orchestration from ravelryPatternId below.
      patternId: null,
      sizeIndex: 0,
      status,
      gauge: mapGauge(project),
      sections: [section],
      ravelrySource: {
        id: String(project.id),
        kind: 'project',
        url:
          owner && project.permalink
            ? `https://www.ravelry.com/projects/${owner}/${project.permalink}`
            : '',
        importedAt,
      },
    },
    ravelryPatternId: project.pattern_id ?? null,
    yarns: (project.packs ?? []).map((pack) => ({
      stashId: pack.stash_id ?? null,
      yarnId: pack.yarn_id ?? null,
      skeins: pack.skeins ?? 0,
    })),
  };
}
