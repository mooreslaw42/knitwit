import { isApplyingRemote } from '@/lib/sync/engine';
import { ENTITIES } from '@/lib/sync/registry';
import { mark } from '@/lib/sync/outbox';
import { useKnitwitStore } from '@/store/useKnitwitStore';

// Noticing what changed, for every entity at once.
//
// Diffing the store rather than calling `markDirty()` from each mutation. The call site that
// forgets is invisible — the thing still saves, still looks right, and simply never reaches the
// server — and there are far too many of them to keep honest by hand. Comparing references catches
// every path, including ones written by someone who has never read this file, because the store
// updates immutably: a changed record is a changed reference.

export function watchAll(onChanged: () => void): () => void {
  // What each entity looked like last time, keyed by table.
  const previous = new Map<string, Record<string, unknown>>();
  for (const entity of ENTITIES) {
    previous.set(entity.table, entity.local() as Record<string, unknown>);
  }

  return useKnitwitStore.subscribe(() => {
    // A pull writes into the store too. Marking those rows would push them straight back, bumping
    // their timestamp, which the other device would pull and push back in turn — for ever, because
    // the content never has to differ for the loop to continue.
    const remote = isApplyingRemote();
    let changed = false;

    for (const entity of ENTITIES) {
      const current = entity.local() as Record<string, unknown>;
      const before = previous.get(entity.table) ?? {};

      // `local()` builds a fresh object each call for the flattened entities, so identity is
      // compared per record rather than per collection.
      for (const [id, value] of Object.entries(current)) {
        if (before[id] === value) continue;
        // Deep-equal would be safer and is not worth it: a re-created but identical record costs
        // one redundant upsert, which the server treats as the same row.
        if (!remote) {
          void mark(entity.table, id, 'upsert');
          changed = true;
        }
      }

      for (const id of Object.keys(before)) {
        if (id in current) continue;
        if (!remote) {
          void mark(entity.table, id, 'delete');
          changed = true;
        }
      }

      // Advanced even when the change came from the server, so the next genuine edit is diffed
      // against what actually arrived rather than re-marking all of it.
      previous.set(entity.table, current);
    }

    if (changed) onChanged();
  });
}
