import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  backupFilename,
  buildBackup,
  readBackup,
  restoreMessage,
  STORE_KEY,
  writeBackup,
} from '@/lib/backup';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// This is the only copy of a knitter's work that survives clearing site data, so the file has to
// round-trip exactly and a bad file has to be refused rather than half-applied.

const STORE = JSON.stringify({
  state: { projects: { p1: { name: 'Meadow Cardigan' } }, patterns: {} },
  version: 24,
});

describe('backing the store up to a file', () => {
  beforeEach(() => AsyncStorage.clear());

  it('names the file by the day it was made', () => {
    expect(backupFilename(new Date('2026-09-15T11:00:00Z'))).toBe('knitwit-backup-2026-09-15.json');
  });

  it('carries the store through verbatim', async () => {
    await AsyncStorage.setItem(STORE_KEY, STORE);
    const text = await buildBackup(new Date('2026-09-15T11:00:00Z'));
    const file = JSON.parse(text!);

    expect(file.kind).toBe('knitwit-backup');
    expect(file.exportedAt).toBe('2026-09-15T11:00:00.000Z');
    // Verbatim matters: restoring is a write, not a translation, so the store's own hydration can
    // do the repairs it already knows how to do.
    expect(JSON.stringify(file.store)).toBe(STORE);
  });

  it('says there is nothing to back up rather than writing an empty file', async () => {
    expect(await buildBackup()).toBeNull();
  });

  it('round-trips: what is exported restores to exactly what was there', async () => {
    await AsyncStorage.setItem(STORE_KEY, STORE);
    const text = await buildBackup();

    await AsyncStorage.setItem(STORE_KEY, JSON.stringify({ state: { projects: {} }, version: 24 }));
    const result = readBackup(text!);
    if ('status' in result) throw new Error('should have read the backup');
    await writeBackup(result.store);

    expect(await AsyncStorage.getItem(STORE_KEY)).toBe(STORE);
  });
});

describe('refusing a file that is not a backup', () => {
  it('turns down something that is not JSON at all', () => {
    expect(readBackup('a pattern, probably')).toEqual({ status: 'not-a-backup' });
  });

  // The likeliest mistake: picking some other JSON off the disk.
  it('turns down JSON that was never a Knitwit backup', () => {
    expect(readBackup('{"projects":{"p1":{}}}')).toEqual({ status: 'not-a-backup' });
    expect(readBackup('[]')).toEqual({ status: 'not-a-backup' });
  });

  // Ours, but with nothing in it — worth telling apart from somebody else's JSON, because the
  // knitter's next move is different: find a better backup, not find a different file.
  it('calls a backup with no state empty rather than foreign', () => {
    const empty = JSON.stringify({ kind: 'knitwit-backup', fileVersion: 1, store: { version: 24 } });
    expect(readBackup(empty)).toEqual({ status: 'empty' });
  });

  // An older file should be repaired by the store's own hydration, not rejected for being old.
  it('accepts a backup from an older store version', () => {
    const old = JSON.stringify({
      kind: 'knitwit-backup',
      fileVersion: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      store: { state: { projects: {} }, version: 3 },
    });
    const result = readBackup(old);
    expect('status' in result).toBe(false);
  });

  it('explains each refusal in words a knitter can act on', () => {
    expect(restoreMessage({ status: 'not-a-backup' })).toMatch(/knitwit-backup/);
    expect(restoreMessage({ status: 'empty' })).toMatch(/nothing in it/);
  });
});
