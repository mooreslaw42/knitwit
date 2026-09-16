import AsyncStorage from '@react-native-async-storage/async-storage';

import { isApplyingRemote, markAllDirty, resetWatermarkCache, syncEntity, type Entity } from '@/lib/sync/engine';
import { mark, pending, resetOutboxCache } from '@/lib/sync/outbox';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockEnsureSession = jest.fn();
const mockCurrentUserId = jest.fn();
jest.mock('@/lib/session', () => ({
  ensureSession: () => mockEnsureSession(),
  currentUserId: () => mockCurrentUserId(),
}));

const mockUpsert = jest.fn();
const mockSelect = jest.fn();
jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    from: () => ({
      upsert: (rows: unknown[]) => mockUpsert(rows),
      select: () => ({
        gt: () => ({
          order: () => mockSelect(),
        }),
      }),
    }),
  }),
}));

type Yarn = { brand: string };

type Harness = { value: Record<string, Yarn>; seenApplyingRemote?: boolean };

function entityOver(store: Record<string, Yarn>) {
  const state: Harness = { value: store };
  const entity: Entity<Yarn> = {
    table: 'materials',
    local: () => state.value,
    replace: (next) => {
      // What the real binding does, and the moment the echo guard has to be up.
      state.seenApplyingRemote = isApplyingRemote();
      state.value = next;
    },
    toRow: (yarn) => ({ ...yarn }),
    fromRow: (data) => data as unknown as Yarn,
  };
  return { entity, state };
}

const ok = { error: null };
const nothingToPull = { data: [], error: null };

describe('syncing one entity', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    resetOutboxCache();
    resetWatermarkCache();
    mockUpsert.mockReset();
    mockSelect.mockReset();
    mockEnsureSession.mockResolvedValue({ user: { id: 'u1' } });
    mockCurrentUserId.mockReturnValue('u1');
    mockUpsert.mockResolvedValue(ok);
    mockSelect.mockResolvedValue(nothingToPull);
  });

  it('does nothing at all without an account', async () => {
    mockEnsureSession.mockResolvedValue(null);
    mockCurrentUserId.mockReturnValue(null);
    const { entity } = entityOver({ m1: { brand: 'Rowan' } });

    expect(await syncEntity(entity)).toEqual({ pushed: 0, pulled: 0, skipped: 'no session' });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('sends only what is waiting', async () => {
    const { entity } = entityOver({ m1: { brand: 'Rowan' }, m2: { brand: 'DROPS' } });
    await mark('materials', 'm1');

    const result = await syncEntity(entity);

    expect(result.pushed).toBe(1);
    const sent = mockUpsert.mock.calls[0][0] as Record<string, unknown>[];
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ user_id: 'u1', id: 'm1', data: { brand: 'Rowan' } });
  });

  // The database sets it, so a device with a wrong clock cannot win an argument it should lose.
  it('never sends a timestamp', async () => {
    const { entity } = entityOver({ m1: { brand: 'Rowan' } });
    await mark('materials', 'm1');
    await syncEntity(entity);
    expect(mockUpsert.mock.calls[0][0][0]).not.toHaveProperty('updated_at');
  });

  it('sends a delete as a tombstone, not an absence', async () => {
    const { entity } = entityOver({});
    await mark('materials', 'gone', 'delete');

    await syncEntity(entity);

    const sent = mockUpsert.mock.calls[0][0][0] as Record<string, unknown>;
    expect(sent.id).toBe('gone');
    expect(sent.deleted_at).toEqual(expect.any(String));
  });

  // Offline. The change has to still be waiting afterwards or it is simply lost.
  it('keeps the outbox when the push fails', async () => {
    mockUpsert.mockResolvedValue({ error: { message: 'offline' } });
    const { entity } = entityOver({ m1: { brand: 'Rowan' } });
    await mark('materials', 'm1');

    const result = await syncEntity(entity);

    expect(result.pushed).toBe(0);
    expect(await pending('materials')).toHaveLength(1);
  });

  it('clears the outbox once the push lands', async () => {
    const { entity } = entityOver({ m1: { brand: 'Rowan' } });
    await mark('materials', 'm1');
    await syncEntity(entity);
    expect(await pending('materials')).toHaveLength(0);
  });
});

