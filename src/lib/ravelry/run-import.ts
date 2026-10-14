import { invokeEdgeFunction } from '@/lib/edge-function';
import { stamp } from '@/lib/entity-id';
import { useKnitwitStore } from '@/store/useKnitwitStore';

import {
  applyNeedles,
  applyPatterns,
  applyProjects,
  applyStash,
  type ImportSummary,
  type ImportTarget,
} from './import';
import type { RavelryNeedleRecord, RavelryPattern, RavelryProject, RavelryStash } from './types';

// Running an import, a page at a time.
//
// The server hands back bounded slices rather than the whole notebook, and this walks them: ask,
// apply what came back, ask again while there is more. That is what makes the import survive a real
// account — a knitter with two hundred projects is hundreds of Ravelry requests and megabytes of
// detail, which is far more than one function call should carry. Applying as we go also means a
// failure half way leaves everything before it already saved, and gives the screen a number to show.
//
// Order matters: stash and patterns before projects, because a project's links are resolved by
// finding them already in the store.

type Page<T> = { items?: T[]; ids?: number[]; hasMore?: boolean };

// A notebook far past this is someone to talk to rather than a page to fetch; it only stops a bad
// `hasMore` from looping for ever.
const MAX_PAGES = 400;

// How many pattern ids one request may ask details for; matches what the function will serve.
const PATTERN_BATCH = 50;

// getState() is read fresh on every call, not captured, so each save in the run is visible to the
// reconcile lookups that follow it.
const storeTarget: ImportTarget = {
  getMaterials: () => useKnitwitStore.getState().materials,
  getTools: () => useKnitwitStore.getState().tools,
  getPatterns: () => useKnitwitStore.getState().patterns,
  getProjects: () => useKnitwitStore.getState().projects,
  saveMaterial: (id, data) => useKnitwitStore.getState().saveMaterial(id, data),
  saveTool: (id, data) => useKnitwitStore.getState().saveTool(id, data),
  savePattern: (id, data) => useKnitwitStore.getState().savePattern(id, data),
  saveProject: (id, data) => useKnitwitStore.getState().saveProject(id, data),
};

async function ask<T>(body: Record<string, unknown>): Promise<Page<T>> {
  return (await invokeEdgeFunction('ravelry-import', body, {
    // One page, so this is a generous ceiling rather than a budget for the whole notebook.
    timeoutMs: 60_000,
    timeoutMessage: 'Ravelry took too long to answer. What came across so far is saved — try again.',
  })) as Page<T>;
}

export async function runRavelryImport(
  onProgress?: (soFar: ImportSummary) => void,
): Promise<ImportSummary> {
  const at = stamp();
  const soFar: ImportSummary = { materials: 0, tools: 0, patterns: 0, projects: 0 };
  const report = () => onProgress?.({ ...soFar });

  // Pattern details, fetched once per *run*.
  //
  // Deduping within the run is the point — a pattern thirty projects share should be asked for once,
  // not thirty times. Deduping against the store would be a different thing entirely: it would mean a
  // pattern imported last week never refreshes again, which is not what pressing Import should do.
  const fetched = new Set<number>();
  const fillPatterns = async (ids: number[]): Promise<void> => {
    const want = [...new Set(ids)].filter((id) => !fetched.has(id));
    if (want.length === 0) return;
    for (const id of want) fetched.add(id);
    // Asked for in batches, because one request should stay one bounded piece of work.
    for (let from = 0; from < want.length; from += PATTERN_BATCH) {
      const page = await ask<RavelryPattern>({
        task: 'patterns',
        ids: want.slice(from, from + PATTERN_BATCH),
      });
      soFar.patterns += applyPatterns(page.items ?? [], storeTarget, at);
    }
  };

  // The needle drawer is small enough to come in one piece.
  const needles = await ask<RavelryNeedleRecord>({ task: 'needles' });
  soFar.tools = applyNeedles(needles.items ?? [], storeTarget, at);
  report();

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await ask<RavelryStash>({ task: 'stash', page });
    soFar.materials += applyStash(result.items ?? [], storeTarget, at);
    report();
    if (!result.hasMore) break;
  }

  // Patterns the knitter owns, by id — details only for the ones not already here.
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await ask<never>({ task: 'library', page });
    await fillPatterns(result.ids ?? []);
    report();
    if (!result.hasMore) break;
  }

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await ask<RavelryProject>({ task: 'projects', page });
    const projects = result.items ?? [];
    // The patterns these projects were made from, first, so patternId resolves when they land.
    await fillPatterns(
      projects.map((p) => p.pattern_id).filter((id): id is number => typeof id === 'number'),
    );
    soFar.projects += applyProjects(projects, storeTarget, at);
    report();
    if (!result.hasMore) break;
  }

  return soFar;
}
