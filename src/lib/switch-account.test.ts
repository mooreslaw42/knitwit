import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearLocalAccountData, describeLocalWork, switchToExistingAccount } from '@/lib/switch-account';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockBuildBackup = jest.fn();
const mockSaveFile = jest.fn();
const mockSignIn = jest.fn();

jest.mock('@/lib/backup', () => ({
  buildBackup: () => mockBuildBackup(),
  backupFilename: () => 'knitwit-backup-2026-09-16.json',
}));
jest.mock('@/lib/save-file', () => ({ saveTextFile: (n: string, t: string) => mockSaveFile(n, t) }));
jest.mock('@/lib/auth', () => ({ signInExisting: (e: string, p: string) => mockSignIn(e, p) }));

describe('naming what is on this device', () => {
  it('lists it the way a person would say it', () => {
    expect(describeLocalWork({ projects: 3, patterns: 2, materials: 7 })).toBe(
      '3 projects, 2 patterns and 7 yarns',
    );
    expect(describeLocalWork({ projects: 1, patterns: 0, materials: 0 })).toBe('1 project');
    expect(describeLocalWork({ projects: 0, patterns: 0, materials: 0 })).toBe('nothing yet');
  });
});

describe('signing into a different account', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockBuildBackup.mockReset();
    mockSaveFile.mockReset();
    mockSignIn.mockReset();
    mockBuildBackup.mockResolvedValue('{"kind":"knitwit-backup"}');
    mockSaveFile.mockResolvedValue(true);
    mockSignIn.mockResolvedValue({ ok: true });

    await AsyncStorage.multiSet([
      ['knitwit-store', '{"state":{}}'],
      ['knitwit-outbox:old-user', '{"materials/m1":"upsert"}'],
      ['knitwit-sync-watermark:old-user', '{"materials":"2026-01-01"}'],
      ['knitwit-photo:photo_1', 'data:image/jpeg;base64,x'],
      ['knitwit-sync-seeded', '{"old-user":3}'],
      ['sb-project-auth-token', 'not ours to touch'],
    ]);
  });

  // A backup that was meant to be taken and was not is worse than none, because the knitter
  // believes they have one.
  it('stops before touching anything if the backup is not saved', async () => {
    mockSaveFile.mockResolvedValue(false);

    expect(await switchToExistingAccount('a@b.c', 'pw', { downloadBackupFirst: true })).toEqual({
      status: 'backup-refused',
    });
    expect(mockSignIn).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem('knitwit-store')).not.toBeNull();
  });

  // Clearing first and then failing leaves a knitter with neither account.
  it('keeps everything when the sign-in fails', async () => {
    mockSignIn.mockResolvedValue({ ok: false, message: 'wrong password' });

    const outcome = await switchToExistingAccount('a@b.c', 'pw', { downloadBackupFirst: true });

    expect(outcome).toEqual({ status: 'failed', message: 'wrong password' });
    expect(await AsyncStorage.getItem('knitwit-store')).not.toBeNull();
  });

  // Leaving it produces a union: one account's projects under another's name, and none of the old
  // ones would ever sync, since the outbox and watermark are keyed per account.
  it('clears this account’s data once the sign-in works', async () => {
    expect(await switchToExistingAccount('a@b.c', 'pw', { downloadBackupFirst: true })).toEqual({
      status: 'switched',
    });

    for (const key of [
      'knitwit-store',
      'knitwit-outbox:old-user',
      'knitwit-sync-watermark:old-user',
      'knitwit-photo:photo_1',
      'knitwit-sync-seeded',
    ]) {
      expect(await AsyncStorage.getItem(key)).toBeNull();
    }
  });

  // supabase-js owns the session; signing in has already replaced it.
  it('leaves the session alone', async () => {
    await clearLocalAccountData();
    expect(await AsyncStorage.getItem('sb-project-auth-token')).toBe('not ours to touch');
  });
});
