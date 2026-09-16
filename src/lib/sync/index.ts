import AsyncStorage from '@react-native-async-storage/async-storage';

import { currentUserId, ensureSession } from '@/lib/session';
import { markAllDirty, syncEntity } from '@/lib/sync/engine';
import { ENTITIES } from '@/lib/sync/registry';
import { watchAll } from '@/lib/sync/watch';
import { onMissingPhoto, onPhotoStored } from '@/lib/photo-store';
import { downloadPhoto, markAllPhotosForUpload, markPhotoForUpload, pushPhotos } from '@/lib/sync/photos';

// Starting and pacing the sync.
//
// M2-M4 of docs/plans/multi-user.md. Everything here is background work: started once, never
// awaited, and every failure a warning. Knitwit works with no network and that does not change.

// Which accounts have had their existing device data queued for upload, and against which set of
// entities. Keyed by user id, because signing into a different account on the same device must not
// skip its own first upload.
//
// The number matters as much as the key. When sync covered only yarn, every account that ran it was
// marked done — and adding projects would then have uploaded nothing for any of them, for ever,
// because only *changes* are marked and a stash that is not about to change is never marked at all.
// Raise this whenever ENTITIES grows and everyone re-queues once.
const SEEDED_KEY = 'knitwit-sync-seeded';
const SEED_GENERATION = 3;

// Long enough that a knitter editing a yarn does not fire a request per keystroke; short enough
// that closing the laptop a few seconds later has still sent it.
const DEBOUNCE_MS = 1_500;

let started = false;
let timer: ReturnType<typeof setTimeout> | null = null;

async function alreadySeeded(userId: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(SEEDED_KEY);
    if (!raw) return false;
    const all = JSON.parse(raw) as Record<string, number | boolean>;
    const seen = all[userId];
    // `true` is the old shape, written when only yarn synced — which is generation 1.
    const generation = seen === true ? 1 : typeof seen === 'number' ? seen : 0;
    return generation >= SEED_GENERATION;
  } catch {
    return false;
  }
}

async function markSeeded(userId: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(SEEDED_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, number | boolean>) : {};
    all[userId] = SEED_GENERATION;
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
    // One at a time, in registry order. A section's project has to be here before the section is,
    // and running them together would make that a race rather than a rule.
    for (const entity of ENTITIES) {
      const result = await syncEntity(entity);
      if (result.pushed || result.pulled) {
        console.log(`sync: ${entity.table} +${result.pushed} sent, ${result.pulled} received`);
      }
    }

    // Last, and on purpose. A record naming a photo is worth more than the photo: the yarn appears
    // on the other device immediately and the picture fills in behind it, rather than nothing
    // appearing until several megabytes have moved.
    const photos = await pushPhotos();
    if (photos) console.log(`sync: photos +${photos} sent`);
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

  // Photos are not in the store, so the watcher cannot see them. These two hooks are how the byte
  // store and the network find each other without either importing the other.
  onPhotoStored(async (id) => {
    await markPhotoForUpload(id);
    scheduleSync();
  });
  onMissingPhoto(downloadPhoto);

  const unwatch = watchAll(scheduleSync);

  void (async () => {
    const session = await ensureSession();
    const userId = currentUserId();
    if (!session || !userId) return;

    // The first time an account exists, everything already on the device is queued. Without this
    // the stash a knitter built up before accounts existed would sit there for ever, since only
    // *changes* are marked and none of it is about to change.
    if (!(await alreadySeeded(userId))) {
      let queued = 0;
      for (const entity of ENTITIES) queued += await markAllDirty(entity);
      queued += await markAllPhotosForUpload();
      await markSeeded(userId);
      if (queued) console.log(`sync: queueing ${queued} existing records for first upload`);
    }

    await runSync();
  })();

  return () => {
    unwatch();
    if (timer) clearTimeout(timer);
    started = false;
  };
}