describe('taking what arrived', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    resetOutboxCache();
    resetWatermarkCache();
    mockUpsert.mockReset();
    mockSelect.mockReset();
    mockEnsureSession.mockResolvedValue({ user: { id: 'u1' } });
    mockCurrentUserId.mockReturnValue('u1');
    mockUpsert.mockResolvedValue(ok);
  });

  it('adds a yarn another device made', async () => {
    mockSelect.mockResolvedValue({
      data: [
        { id: 'm9', data: { brand: 'Hobbii' }, updated_at: '2026-09-16T10:00:00Z', deleted_at: null },
      ],
      error: null,
    });
    const { entity, state } = entityOver({});

    const result = await syncEntity(entity);

    expect(result.pulled).toBe(1);
    expect(state.value.m9).toEqual({ brand: 'Hobbii' });
  });

  it('removes a yarn another device deleted', async () => {
    mockSelect.mockResolvedValue({
      data: [{ id: 'm1', data: {}, updated_at: '2026-09-16T10:00:00Z', deleted_at: '2026-09-16T10:00:00Z' }],
      error: null,
    });
    const { entity, state } = entityOver({ m1: { brand: 'Rowan' } });

    await syncEntity(entity);

    expect(state.value.m1).toBeUndefined();
  });

  // The change this device has not managed to send is newer than anything the server knows.
  it('does not overwrite a yarn still waiting to be sent', async () => {
    mockUpsert.mockResolvedValue({ error: { message: 'offline' } });
    mockSelect.mockResolvedValue({
      data: [
        { id: 'm1', data: { brand: 'Stale' }, updated_at: '2026-09-16T10:00:00Z', deleted_at: null },
      ],
      error: null,
    });
    const { entity, state } = entityOver({ m1: { brand: 'Mine, unsent' } });
    await mark('materials', 'm1');

    await syncEntity(entity);

    expect(state.value.m1).toEqual({ brand: 'Mine, unsent' });
  });

  // Without the guard, a pulled row trips the watcher, gets marked as a local change and pushed
  // straight back — bumping updated_at, which the other device pulls and pushes back for ever.
  it('flags that a write came from the server, so the watcher can ignore it', async () => {
    mockSelect.mockResolvedValue({
      data: [{ id: 'm9', data: { brand: 'Hobbii' }, updated_at: '2026-09-16T10:00:00Z', deleted_at: null }],
      error: null,
    });
    const { entity, state } = entityOver({});

    await syncEntity(entity);

    expect(state.seenApplyingRemote).toBe(true);
    // And down again afterwards, or every later local edit would be ignored too.
    expect(isApplyingRemote()).toBe(false);
  });

  it('asks only for what changed after the newest row it has seen', async () => {
    mockSelect.mockResolvedValue({
      data: [
        { id: 'a', data: {}, updated_at: '2026-09-16T10:00:00Z', deleted_at: null },
        { id: 'b', data: {}, updated_at: '2026-09-16T11:00:00Z', deleted_at: null },
      ],
      error: null,
    });
    const { entity } = entityOver({});

    await syncEntity(entity);

    const stored = JSON.parse((await AsyncStorage.getItem('knitwit-sync-watermark')) ?? '{}');
    // The server's newest value, not the device's clock.
    expect(stored.materials).toBe('2026-09-16T11:00:00Z');
  });

  it('leaves the local copy alone when the pull fails', async () => {
    mockSelect.mockResolvedValue({ data: null, error: { message: 'offline' } });
    const { entity, state } = entityOver({ m1: { brand: 'Rowan' } });

    const result = await syncEntity(entity);

    expect(result.pulled).toBe(0);
    expect(state.value.m1).toEqual({ brand: 'Rowan' });
  });
});

describe('the first upload', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    resetOutboxCache();
    resetWatermarkCache();
  });

  // A stash built before accounts existed would otherwise sit there for ever: only changes are
  // marked, and none of it is about to change.
  it('queues everything already on the device', async () => {
    const { entity } = entityOver({ m1: { brand: 'Rowan' }, m2: { brand: 'DROPS' } });
    expect(await markAllDirty(entity)).toBe(2);
    expect(await pending('materials')).toHaveLength(2);
  });
});
