import AsyncStorage from '@react-native-async-storage/async-storage';

import { cachePhoto, getPhoto, onMissingPhoto, readCachedPhoto } from '@/lib/photo-store';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const JPEG = 'data:image/jpeg;base64,/9j/abc';

// Bytes live in Storage and on the device. Everything here is about the device's copy being a cache
// rather than the truth — so a photo taken on a phone shows on a laptop, and a stash still scrolls
// on a train.
describe('resolving a photo', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    onMissingPhoto(async () => null);
  });

  it('hands back a legacy inline photo untouched', async () => {
    expect(await getPhoto(JPEG)).toBe(JPEG);
  });

  it('reads one this device is holding, without asking the network', async () => {
    const fetcher = jest.fn();
    onMissingPhoto(fetcher);
    await cachePhoto('photo_1', JPEG);

    expect(await getPhoto('photo_1')).toBe(JPEG);
    expect(fetcher).not.toHaveBeenCalled();
  });

  // A yarn added on a phone, opened on a laptop: the id syncs as part of the row, the bytes do not.
  it('fetches one it has never held', async () => {
    const fetcher = jest.fn().mockResolvedValue(JPEG);
    onMissingPhoto(fetcher);

    expect(await getPhoto('photo_missing')).toBe(JPEG);
    expect(fetcher).toHaveBeenCalledWith('photo_missing');
  });

  // Offline, or a photo the server never had. A missing picture is not an error worth breaking a
  // screen over.
  it('shows nothing rather than failing when it cannot be fetched', async () => {
    onMissingPhoto(async () => null);
    expect(await getPhoto('photo_missing')).toBeNull();
  });

  it('ignores anything that is not a photo reference', async () => {
    expect(await getPhoto(null)).toBeNull();
    expect(await getPhoto('')).toBeNull();
    expect(await getPhoto('not-a-photo-id')).toBeNull();
  });

  it('keeps what it fetched, so the next look costs nothing', async () => {
    await cachePhoto('photo_2', JPEG);
    expect(await readCachedPhoto('photo_2')).toBe(JPEG);
  });
});
