import AsyncStorage from '@react-native-async-storage/async-storage';

// Getting a knitter's data out of the one browser that holds it.
//
// Everything Knitwit knows lives in a single persisted blob on the device: projects, patterns,
// stash, row counts, awards. There are no accounts, so there is exactly one copy. Clearing site
// data, a new laptop, or a browser deciding to reclaim storage all end the same way, and until now
// there was no way back from any of them.
//
// A file, deliberately, rather than a sync. It needs no account, no server and no trust, it can be
// kept anywhere, and it is the only backup that still works when the thing that failed is us.

export const STORE_KEY = 'knitwit-store';

// Stamped into the file so a restore can tell a Knitwit backup from any other JSON, and so a later
// version can recognise an older file rather than guessing at its shape.
const FILE_KIND = 'knitwit-backup';
const FILE_VERSION = 1;

export type BackupFile = {
  kind: typeof FILE_KIND;
  fileVersion: number;
  exportedAt: string;
  // The persisted store exactly as it sits on the device — `{ state, version }`. Kept verbatim
  // rather than re-shaped, so restoring is a write rather than a translation, and so the store's
  // own `merge` does the repairs it already knows how to do.
  store: unknown;
};

export type RestoreResult =
  | { status: 'restored'; exportedAt: string }
  | { status: 'not-a-backup' }
  | { status: 'empty' };

export function backupFilename(now = new Date()): string {
  return `knitwit-backup-${now.toISOString().slice(0, 10)}.json`;
}

// The whole store, as the text of a backup file.
export async function buildBackup(now = new Date()): Promise<string | null> {
  const raw = await AsyncStorage.getItem(STORE_KEY);
  if (!raw) return null;
  const file: BackupFile = {
    kind: FILE_KIND,
    fileVersion: FILE_VERSION,
    exportedAt: now.toISOString(),
    store: JSON.parse(raw),
  };
  return JSON.stringify(file);
}

// Reads a backup file and hands back what to write, or why it will not.
//
// Validation is deliberately shallow: enough to be sure this is a Knitwit backup and not some other
// JSON a knitter picked by mistake, and no more. The store's own hydration repairs shape, so a file
// from an older version should be let through to be repaired rather than rejected for being old.
export function readBackup(text: string): { store: string; exportedAt: string } | RestoreResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { status: 'not-a-backup' };
  }

  const file = parsed as Partial<BackupFile>;
  if (!file || typeof file !== 'object' || file.kind !== FILE_KIND || !file.store) {
    return { status: 'not-a-backup' };
  }

  const store = file.store as { state?: unknown };
  if (!store.state || typeof store.state !== 'object') return { status: 'empty' };

  return {
    store: JSON.stringify(file.store),
    exportedAt: typeof file.exportedAt === 'string' ? file.exportedAt : '',
  };
}

// Writes a validated backup over the live store.
//
// Nothing is merged. A restore means "make this device look like that file", and half of one
// knitter's stash spliced into another's is not something anyone asked for or could unpick. The
// caller is responsible for making sure this was intended — it replaces everything.
export async function writeBackup(store: string): Promise<void> {
  await AsyncStorage.setItem(STORE_KEY, store);
}

export function restoreMessage(result: RestoreResult): string {
  if (result.status === 'not-a-backup') {
    return "That file isn't a Knitwit backup. Look for one named knitwit-backup-….json";
  }
  if (result.status === 'empty') return 'That backup is empty — there is nothing in it to restore.';
  return '';
}

// ---------------------------------------------------------------------------
// Getting the data out when the app itself is broken.
//
// A backup file is built by parsing the store, which is exactly what cannot be relied on when the
// store is the thing that failed. This reads the bytes and asks no questions: not a restorable
// backup, a rescue copy — something to keep, or to send on, before anyone is tempted to "clear site
// data and try again", which is the one action that turns a bad morning into a lost year of work.

export function rescueFilename(now = new Date()): string {
  return `knitwit-rescue-${now.toISOString().slice(0, 10)}.json`;
}

export async function readRawStore(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORE_KEY);
  } catch {
    return null;
  }
}
