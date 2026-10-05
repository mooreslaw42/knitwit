import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  backoffFor,
  clear,
  count,
  currentOutboxOwner,
  due,
  mark,
  pending,
  recordFailure,
  resetOutboxCache,
  setOutboxOwner,
} from '@/lib/sync/outbox';

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
    expect(await pending('materials')).toEqual([{ table: 'materials', id: 'm1', kind: 'upsert', attempts: 0 }]);
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
    expect(await pending('materials')).toEqual([
      { table: 'materials', id: 'm1', kind: 'delete', attempts: 0 },
    ]);
  });

  it('does not let a later edit downgrade a delete', async () => {
    await mark('materials', 'm1', 'delete');
    await mark('materials', 'm1', 'upsert');
    expect(await pending('materials')).toEqual([{ table: 'materials', id: 'm1', kind: 'delete', attempts: 0 }]);
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
    await clear([{ table: 'materials', id: 'm1', kind: 'upsert', attempts: 0 }]);
    expect(await pending('materials')).toEqual([
      { table: 'materials', id: 'm2', kind: 'upsert', attempts: 0 },
    ]);
  });

  // The race that loses work: a yarn is pushed, the knitter edits it while the request is in
  // flight, and the response clears the mark for the edit nobody has sent.
  it('keeps a mark that changed while the push was in flight', async () => {
    await mark('materials', 'm1', 'upsert');
    // …pushed as an upsert, and meanwhile:
    await mark('materials', 'm1', 'delete');
    await clear([{ table: 'materials', id: 'm1', kind: 'upsert', attempts: 0 }]);
    expect(await pending('materials')).toEqual([{ table: 'materials', id: 'm1', kind: 'delete', attempts: 0 }]);
  });

  it('shrugs off clearing something that was never there', async () => {
    await clear([{ table: 'materials', id: 'ghost', kind: 'upsert', attempts: 0 }]);
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
    await AsyncStorage.setItem('knitwit-outbox:__unclaimed', 'not json');
    resetOutboxCache();
    expect(await count()).toBe(0);
  });
});

// One device can hold two accounts over its life: an anonymous one to begin with, a real one after
// signing in. What one has not yet sent is not the other's to send — otherwise the first account's
// unsent changes get pushed up as though the second had made them.
describe('whose outbox it is', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    resetOutboxCache();
  });

  it('keeps two accounts apart', async () => {
    await setOutboxOwner('alice');
    await mark('materials', 'alice-yarn');

    await setOutboxOwner('bob');
    expect(await pending('materials')).toEqual([]);
    await mark('materials', 'bob-yarn');

    await setOutboxOwner('alice');
    expect(await pending('materials')).toEqual([
      { table: 'materials', id: 'alice-yarn', kind: 'upsert', attempts: 0 },
    ]);
  });

  // The watcher starts with the app, so an edit can land before the session resolves — certainly on
  // a first launch with no signal. Those marks are real.
  it('gives work done before signing in to the first account that appears', async () => {
    await mark('materials', 'made-offline');
    expect(currentOutboxOwner()).toBe('__unclaimed');

    await setOutboxOwner('alice');

    expect(await pending('materials')).toEqual([
      { table: 'materials', id: 'made-offline', kind: 'upsert', attempts: 0 },
    ]);
  });

  it('does not hand the same unclaimed work to a second account as well', async () => {
    await mark('materials', 'made-offline');
    await setOutboxOwner('alice');
    await setOutboxOwner('bob');

    expect(await pending('materials')).toEqual([]);
  });

  // Adoption is only ever from the unclaimed bucket. An account's own unsent changes stay its own.
  it('never hands one account’s unsent work to another', async () => {
    await setOutboxOwner('alice');
    await mark('materials', 'alice-yarn');
    await setOutboxOwner('bob');

    expect(await pending('materials')).toEqual([]);
  });

  it('merges adopted work with what the account already had waiting', async () => {
    await setOutboxOwner('alice');
    await mark('materials', 'alice-yarn');

    // Signed out, edited, signed back in.
    await setOutboxOwner(null);
    await mark('materials', 'made-while-out');
    await setOutboxOwner('alice');

    const ids = (await pending('materials')).map((p) => p.id).sort();
    expect(ids).toEqual(['alice-yarn', 'made-while-out']);
  });

  // Whatever a knitter had changed but not yet sent at the moment the split shipped lives under the
  // old unsuffixed key. There was only one account on this device when it was written, so it belongs
  // to whoever signs in — dropping it would lose those changes silently.
  it('takes over marks written before the outbox was split', async () => {
    await AsyncStorage.setItem(
      'knitwit-outbox',
      JSON.stringify({ 'materials/from-before': 'upsert' }),
    );
    resetOutboxCache();

    await setOutboxOwner('alice');

    expect(await pending('materials')).toEqual([
      { table: 'materials', id: 'from-before', kind: 'upsert', attempts: 0 },
    ]);
    // Taken once, not handed to the next account too.
    expect(await AsyncStorage.getItem('knitwit-outbox')).toBeNull();
  });

  it('shrugs off being pointed at the account it is already on', async () => {
    await setOutboxOwner('alice');
    await mark('materials', 'alice-yarn');
    await setOutboxOwner('alice');
    expect(await pending('materials')).toHaveLength(1);
  });
});

