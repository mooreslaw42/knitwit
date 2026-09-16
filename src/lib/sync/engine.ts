import AsyncStorage from '@react-native-async-storage/async-storage';

import { currentUserId, ensureSession } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';
import { clear, mark, pending, type Pending } from '@/lib/sync/outbox';

// Pushing what changed here, and pulling what changed elsewhere.
//
// M2 of docs/plans/multi-user.md. Generic over any table shaped `(user_id, id, data, updated_at,
// deleted_at)`, which is every table M1 created — so registering a second entity is a few lines,
// not a second engine.
//
// ## Who wins
//
// The outbox is the record of local intent, and that is what decides it: a row waiting to be sent
// is newer than anything the server has, because the server has not heard about it yet. A row not
// waiting to be sent is whatever the server says.
//
// That is last-write-wins, ordered by who pushes last rather than by any clock — which is on
// purpose. Comparing timestamps across devices means trusting their clocks, and a device with a
// wrong one wins every argument it should lose. Push order is a fact; wall time is a claim.
//
// The case this resolves bluntly: edit the same yarn on two devices while both are offline, and the
// one that reconnects last wins outright. For a yarn that is right — someone corrected the meterage
// twice and the later correction stands. For anything that accumulates it would be wrong, which is
// why nothing that accumulates is in M2.
//
// ## The watermark is the server's, never ours
//
// A pull asks for everything changed since the newest `updated_at` it has already seen, and that
// value comes from the rows themselves. Using the device clock would re-pull the world after a
// clock change, or worse, skip rows written while it was fast.

const WATERMARK_KEY = 'knitwit-sync-watermark';

// Far enough back to mean "everything". A first sync has nothing to be incremental about.
const EPOCH = '1970-01-01T00:00:00.000Z';

export type Row = {
  id: string;
  data: Record<string, unknown>;
  updated_at: string;
  deleted_at: string | null;
  // Whatever a table keeps outside the payload — a parent id, an ordering — see `columns` below.
  [column: string]: unknown;
};

// What a table needs to tell the engine about itself. Everything else is the same for all of them.
export type Entity<T> = {
  table: string;
  // Everything of this kind the device currently holds.
  local: () => Record<string, T>;
  // Replace the whole collection. Called once per pull with the merged result, so a pull is one
  // render rather than one per row.
  replace: (next: Record<string, T>) => void;
  // The payload that goes in `data`. Kept separate from the local shape so a field that is purely
  // local — a cache, a draft — can be left behind rather than travelling.
  toRow: (value: T) => Record<string, unknown>;
  // The whole row, so a binding can read columns that live outside `data`.
  fromRow: (data: Record<string, unknown>, row: Row) => T;
  // Real columns rather than payload, for the few things the database itself has to reason about:
  // which project a section belongs to, and what order the sections go in. A foreign key cannot
  // point into JSONB, and neither can an index worth having.
  columns?: (value: T) => Record<string, unknown>;
  // Those same column names, so a pull asks for them.
  extraSelect?: string;
  // Columns for a tombstone, where the value itself is already gone.
  tombstoneColumns?: (id: string) => Record<string, unknown>;
  // How to combine a row that arrived with the copy already here, when there is one.
  //
  // Absent means take what arrived, which is right for anything describing a thing: someone
  // renamed a yarn, the rename stands. It is wrong for anything that counts, where the arriving
  // row and the local one are both partly true — see mergeMonotonic.
  merge?: (local: T | undefined, incoming: T) => T;
};

type Watermarks = Record<string, string>;

let watermarks: Watermarks | null = null;

async function loadWatermarks(): Promise<Watermarks> {
  if (watermarks) return watermarks;
  try {
    const raw = await AsyncStorage.getItem(WATERMARK_KEY);
    watermarks = raw ? (JSON.parse(raw) as Watermarks) : {};
  } catch {
    watermarks = {};
  }
  return watermarks;
}

async function setWatermark(table: string, value: string): Promise<void> {
  const all = await loadWatermarks();
  all[table] = value;
  try {
    await AsyncStorage.setItem(WATERMARK_KEY, JSON.stringify(all));
  } catch {
    // Losing a watermark costs a full re-pull next time, which is slow and harmless.
  }
}

export type SyncResult = { pushed: number; pulled: number; skipped?: string };

// True while a pull is writing rows into the store.
//
// Without this the whole thing oscillates. A pull replaces the collection, which trips the watcher,
// which marks the freshly-arrived rows as local changes, which pushes them straight back — bumping
// `updated_at`, which the other device then pulls, marks, and pushes back in turn. Two devices
// would trade the same yarn between them for ever, each pass costing a request and neither ever
// converging, because the content never has to differ for the loop to continue.
//
// A flag rather than a content comparison: comparing would have to deep-equal every row on every
// pull, and would still be wrong for a row that genuinely changed on both sides.
let applyingRemote = false;

export function isApplyingRemote(): boolean {
  return applyingRemote;
}

