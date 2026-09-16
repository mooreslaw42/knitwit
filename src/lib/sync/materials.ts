import {
  isApplyingRemote,
  markAllDirty,
  syncEntity,
  type Entity,
  type SyncResult,
} from '@/lib/sync/engine';
import { mark } from '@/lib/sync/outbox';
import { useKnitwitStore } from '@/store/useKnitwitStore';
import type { Material } from '@/types/knitwit';

// Yarn, synced. The first entity to go through the engine, and chosen for being the least
// frightening: a stash is small, flat, and nobody is mid-row in it. Projects and the counter follow
// once the machinery is dull.
//
// The photo travels as the id it already is rather than as bytes — see photo-store.ts. The bytes go
// to Supabase Storage in M4, and because the record holds a reference either way, that change does
// not touch this file.

export const materialsEntity: Entity<Material> = {
  table: 'materials',
  local: () => useKnitwitStore.getState().materials,
  replace: (materials) => useKnitwitStore.setState({ materials }),
  toRow: (material) => ({ ...material }),
  fromRow: (data) => data as unknown as Material,
};

// Watches the store and marks what changed.
//
// Diffing rather than a `markDirty()` call in every mutation, and for the same reason `updatedAt` is
// stamped in one helper: the call site that forgets is invisible. The yarn still saves, still looks
// right, and simply never reaches the server. Comparing references catches every path — including
// ones written later by someone who has never read this file — because the store updates
// immutably, so a changed record is a changed reference.
export function watchMaterials(onChanged: () => void): () => void {
  let previous = useKnitwitStore.getState().materials;

  return useKnitwitStore.subscribe((state) => {
    const current = state.materials;
    if (current === previous) return;

    // Rows this device just received are not this device's news. `previous` is still advanced
    // below, so the next genuine edit diffs against what actually arrived rather than re-marking
    // all of it.
    const remote = isApplyingRemote();

    let changed = false;
    for (const [id, material] of Object.entries(current)) {
      if (previous[id] !== material && !remote) {
        void mark('materials', id, 'upsert');
        changed = true;
      }
    }
    for (const id of Object.keys(previous)) {
      if (!(id in current) && !remote) {
        void mark('materials', id, 'delete');
        changed = true;
      }
    }

    previous = current;
    if (changed) onChanged();
  });
}

export async function syncMaterials(): Promise<SyncResult> {
  return syncEntity(materialsEntity);
}

// Everything on the device, queued to be sent. Used once, when an account first appears and the
// server has never heard of any of it.
export async function uploadAllMaterials(): Promise<number> {
  return markAllDirty(materialsEntity);
}
