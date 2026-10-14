import { invokeEdgeFunction } from '@/lib/edge-function';
import { stamp } from '@/lib/entity-id';
import { useKnitwitStore } from '@/store/useKnitwitStore';

import { applyRavelryImport, type ImportSummary, type ImportTarget, type RavelryImportData } from './import';

// Running an import: ask the server for the whole notebook, then hand it to the store.
//
// The two halves of the pipeline meet here. `ravelry-import`'s `pull` task does everything that has
// to happen server-side — refresh the token, read Ravelry, return the raw payloads — and this builds
// a target over the live store and lets applyRavelryImport map, reconcile and link them. The store's
// own background sync carries the result up; this does not touch the network again.

type PullResponse = { ok?: boolean; connected?: boolean; data?: RavelryImportData };

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

export async function runRavelryImport(): Promise<ImportSummary> {
  const response = (await invokeEdgeFunction(
    'ravelry-import',
    { task: 'pull' },
    {
      // A whole notebook is a lot of Ravelry calls; give it room, but bounded.
      timeoutMs: 120_000,
      timeoutMessage: 'Importing from Ravelry took too long. Try again in a moment.',
    },
  )) as PullResponse;

  const data = response?.data;
  if (!data) throw new Error('Ravelry returned nothing to import.');

  return applyRavelryImport(data, storeTarget, stamp());
}
