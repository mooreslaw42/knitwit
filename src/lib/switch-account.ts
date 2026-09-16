import AsyncStorage from '@react-native-async-storage/async-storage';

import { buildBackup, backupFilename } from '@/lib/backup';
import { saveTextFile } from '@/lib/save-file';
import { signInExisting, type AuthResult } from '@/lib/auth';

// Signing into an account that is not the one on this device.
//
// The awkward case, and the reason it is worth its own file. A device already has an anonymous
// account holding this knitter's work. They sign into an account that *also* has work. Two sets of
// rows, and only one of them can be what the app shows.
//
// ## Why local has to be cleared
//
// Leaving it produces the worst of both: the pull brings the signed-into account's rows in, they
// merge on top of whatever was here, and the result is a union — one account's projects sitting
// under another's name, with no way to tell which is which. Since the outbox and watermark are
// keyed per account, none of the old rows would ever be pushed either; they would simply sit there
// looking real.
//
// So the store is emptied and the new account pulled fresh. That is honest: what you see is the
// account you signed into.
//
// ## Why a backup is offered first
//
// Clearing local is not the same as deleting: the old account's rows are still on the server, under
// an anonymous account with no way back into it. Which means, in practice, gone. A knitter should
// not discover that afterwards, so the file is offered before anything is cleared and the whole
// thing is abandoned if it cannot be written.

// Everything this device keeps that belongs to one account. The session itself is not here —
// supabase-js owns that, and signing in replaces it.
const OWNED_KEYS = ['knitwit-store', 'knitwit-sync-seeded'];
const OWNED_PREFIXES = ['knitwit-photo:', 'knitwit-outbox', 'knitwit-sync-watermark'];

export type SwitchOutcome =
  | { status: 'switched' }
  | { status: 'failed'; message: string }
  | { status: 'backup-refused' };

// What the knitter is about to leave behind, so the warning can name it rather than being vague.
export function describeLocalWork(counts: {
  projects: number;
  patterns: number;
  materials: number;
}): string {
  const parts: string[] = [];
  if (counts.projects) parts.push(`${counts.projects} project${counts.projects === 1 ? '' : 's'}`);
  if (counts.patterns) parts.push(`${counts.patterns} pattern${counts.patterns === 1 ? '' : 's'}`);
  if (counts.materials) parts.push(`${counts.materials} yarn${counts.materials === 1 ? '' : 's'}`);
  if (parts.length === 0) return 'nothing yet';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

export async function switchToExistingAccount(
  email: string,
  password: string,
  options: { downloadBackupFirst: boolean },
): Promise<SwitchOutcome> {
  // Before anything is cleared, and abandoned if it fails. A backup that was meant to be taken and
  // was not is worse than no backup at all, because the knitter believes they have one.
  if (options.downloadBackupFirst) {
    try {
      const text = await buildBackup();
      if (text) {
        const saved = await saveTextFile(backupFilename(), text);
        if (!saved) return { status: 'backup-refused' };
      }
    } catch {
      return { status: 'backup-refused' };
    }
  }

  const result: AuthResult = await signInExisting(email, password);
  if (!result.ok) return { status: 'failed', message: result.message };

  // Only after the sign-in has actually worked. Clearing first and then failing would leave a
  // knitter with neither account.
  await clearLocalAccountData();
  return { status: 'switched' };
}

export async function clearLocalAccountData(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const mine = keys.filter(
      (key) => OWNED_KEYS.includes(key) || OWNED_PREFIXES.some((p) => key.startsWith(p)),
    );
    await AsyncStorage.multiRemove(mine);
  } catch {
    // A device that cannot clear its own storage is one where the next launch shows a mixture.
    // Nothing better to do here than let the caller reload, which is what it does.
  }
}
