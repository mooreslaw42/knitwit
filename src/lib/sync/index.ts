import AsyncStorage from '@react-native-async-storage/async-storage';

import { currentUserId, ensureSession } from '@/lib/session';
import { syncMaterials, uploadAllMaterials, watchMaterials } from '@/lib/sync/materials';

// Starting and pacing the sync.
//
// M2 of docs/plans/multi-user.md, wired for materials only. Everything here is background work: it
// is started once, never awaited, and every failure is a warning. Knitwit works with no network and
// that does not change.

// Which accounts have had their existing device data queued for upload. Keyed by user id, because
// signing into a different account on the same device must not skip its own first upload.
const SEEDED_KEY = 'knitwit-sync-seeded';

// Long enough that a knitter editing a yarn does not fire a request per keystroke; short enough
// that closing the laptop a few seconds later has still sent it.
const DEBOUNCE_MS = 1_500;

let started = false;
let timer: ReturnType<typeof setTimeout> | null = null;

async function alreadySeeded(userId: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(SEEDED_KEY);
    return Boolean(raw && (JSON.parse(raw) as Record<string, boolean>)[userId]);
  } catch {
    return false;
  }
}

async function markSeeded(userId: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(SEEDED_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    all[userId] = true;
    await AsyncStorage.setItem(SEEDED_KEY, JSON.stringify(all));
  } catch {
    // Worst case it seeds twice, which queues rows the server already has. An upsert of the same
    // row is the same row.
  }
}

export function scheduleSync(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void runSync();
  }, DEBOUNCE_MS);
}

export async function runSync(): Promise<void> {
  try {
    const result = await syncMaterials();
    if (result.pushed || result.pulled) {
      console.log(`sync: materials +${result.pushed} sent, ${result.pulled} received`);
    }
  } catch (error) {
    // Never rethrow. This runs unattended and an unhandled rejection here would surface as a crash
    // in an app that is otherwise working perfectly well offline.
    console.warn('sync failed', error);
  }
}

// Called once at launch. Returns a teardown for the store subscription.
export function startSync(): () => void {
  if (started) return () => {};
  started = true;

  const unwatch = watchMaterials(scheduleSync);

  void (async () => {
    const session = await ensureSession();
    const userId = currentUserId();
    if (!session || !userId) return;

    // The first time an account exists, everything already on the device is queued. Without this
    // the stash a knitter built up before accounts existed would sit there for ever, since only
    // *changes* are marked and none of it is about to change.
    if (!(await alreadySeeded(userId))) {
      const queued = await uploadAllMaterials();
      await markSeeded(userId);
      if (queued) console.log(`sync: queueing ${queued} existing materials for first upload`);
    }

    await runSync();
  })();

  return () => {
    unwatch();
    if (timer) clearTimeout(timer);
    started = false;
  };
}
