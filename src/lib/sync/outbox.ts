import AsyncStorage from '@react-native-async-storage/async-storage';

// What this device has changed and not yet sent.
//
// M2 of docs/plans/multi-user.md. This is the thing that makes offline real: a write lands in the
// store and in here, and the network is caught up with afterwards. The knitter never waits for a
// request, and a closed laptop lid is not a lost row.
//
// ## A set of names, not a list of operations
//
// It records *which* things changed, never *how* they changed. Edit a yarn five times on a train
// and the outbox still holds one entry; the push reads whatever the store says at the moment it
// runs and sends that. Replaying five versions to arrive at the fifth would be work for the same
// answer, and the intermediate states are nobody's business.
//
// That is the right shape for anything resolved last-write-wins, which is everything M2 covers. It
// is the wrong shape for anything that accumulates — time knitted, rows counted — where "add ten
// minutes" and "the total is ten minutes" are different claims and only the first survives two
// devices. Those need an operation log, and that is a deliberate later problem, written down in the
// plan rather than discovered.
//
// ## Deletes are entries too
//
// A deleted row cannot be read from the store at push time, so the outbox remembers that it was a
// delete. Otherwise a delete made offline would simply be forgotten — the row is gone locally,
// nothing points at it, and the server would send it back on the next pull.

const OUTBOX_KEY = 'knitwit-outbox';

// Where marks go before anybody has signed in.
//
// The watcher starts with the app and an edit can land before the session resolves — certainly so
// on a first launch with no signal. Those marks are real and must not be thrown away, so they wait
// here and are adopted by the first account to appear.
const UNCLAIMED = '__unclaimed';

export type PendingKind = 'upsert' | 'delete';
export type Pending = { table: string; id: string; kind: PendingKind };

// `table/id` — one entry per thing, so marking the same yarn twice leaves one entry.
type Stored = Record<string, PendingKind>;

function keyOf(table: string, id: string): string {
  return `${table}/${id}`;
}

function parse(key: string): { table: string; id: string } {
  const slash = key.indexOf('/');
  return { table: key.slice(0, slash), id: key.slice(slash + 1) };
}

// Whose outbox this is.
//
// One device can hold two accounts over its life — anonymous to begin with, a real one after signing
// in — and what one of them has not yet sent is not the other's to send. Sharing a single outbox
// means the first account's unsent changes get pushed up as though the second had made them, which
// is a merge nobody asked for and nobody can see happening.
let owner: string = UNCLAIMED;

function storageKey(who: string): string {
  return `${OUTBOX_KEY}:${who}`;
}

// Held in memory and written through, because marking happens on every keystroke-ish change and a
// read-modify-write of storage each time would be absurd.
let cache: Stored | null = null;
let writing: Promise<void> = Promise.resolve();

async function load(): Promise<Stored> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(storageKey(owner));
    cache = raw ? (JSON.parse(raw) as Stored) : {};
  } catch {
    // An unreadable outbox is not worth failing over: the cost is re-sending things that were
    // already sent, and every write is an upsert keyed on id, so re-sending is harmless.
    cache = {};
  }
  return cache;
}

// Serialised so two rapid marks cannot interleave and lose one, and awaited by callers so a mark
// is durable before they move on. Fire-and-forget looked fine and was not: a reload in the moment
// between marking a change and the write landing lost the mark, and with it the change — silently,
// because the store still had the edit and only the instruction to send it went missing.
function persist(): Promise<void> {
  writing = writing.then(async () => {
    try {
      await AsyncStorage.setItem(storageKey(owner), JSON.stringify(cache ?? {}));
    } catch {
      // Out of space, most likely. The in-memory copy is still correct, so this session will still
      // sync; only a reload before the next successful write would lose the marks.
    }
  });
  return writing;
}

export async function mark(table: string, id: string, kind: PendingKind = 'upsert'): Promise<void> {
  const current = await load();
  // A delete outranks an edit: if a yarn was changed and then deleted before either was sent, what
  // the server needs to hear is that it is gone.
  if (current[keyOf(table, id)] === 'delete' && kind === 'upsert') return;
  current[keyOf(table, id)] = kind;
  await persist();
}

export async function pending(table?: string): Promise<Pending[]> {
  const current = await load();
  return Object.entries(current)
    .map(([key, kind]) => ({ ...parse(key), kind }))
    .filter((entry) => !table || entry.table === table);
}

// Cleared only for what was actually sent, and only after it was sent. An entry marked again while
// the request was in flight has to survive, or that change is lost — so the caller passes back
// exactly what it pushed rather than asking for a wholesale clear.
export async function clear(sent: Pending[]): Promise<void> {
  const current = await load();
  for (const entry of sent) {
    // Still the same kind? A row marked upsert, pushed, then deleted mid-flight must stay marked.
    if (current[keyOf(entry.table, entry.id)] === entry.kind) {
      delete current[keyOf(entry.table, entry.id)];
    }
  }
  await persist();
}

export async function count(): Promise<number> {
  return Object.keys(await load()).length;
}

// Points the outbox at an account, taking anything marked before there was one.
//
// Adoption is deliberate and only ever happens from the unclaimed bucket: work done on this device
// while signed out belongs to whoever signs in next, because it is *their* device and *their*
// knitting. One account's unsent changes are never handed to another that way — those stay in their
// own bucket, which is the whole point of the split.
export async function setOutboxOwner(userId: string | null): Promise<void> {
  const next = userId ?? UNCLAIMED;
  if (next === owner) return;

  // Whatever is half-written for the current owner lands before the key changes underneath it.
  await writing;

  const adopting =
    owner === UNCLAIMED && next !== UNCLAIMED
      ? { ...(await legacyEntries()), ...(cache ?? (await load())) }
      : null;

  owner = next;
  cache = null;

  if (adopting && Object.keys(adopting).length > 0) {
    const mine = await load();
    for (const [key, kind] of Object.entries(adopting)) {
      // A delete already recorded for this account outranks an inherited edit, same rule as mark().
      if (mine[key] === 'delete' && kind === 'upsert') continue;
      mine[key] = kind;
    }
    await persist();
    try {
      await AsyncStorage.removeItem(storageKey(UNCLAIMED));
    } catch {
      // Left behind it would be adopted again by the next account to sign in on this device.
    }
  }
}

export function currentOutboxOwner(): string {
  return owner;
}

// Marks written before the outbox was split per account.
//
// They live under the old unsuffixed key and belong to whoever is signed in on this device, which is
// the same person who made them — there was only ever one account here when they were written.
// Dropping them instead would silently lose whatever a knitter had changed but not yet sent at the
// moment this shipped.
async function legacyEntries(): Promise<Stored> {
  try {
    const raw = await AsyncStorage.getItem(OUTBOX_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Stored;
    await AsyncStorage.removeItem(OUTBOX_KEY);
    return parsed;
  } catch {
    return {};
  }
}

// Tests only: the cache and the owner are module state and a second test must not inherit the
// first's.
export function resetOutboxCache(): void {
  cache = null;
  owner = UNCLAIMED;
}
