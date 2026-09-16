import { currentUserId, ensureSession } from '@/lib/session';
import { allPhotoIds, cachePhoto, readCachedPhoto } from '@/lib/photo-store';
import { getSupabase } from '@/lib/supabase';
import { clear, mark, pending } from '@/lib/sync/outbox';

// Getting the pictures to the other device.
//
// M4 of docs/plans/multi-user.md. Everything else syncs as rows; photos cannot, because bytes in a
// Postgres row would ride along on every write of the record that owns them. So the row carries the
// id and Storage carries the bytes, keyed `{user_id}/{photo_id}.jpg`.
//
// ## The local copy stays
//
// Storage is where photos are kept; the device keeps a copy anyway. A knitter on a train scrolling
// their stash should see their yarn, and a round trip per thumbnail would be both slow and useless
// without a signal. So the local store is a cache that happens to be written first, and downloading
// only ever fills a gap.
//
// ## The outbox already knew how to do this
//
// Photos go through the same pending-set as rows, under the table name `photos`. It is a set of
// names, which is exactly right here: a picture is written once and never edited, so there is never
// more than one version of it to send.

const BUCKET = 'photos';
const TABLE = 'photos';

function pathFor(userId: string, id: string): string {
  return `${userId}/${id}.jpg`;
}

// Marks a photo as needing to go up. Called when one is taken, and for everything already here the
// first time an account exists.
export async function markPhotoForUpload(id: string): Promise<void> {
  await mark(TABLE, id, 'upsert');
}

export async function markAllPhotosForUpload(): Promise<number> {
  const ids = await allPhotoIds();
  for (const id of ids) await markPhotoForUpload(id);
  return ids.length;
}

// Sends whatever is waiting. Returns how many went.
export async function pushPhotos(): Promise<number> {
  const session = await ensureSession();
  const userId = currentUserId();
  if (!session || !userId) return 0;

  const waiting = await pending(TABLE);
  if (waiting.length === 0) return 0;

  const supabase = getSupabase();
  const sent = [];

  for (const item of waiting) {
    const dataUrl = await readCachedPhoto(item.id);
    if (!dataUrl) {
      // The record that owned it is gone and the bytes with it. Nothing to send and nothing to
      // retry, so stop asking.
      sent.push(item);
      continue;
    }

    const blob = dataUrlToBlob(dataUrl);
    if (!blob) {
      sent.push(item);
      continue;
    }

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(pathFor(userId, item.id), blob, { contentType: 'image/jpeg', upsert: true });

    if (error) {
      // Left waiting. Offline, or a bucket having a bad minute; either way the bytes are still on
      // this device and the next round tries again.
      console.warn('sync: could not upload photo', error.message);
      break;
    }
    sent.push(item);
  }

  if (sent.length > 0) await clear(sent);
  return sent.length;
}

// In flight, so a list of thumbnails asking for the same picture at once fetches it once.
const downloading = new Map<string, Promise<string | null>>();

// Fetches a photo this device does not have. Returns null when there is nothing to fetch — no
// account, no network, or a photo the server has never heard of.
export async function downloadPhoto(id: string): Promise<string | null> {
  const existing = downloading.get(id);
  if (existing) return existing;

  const attempt = (async () => {
    try {
      const session = await ensureSession();
      const userId = currentUserId();
      if (!session || !userId) return null;

      const { data, error } = await getSupabase().storage.from(BUCKET).download(pathFor(userId, id));
      if (error || !data) return null;

      const dataUrl = await blobToDataUrl(data);
      if (dataUrl) await cachePhoto(id, dataUrl);
      return dataUrl;
    } catch {
      return null;
    } finally {
      downloading.delete(id);
    }
  })();

  downloading.set(id, attempt);
  return attempt;
}

export async function deleteRemotePhoto(id: string): Promise<void> {
  const userId = currentUserId();
  if (!userId) return;
  try {
    await getSupabase().storage.from(BUCKET).remove([pathFor(userId, id)]);
  } catch {
    // A picture that outlives its record wastes a little space and harms nothing.
  }
}

// Uploading wants bytes, and what is held is a data URL. Done by hand rather than with fetch(),
// which cannot read a data: URL on every runtime this app runs on.
function dataUrlToBlob(dataUrl: string): Blob | null {
  const comma = dataUrl.indexOf(',');
  if (comma === -1) return null;
  try {
    const binary = atob(dataUrl.slice(comma + 1));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: 'image/jpeg' });
  } catch {
    return null;
  }
}

function blobToDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}
