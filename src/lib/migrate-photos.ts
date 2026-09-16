import { isInlinePhoto, putPhoto } from '@/lib/photo-store';
import { useKnitwitStore } from '@/store/useKnitwitStore';

// Moving photos that were saved before they had anywhere else to go.
//
// Not a store `merge` repair, unlike every other backfill in this app, and the reason matters:
// merge is synchronous and writing bytes is not. So this runs once after hydration instead, and is
// built to be interrupted — a knitter who closes the tab halfway through has some records holding
// ids and some holding data URLs, which is a state the reader already handles. It picks up the rest
// next launch.
//
// Nothing is destroyed on failure. The record is only pointed at the new id *after* the bytes are
// safely written, so the worst interruption leaves an orphaned copy, never a record pointing at
// nothing.

type PhotoOwner = { photo: string | null };

// One pass over everything that can hold a picture. Returns how many moved, for the log.
export async function migratePhotos(): Promise<number> {
  const state = useKnitwitStore.getState();

  const pending: { kind: 'project' | 'pattern' | 'material'; key: string; dataUrl: string }[] = [];
  const collect = (kind: 'project' | 'pattern' | 'material', records: Record<string, PhotoOwner>) => {
    for (const [key, record] of Object.entries(records ?? {})) {
      if (isInlinePhoto(record.photo)) {
        pending.push({ kind, key, dataUrl: record.photo as string });
      }
    }
  };

  collect('project', state.projects);
  collect('pattern', state.patterns);
  collect('material', state.materials);

  if (pending.length === 0) return 0;

  let moved = 0;
  for (const item of pending) {
    let id: string;
    try {
      id = await putPhoto(item.dataUrl);
    } catch {
      // Out of space, most likely — the very problem this exists to fix. Stop rather than thrash;
      // what has already moved has already helped, and the next launch tries again.
      break;
    }

    // Read the store afresh each time. The knitter is using the app while this runs, and writing
    // back a snapshot taken before they renamed a project would undo the rename.
    const store = useKnitwitStore.getState();
    const swap = <T extends PhotoOwner>(records: Record<string, T>): Record<string, T> => {
      const record = records[item.key];
      // Only if it is still the same data URL. If they replaced the picture while this ran, theirs
      // wins and our copy becomes an orphan, which the sweeper can collect later.
      if (!record || record.photo !== item.dataUrl) return records;
      return { ...records, [item.key]: { ...record, photo: id } };
    };

    if (item.kind === 'project') useKnitwitStore.setState({ projects: swap(store.projects) });
    if (item.kind === 'pattern') useKnitwitStore.setState({ patterns: swap(store.patterns) });
    if (item.kind === 'material') useKnitwitStore.setState({ materials: swap(store.materials) });
    moved++;
  }

  return moved;
}
