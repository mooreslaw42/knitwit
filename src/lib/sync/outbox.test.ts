import AsyncStorage from '@react-native-async-storage/async-storage';

import { clear, count, mark, pending, resetOutboxCache } from '@/lib/sync/outbox';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// The outbox is what makes offline real. Everything here is about the two ways that fails: losing a
// change that was never sent, or re-sending one that was.

describe('marking what changed', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    resetOutboxCache();
  });

  it('remembers a change', async () => {
    await mark('materials', 'm1');
    expect(await pending('materials')).toEqual([{ table: 'materials', id: 'm1', kind: 'upsert' }]);
  });

  // Five edits on a train are one thing to send, not five.
  it('keeps one entry however many times the same thing changes', async () => {
    await mark('materials', 'm1');
    await mark('materials', 'm1');
    await mark('materials', 'm1');
    expect(await count()).toBe(1);
  });

  it('keeps entries for different things apart', async () => {
    await mark('materials', 'm1');
    await mark('tools', 'm1');
    expect(await count()).toBe(2);
    expect(await pending('materials')).toHaveLength(1);
    expect(await pending('tools')).toHaveLength(1);
  });

  // What the server needs to hear about a yarn changed and then deleted is that it is gone.
  it('lets a delete outrank an edit', async () => {
    await mark('materials', 'm1', 'upsert');
    await mark('materials', 'm1', 'delete');
    expect(await pending('materials')).toEqual([{ table: 'materials', id: 'm1', kind: 'delete' }]);
  });

  it('does not let a later edit downgrade a delete', async () => {
    await mark('materials', 'm1', 'delete');
    await mark('materials', 'm1', 'upsert');
    expect(await pending('materials')).toEqual([{ table: 'materials', id: 'm1', kind: 'delete' }]);
  });
});

describe('clearing what was sent', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    resetOutboxCache();
  });

  it('clears only what it is told about', async () => {
    await mark('materials', 'm1');
    await mark('materials', 'm2');
    await clear([{ table: 'materials', id: 'm1', kind: 'upsert' }]);
    expect(await pending('materials')).toEqual([{ table: 'materials', id: 'm2', kind: 'upsert' }]);
  });

  // The race that loses work: a yarn is pushed, the knitter edits it while the request is in
  // flight, and the response clears the mark for the edit nobody has sent.
  it('keeps a mark that changed while the push was in flight', async () => {
    await mark('materials', 'm1', 'upsert');
    // …pushed as an upsert, and meanwhile:
    await mark('materials', 'm1', 'delete');
    await clear([{ table: 'materials', id: 'm1', kind: 'upsert' }]);
    expect(await pending('materials')).toEqual([{ table: 'materials', id: 'm1', kind: 'delete' }]);
  });

  it('shrugs off clearing something that was never there', async () => {
    await clear([{ table: 'materials', id: 'ghost', kind: 'upsert' }]);
    expect(await count()).toBe(0);
  });
});

describe('surviving a reload', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    resetOutboxCache();
  });

  // A closed laptop lid is not a lost row.
  it('still knows what was waiting after the app restarts', async () => {
    await mark('materials', 'm1');
    await mark('materials', 'm2', 'delete');
    // Whatever was in memory is gone; only storage remains.
    resetOutboxCache();

    const waiting = await pending('materials');
    expect(waiting).toHaveLength(2);
    expect(waiting.find((p) => p.id === 'm2')?.kind).toBe('delete');
  });

  it('starts empty rather than failing when storage holds nonsense', async () => {
    await AsyncStorage.setItem('knitwit-outbox', 'not json');
    resetOutboxCache();
    expect(await count()).toBe(0);
  });
});
