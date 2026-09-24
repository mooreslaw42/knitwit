import AsyncStorage from '@react-native-async-storage/async-storage';

// The question this file exists for: on a first sync, is this device the source of an account or a
// newcomer to one? Getting it backwards is not a sync delay, it is data loss — a browser signed in
// holding the shipped seed and pushed row 24 over a phone's row 30, because push runs before pull
// and an outbox entry outranks whatever the server holds.

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockRows = jest.fn();
const mockMarkAllDirty = jest.fn();

jest.mock('@/lib/session', () => ({
  currentUserId: () => 'u1',
  ensureSession: async () => ({ user: { id: 'u1' } }),
  onSessionChange: () => () => {},
}));
jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          is: () => ({ limit: () => mockRows() }),
        }),
      }),
    }),
  }),
}));
jest.mock('@/lib/sync/engine', () => ({
  markAllDirty: (...args: unknown[]) => mockMarkAllDirty(...args),
  syncEntity: async () => ({ pushed: 0, pulled: 0 }),
}));
jest.mock('@/lib/sync/watch', () => ({ watchAll: () => () => {} }));
jest.mock('@/lib/sync/outbox', () => ({ setOutboxOwner: async () => {} }));
jest.mock('@/lib/photo-store', () => ({ onMissingPhoto: () => {}, onPhotoStored: () => {} }));
jest.mock('@/lib/sync/photos', () => ({
  downloadPhoto: async () => {},
  markAllPhotosForUpload: async () => 0,
  markPhotoForUpload: async () => {},
  pushPhotos: async () => 0,
}));

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function start() {
  let stop = () => {};
  await jest.isolateModulesAsync(async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    stop = require('@/lib/sync').startSync();
    await settle();
    await settle();
    await settle();
  });
  return stop;
}

describe('the first sync after signing in', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    mockMarkAllDirty.mockResolvedValue(0);
  });

  // A device joining an account that already has knitting listens. It does not announce.
  it('does not upload this device over an account that already has rows', async () => {
    mockRows.mockResolvedValue({ data: [{ id: 'seed_meadow_s1' }], error: null });
    (await start())();
    expect(mockMarkAllDirty).not.toHaveBeenCalled();
  });

  // The case the queueing was written for: an account appearing under work already on the device.
  it('uploads this device into an account with nothing in it', async () => {
    mockRows.mockResolvedValue({ data: [], error: null });
    (await start())();
    expect(mockMarkAllDirty).toHaveBeenCalled();
  });

  // Offline. The two answers are not equally safe and guessing "empty" is the one that overwrites
  // somebody's knitting, so it asks again next launch instead.
  it('does neither when it cannot tell', async () => {
    mockRows.mockResolvedValue({ data: null, error: { message: 'offline' } });
    (await start())();
    expect(mockMarkAllDirty).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem('knitwit-sync-seeded')).toBeNull();
  });
});
