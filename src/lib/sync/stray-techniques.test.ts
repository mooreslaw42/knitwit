import { watchAll } from '@/lib/sync/watch';
import { useKnitwitStore } from '@/store/useKnitwitStore';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@/lib/sync/outbox', () => ({
  mark: jest.fn(async () => {}),
}));

const { mark } = jest.requireMock('@/lib/sync/outbox') as { mark: jest.Mock };

// Clearing the stray technique has to reach the server, or the next pull brings it back and the
// knitter's library grows it again on every device. What makes that work is nothing in the action
// itself: it is the order the sync bootstrap calls it in. The watcher diffs the store against a
// baseline it captures when it starts, so a row removed *before* that is simply a row the watcher
// never knew about — absent from both sides, and never marked for deletion.
//
// This test is that ordering, written down: baseline first, removal second, deletion marked.
describe('clearing the stray technique reaches the server', () => {
  beforeEach(() => {
    mark.mockClear();
    useKnitwitStore.setState({
      techniques: {
        new: { status: 'want', notes: '', addedOn: '2026-09-01' },
        'magic-ring': { status: 'known', notes: '', addedOn: '2026-09-01' },
      },
    });
  });

  it('marks the removal for the server, the way the sync bootstrap orders it', () => {
    // Exactly what startSync does: install the watcher, then clear.
    const unwatch = watchAll(() => {});
    useKnitwitStore.getState().clearStrayTechniques();
    unwatch();

    expect(mark).toHaveBeenCalledWith('techniques', 'new', 'delete');
    // The technique beside it is left alone. Not a count assertion: the watcher's first diff also
    // re-marks the flattened section entities, whose `local()` rebuilds its records each call —
    // known, harmless, and documented where it happens.
    const techniqueCalls = mark.mock.calls.filter(([table]) => table === 'techniques');
    expect(techniqueCalls).toEqual([['techniques', 'new', 'delete']]);
  });

  // The failure this ordering exists to prevent, demonstrated rather than described: clear first
  // and the watcher starts life with the row already gone, so nothing is ever sent and the server
  // keeps it.
  it('would send nothing if it ran before the watcher started', () => {
    useKnitwitStore.getState().clearStrayTechniques();
    const unwatch = watchAll(() => {});
    unwatch();

    expect(mark).not.toHaveBeenCalled();
  });
});