// A push sends every waiting row of a table in one batch, so a row the server will never accept
// fails the batch it is in — every time, taking every other change to that table with it. Nothing
// was lost and nothing got through: the queue simply stopped, silently.
describe('an entry that keeps failing', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    resetOutboxCache();
  });

  it('waits longer after each failure, up to a ceiling', () => {
    expect(backoffFor(1)).toBe(60_000);
    expect(backoffFor(2)).toBe(120_000);
    expect(backoffFor(3)).toBe(240_000);
    // However many times it has failed, it is still retried twice an hour.
    expect(backoffFor(99)).toBe(30 * 60_000);
  });

  it('is held back from the next push, and comes due later', async () => {
    const now = 1_000_000;
    await mark('materials', 'm1');
    await recordFailure([{ table: 'materials', id: 'm1', kind: 'upsert', attempts: 0 }], now);

    expect(await due('materials', now + 1_000)).toEqual([]);
    expect(await due('materials', now + 61_000)).toEqual([
      { table: 'materials', id: 'm1', kind: 'upsert', attempts: 1 },
    ]);
  });

  // The regression this split exists to prevent. Pull asks `pending` to find out which local rows
  // are unsent so the server's older copy cannot overwrite them — and a row waiting out a backoff
  // is precisely a row whose local copy is newer. Hidden there, the knitter's unsent edit would be
  // overwritten by the very sync that was meant to protect it.
  it('is still owed to the server while it waits', async () => {
    const now = 1_000_000;
    await mark('materials', 'm1');
    await recordFailure([{ table: 'materials', id: 'm1', kind: 'upsert', attempts: 0 }], now);

    expect(await count()).toBe(1);
    expect(await pending('materials')).toEqual([
      { table: 'materials', id: 'm1', kind: 'upsert', attempts: 1 },
    ]);
  });

  it('counts failures up, so the engine can eventually send it alone', async () => {
    const now = 0;
    await mark('materials', 'm1');
    for (let i = 0; i < 3; i++) {
      const [entry] = await due('materials', now + i * 10 * 60_000);
      await recordFailure([entry], now + i * 10 * 60_000);
    }
    const [entry] = await pending('materials');
    expect(entry.attempts).toBe(3);
  });

  // The knitter edited it again, so whatever the server objected to may well be gone.
  it('starts over when the row is changed again', async () => {
    const now = 1_000_000;
    await mark('materials', 'm1');
    await recordFailure([{ table: 'materials', id: 'm1', kind: 'upsert', attempts: 0 }], now);
    await mark('materials', 'm1');

    expect(await due('materials', now)).toEqual([
      { table: 'materials', id: 'm1', kind: 'upsert', attempts: 0 },
    ]);
  });

  it('ignores a failure for something already sent or since changed', async () => {
    const now = 1_000_000;
    await mark('materials', 'm1', 'delete');
    // The push that failed thought it was an upsert; the outbox has since recorded a delete.
    await recordFailure([{ table: 'materials', id: 'm1', kind: 'upsert', attempts: 0 }], now);

    expect(await due('materials', now)).toEqual([
      { table: 'materials', id: 'm1', kind: 'delete', attempts: 0 },
    ]);
  });
});
