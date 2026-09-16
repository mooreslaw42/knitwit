import type { Entity } from '@/lib/sync/engine';
import { useKnitwitStore } from '@/store/useKnitwitStore';
import type { PatternSection, ProjectSection } from '@/types/knitwit';

// Sections, which are nested here and flat on the server.
//
// Locally a project owns an array of sections, because that is what a project is and what every
// screen reads. On the server they are their own rows, because that is where the counter writes —
// a knitter taps `+` every few seconds, and if that write carried the whole project then counting
// on a phone and editing the same project's notes on a laptop would be one conflict rather than
// two independent facts.
//
// So this is the seam: flatten on the way out, reassemble on the way in. It exists so that neither
// side has to be wrong about what a section is.
//
// ## Order matters, and it is the caller's job
//
// A section arriving for a project this device has never seen has nowhere to go. The registry syncs
// parents before children for that reason, so by the time sections are processed their project is
// already here. A section whose parent is still missing is kept aside rather than dropped — see
// below — because dropping it would lose it for ever: the watermark moves on regardless.

// One section, plus where it belongs. This is the shape the engine sees.
export type FlatSection<T> = {
  parentId: string;
  position: number;
  section: T;
};

// Which parent each section belonged to, remembered past its deletion.
//
// A tombstone still has to name a parent, because `project_id` is NOT NULL — and by the time a
// section is being deleted it is already gone from the store, so there is nothing left to ask.
// Written on every flatten, which is every push and every pull.
const parentOf = new Map<string, string>();

// Sections whose parent has not arrived yet, kept until it does.
//
// Held in memory rather than persisted: the next pull re-sends nothing, but the parent will be
// local by then and the section arrives with the following change to it. The alternative — dropping
// it — is silent and permanent, which is much worse than being one sync behind.
const orphans = new Map<string, FlatSection<unknown>>();

function flatten<Owner extends { sections: Section[] }, Section extends { id: string }>(
  owners: Record<string, Owner>,
): Record<string, FlatSection<Section>> {
  const out: Record<string, FlatSection<Section>> = {};
  for (const [parentId, owner] of Object.entries(owners)) {
    owner.sections.forEach((section, position) => {
      out[section.id] = { parentId, position, section };
      parentOf.set(section.id, parentId);
    });
  }
  return out;
}

function reassemble<Owner extends { sections: Section[] }, Section extends { id: string }>(
  owners: Record<string, Owner>,
  flat: Record<string, FlatSection<Section>>,
): Record<string, Owner> {
  const grouped = new Map<string, FlatSection<Section>[]>();

  for (const entry of Object.values(flat)) {
    if (!owners[entry.parentId]) {
      // Parent not here yet. Keep it rather than lose it.
      orphans.set(entry.section.id, entry as FlatSection<unknown>);
      continue;
    }
    const list = grouped.get(entry.parentId) ?? [];
    list.push(entry);
    grouped.set(entry.parentId, list);
  }

  // Anything held back whose parent has since arrived can join now.
  for (const [id, held] of [...orphans.entries()]) {
    const entry = held as FlatSection<Section>;
    if (!owners[entry.parentId]) continue;
    const list = grouped.get(entry.parentId) ?? [];
    if (!list.some((existing) => existing.section.id === entry.section.id)) list.push(entry);
    grouped.set(entry.parentId, list);
    orphans.delete(id);
  }

  const next: Record<string, Owner> = { ...owners };
  for (const [parentId, entries] of grouped) {
    next[parentId] = {
      ...owners[parentId],
      // The knitter's order, which travels as a number rather than being inferred from anything.
      sections: entries.sort((a, b) => a.position - b.position).map((e) => e.section),
    };
  }
  return next;
}

// Time spent is the one field on a section that counts rather than describes, so it takes the
// larger of the two instead of whatever arrived. Everything else on a section — its name, its row,
// its chart — is a description of the knitting and the latest word wins.
//
// The row count is deliberately *not* treated this way. Taking the maximum would mean a knitter who
// frogged back to row 10 on their phone had row 40 restored from a stale laptop, which is the exact
// opposite of what they asked for.
function mergeSection<T extends { seconds?: number }>(local: T | undefined, incoming: T): T {
  if (!local) return incoming;
  const seconds = Math.max(local.seconds ?? 0, incoming.seconds ?? 0);
  return { ...incoming, seconds };
}

export const projectSectionsEntity: Entity<FlatSection<ProjectSection>> = {
  table: 'project_sections',
  local: () => flatten(useKnitwitStore.getState().projects),
  replace: (flat) =>
    useKnitwitStore.setState({ projects: reassemble(useKnitwitStore.getState().projects, flat) }),
  toRow: (entry) => ({ ...entry.section }),
  columns: (entry) => ({ project_id: entry.parentId, position: entry.position }),
  tombstoneColumns: (id) => ({ project_id: parentOf.get(id) ?? 'unknown', position: 0 }),
  extraSelect: 'project_id, position',
  fromRow: (data, row) => ({
    parentId: String(row.project_id ?? ''),
    position: Number(row.position ?? 0),
    section: data as unknown as ProjectSection,
  }),
  merge: (local, incoming) =>
    local ? { ...incoming, section: mergeSection(local.section, incoming.section) } : incoming,
};

export const patternSectionsEntity: Entity<FlatSection<PatternSection>> = {
  table: 'pattern_sections',
  local: () => flatten(useKnitwitStore.getState().patterns),
  replace: (flat) =>
    useKnitwitStore.setState({ patterns: reassemble(useKnitwitStore.getState().patterns, flat) }),
  toRow: (entry) => ({ ...entry.section }),
  columns: (entry) => ({ pattern_id: entry.parentId, position: entry.position }),
  tombstoneColumns: (id) => ({ pattern_id: parentOf.get(id) ?? 'unknown', position: 0 }),
  extraSelect: 'pattern_id, position',
  fromRow: (data, row) => ({
    parentId: String(row.pattern_id ?? ''),
    position: Number(row.position ?? 0),
    section: data as unknown as PatternSection,
  }),
};

// Tests only.
export function resetOrphans(): void {
  orphans.clear();
  parentOf.clear();
}
