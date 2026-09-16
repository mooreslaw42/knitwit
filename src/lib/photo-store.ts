import AsyncStorage from '@react-native-async-storage/async-storage';

import { entityId } from '@/lib/entity-id';

// Photos, kept beside the store rather than inside it.
//
// Every picture used to sit as a base64 data URL on the record that owned it, which meant it lived
// inside the one JSON blob the whole app persists. Three things follow from that, and all three are
// bad:
//
//   1. **Every write carries every photo.** Tapping the counter re-serialises the knitter's entire
//      stash, pictures included. One photo measured 54KB; a real stash is megabytes moved on every
//      row.
//   2. **The 5MB browser quota arrives fast.** At ~200KB a photo that is roughly two dozen pictures
//      for the whole app, after which writes fail — silently, which is the worst way.
//   3. **It cannot sync.** A Postgres row is the wrong place for image bytes, so multi-user needs
//      them addressable and separately transferable. They go to Supabase Storage keyed by the same
//      id this module hands out, and the record keeps the id either way.
//
// So a record stores an id, and the bytes live under their own key. The id is the thing that
// survives; where the bytes are kept is an implementation detail that is about to change again.

const PHOTO_PREFIX = 'knitwit-photo:';

// A record's `photo` field holds one of three things, and all three have to keep working:
//   - null — no picture
//   - `photo_…` — an id, bytes under PHOTO_PREFIX + id, and eventually in Storage
//   - `data:image/…` — a legacy inline data URL, from before this existed
export function isPhotoId(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith('photo_');
}

export function isInlinePhoto(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith('data:');
}

function keyFor(id: string): string {
  return `${PHOTO_PREFIX}${id}`;
}

// Stores bytes and returns the id to keep on the record.
export async function putPhoto(dataUrl: string): Promise<string> {
  const id = entityId('photo');
  await AsyncStorage.setItem(keyFor(id), dataUrl);
  return id;
}

// Resolves whatever a record is holding into something an <Image> can use.
//
// Returns the value unchanged when it is already a data URL, so a record that has not been migrated
// still renders. There is no version flag deciding which it is: the value says what it is, which
// means a half-finished migration is merely half-finished rather than broken.
export async function getPhoto(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  if (isInlinePhoto(value)) return value;
  if (!isPhotoId(value)) return null;
  try {
    return await AsyncStorage.getItem(keyFor(value));
  } catch {
    return null;
  }
}

// Deleting the record that owns a photo should not leave the bytes behind for ever.
export async function deletePhoto(value: string | null | undefined): Promise<void> {
  if (!value || !isPhotoId(value)) return;
  try {
    await AsyncStorage.removeItem(keyFor(value));
  } catch {
    // A picture that outlives its record wastes space and harms nothing. Failing the delete of the
    // record itself over it would be worse.
  }
}

// Every photo id currently held, for finding orphans and for sizing what a sync would move.
export async function allPhotoIds(): Promise<string[]> {
  const keys = await AsyncStorage.getAllKeys();
  return keys.filter((k) => k.startsWith(PHOTO_PREFIX)).map((k) => k.slice(PHOTO_PREFIX.length));
}

// Bytes that no record points at any more — from a delete that failed, or an interrupted migration.
export async function orphanedPhotoIds(inUse: Iterable<string>): Promise<string[]> {
  const used = new Set(inUse);
  return (await allPhotoIds()).filter((id) => !used.has(id));
}