// One round for one entity: send what is waiting, then take what has arrived.
//
// Push first, deliberately. Pulling first would hand the local copy the server's older version of a
// row this device has already changed, and the outbox check would have to defend against it. Empty
// the outbox and the question does not arise.
export async function syncEntity<T>(entity: Entity<T>): Promise<SyncResult> {
  const session = await ensureSession();
  const userId = currentUserId();
  if (!session || !userId) return { pushed: 0, pulled: 0, skipped: 'no session' };

  const supabase = getSupabase();
  const pushed = await push(entity, userId, supabase);
  const pulled = await pull(entity, supabase);
  return { pushed, pulled };
}

async function push<T>(
  entity: Entity<T>,
  userId: string,
  supabase: ReturnType<typeof getSupabase>,
): Promise<number> {
  const waiting = await pending(entity.table);
  if (waiting.length === 0) return 0;

  const local = entity.local();
  const upserts: Record<string, unknown>[] = [];
  const sent: Pending[] = [];

  for (const item of waiting) {
    if (item.kind === 'delete') {
      // A tombstone, not a delete. A row removed outright is indistinguishable from one the other
      // device has not seen yet, so it would come straight back on the next pull.
      //
      // `tombstoneColumns` fills whatever the table insists on. A section's parent id is NOT NULL,
      // and the row being deleted is exactly the one whose parent can no longer be looked up, so
      // the value has to come from somewhere that still remembers it.
      upserts.push({
        user_id: userId,
        id: item.id,
        data: {},
        deleted_at: new Date().toISOString(),
        ...(entity.tombstoneColumns ? entity.tombstoneColumns(item.id) : {}),
      });
      sent.push(item);
      continue;
    }

    const value = local[item.id];
    if (!value) {
      // Marked, then deleted through a path that did not mark the delete. Treat the absence as the
      // truth rather than pushing nothing and leaving the entry to retry for ever.
      upserts.push({
        user_id: userId,
        id: item.id,
        data: {},
        deleted_at: new Date().toISOString(),
        ...(entity.tombstoneColumns ? entity.tombstoneColumns(item.id) : {}),
      });
      sent.push(item);
      continue;
    }

    // `updated_at` is never sent: the database sets it on insert and update, so whatever this
    // device believes the time to be does not enter into it.
    upserts.push({
      user_id: userId,
      id: item.id,
      data: entity.toRow(value),
      deleted_at: null,
      ...(entity.columns ? entity.columns(value) : {}),
    });
    sent.push(item);
  }

  const { error } = await supabase.from(entity.table).upsert(upserts, { onConflict: 'user_id,id' });
  if (error) {
    // Left in the outbox on purpose. Offline, a dropped connection, a server having a bad minute —
    // all of them mean try again later, and nothing has been lost as long as the marks survive.
    console.warn(`sync: could not push ${entity.table}`, error.message);
    return 0;
  }

  await clear(sent);
  return sent.length;
}

async function pull<T>(
  entity: Entity<T>,
  supabase: ReturnType<typeof getSupabase>,
): Promise<number> {
  const since = (await loadWatermarks())[entity.table] ?? EPOCH;

  const { data, error } = await supabase
    .from(entity.table)
    .select(`id, data, updated_at, deleted_at${entity.extraSelect ? `, ${entity.extraSelect}` : ''}`)
    .gt('updated_at', since)
    .order('updated_at', { ascending: true });

  if (error) {
    console.warn(`sync: could not pull ${entity.table}`, error.message);
    return 0;
  }

  const rows = (data ?? []) as unknown as Row[];
  if (rows.length === 0) return 0;

  // Anything still waiting to be sent is this device's business and must not be overwritten by the
  // server's older copy of it.
  const dirty = new Set((await pending(entity.table)).map((p) => p.id));

  const next = { ...entity.local() };
  let applied = 0;

  for (const row of rows) {
    if (dirty.has(row.id)) continue;
    if (row.deleted_at) {
      delete next[row.id];
    } else {
      const incoming = entity.fromRow(row.data ?? {}, row);
      next[row.id] = entity.merge ? entity.merge(next[row.id], incoming) : incoming;
    }
    applied++;
  }

  if (applied > 0) {
    applyingRemote = true;
    try {
      entity.replace(next);
    } finally {
      // Synchronous: zustand notifies subscribers inside setState, so the flag is still up when the
      // watcher runs and down again before anything else can write.
      applyingRemote = false;
    }
  }

  // The newest timestamp actually seen, not the current time. Rows sharing that exact timestamp may
  // be pulled again next round, which is harmless — applying the same row twice is the same row.
  await setWatermark(entity.table, rows[rows.length - 1].updated_at);
  return applied;
}

// Marks everything this device holds as needing to be sent.
//
// The first sync after an account appears: nothing has ever been pushed, so all of it has. Also the
// repair for a device whose outbox was lost, since an upsert of something the server already has is
// the same row again.
export async function markAllDirty<T>(entity: Entity<T>): Promise<number> {
  const ids = Object.keys(entity.local());
  for (const id of ids) await mark(entity.table, id, 'upsert');
  return ids.length;
}

export function resetWatermarkCache(): void {
  watermarks = null;
}
