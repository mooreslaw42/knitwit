import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

import { currentUserId, ensureSession, onSessionChange } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';
import { markAllDirty, syncEntity } from '@/lib/sync/engine';
import { ENTITIES } from '@/lib/sync/registry';
import { watchAll } from '@/lib/sync/watch';
import { setOutboxOwner } from '@/lib/sync/outbox';
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
// Does this account already hold knitting?
//
// Asked before a first sync decides whether this device is the source of an account or a newcomer
// to one. Returns 'unknown' rather than guessing when the server cannot be reached: the two answers
// are not equally safe, and the wrong one is unrecoverable.
async function accountHasRows(userId: string): Promise<boolean | 'unknown'> {
  const supabase = getSupabase();
  for (const entity of ENTITIES) {
    const { data, error } = await supabase
      .from(entity.table)
      .select('id')
      .eq('user_id', userId)
      // A tombstone still means somebody has used this account, but it is not knitting to be
      // overwritten — and an account emptied on purpose should still accept a fresh upload.
      .is('deleted_at', null)
      .limit(1);
    if (error) return 'unknown';
    if (data && data.length > 0) return true;
  }
  return false;
}

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

  // Coming back to the app is the other moment worth syncing on, and until now nothing did.
  //
  // Sync ran at launch and after a local change, which sounds like enough and is not. A device left
  // open while the knitting happened on another one never hears about it: backgrounding a phone and
  // returning does not restart the JavaScript, and a browser tab left in the background is not
  // reloaded either. It sits there showing a row count that stopped being true hours ago.
  //
  // That is worse than stale, because of what happens next. The first tap on that device marks the
  // section dirty at its own stale number, push runs before pull, and an outbox entry outranks the
  // server — so one tap on a forgotten tab publishes row 31 over the row 35 somebody actually
  // knitted. Catching up on the way in is what stops the catching up from being an overwrite.
  const foreground = AppState.addEventListener('change', (state) => {
    if (state === 'active') scheduleSync();
  });

  // The outbox follows the account, including when it changes under us — a token refresh, a sign-in,
  // a sign-out. What one account has not yet sent is not another's to send.
  const unlisten = onSessionChange((state) => {
    void setOutboxOwner(state.session?.user.id ?? null);
  });

  void (async () => {
    const session = await ensureSession();
    const userId = currentUserId();
    if (!session || !userId) return;

    await setOutboxOwner(userId);

    // The first time an account exists, everything already on the device is queued — but only into
    // an account that has nothing in it yet.
    //
    // The queueing is for the case it was written for: an account appearing underneath work that
    // was already on the device, where only *changes* are marked and none of that stash is about
    // to change, so without this it would sit there for ever.
    //
    // It is exactly wrong for the other case. Signing in on a second device also reaches this line
    // with a device full of records — and there, "everything already on the device" is not the
    // knitter's accumulated work, it is whatever happened to be lying around, usually the seed the
    // app ships with. Queued and pushed, with push running before pull and an outbox entry beating
    // anything the server holds, that seed overwrites the real account. Which is what happened:
    // a phone counted to row 30, a browser signed in, and the server came out holding row 24.
    //
    // So the account is asked first. Rows on the server mean this device is joining something that
    // already exists, and joining means listening.
    if (!(await alreadySeeded(userId))) {
      const established = await accountHasRows(userId);

      // Unreadable — offline, most likely. Neither seeded nor marked as seeded, so the question
      // gets asked again next launch. Guessing "empty" here is the guess that loses data.
      if (established !== 'unknown') {
        let queued = 0;
        if (!established) {
          for (const entity of ENTITIES) queued += await markAllDirty(entity);
          queued += await markAllPhotosForUpload();
        }
        await markSeeded(userId);
        console.log(
          established
            ? 'sync: account already has knitting, pulling rather than pushing this device'
            : `sync: queueing ${queued} existing records for first upload`,
        );
      }
    }

    await runSync();
  })();

  return () => {
    unwatch();
    unlisten();
    foreground.remove();
    if (timer) clearTimeout(timer);
    started = false;
  };
}
