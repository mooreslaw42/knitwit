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
export type Pending = { table: string; id: string; kind: PendingKind; attempts: number };

// ## Entries that keep failing
//
// A push sends every waiting row of a table as one batch, so a row the server will never accept —
// one that trips a constraint, one too large for the request — fails the batch it is in, every
// time, for ever. Nothing is lost exactly, and nothing gets through either: that table's queue is
// stuck behind one row, and the knitter sees a device that simply stops syncing while the app says
// nothing at all.
//
// So a failure is remembered. `attempts` counts them, `nextAt` holds the entry back for a while
// (longer each time, to a ceiling), and the engine pushes a much-failed entry on its own so the
// rows behind it can go up without it. Nothing is ever dropped: a bad entry waits, visibly, rather
// than taking the good ones down with it.
type Entry = { kind: PendingKind; attempts: number; nextAt: number };

// `table/id` — one entry per thing, so marking the same yarn twice leaves one entry.
type Stored = Record<string, Entry>;

// A minute, doubling, to half an hour. Long enough that a server having a bad hour is not hammered,
// short enough that a knitter who closes the laptop and opens it again does not notice.
const FIRST_BACKOFF_MS = 60_000;
const MAX_BACKOFF_MS = 30 * 60_000;

// After this many failures an entry is pushed by itself. Three, because the first two failures are
// far more likely to be the network than the row.
export const SUSPECT_AFTER = 3;

export function backoffFor(attempts: number): number {
  return Math.min(FIRST_BACKOFF_MS * 2 ** Math.max(0, attempts - 1), MAX_BACKOFF_MS);
}

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
    // Outboxes written before entries carried a failure count hold a bare kind string. Read as a
    // fresh entry rather than discarded — those are changes somebody made and has not sent yet.
    const parsed = raw ? (JSON.parse(raw) as Record<string, PendingKind | Entry>) : {};
    cache = Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [
        key,
        typeof value === 'string' ? { kind: value, attempts: 0, nextAt: 0 } : value,
      ]),
    );
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
  const existing = current[keyOf(table, id)];
  // A delete outranks an edit: if a yarn was changed and then deleted before either was sent, what
  // the server needs to hear is that it is gone.
  if (existing?.kind === 'delete' && kind === 'upsert') return;
  // A fresh edit to a row that has been failing starts the row over. The knitter has changed it
  // since, so whatever the server objected to may well be gone.
  current[keyOf(table, id)] = { kind, attempts: 0, nextAt: 0 };
  await persist();
}

// Everything this device still owes the server, backed off or not.
//
// Deliberately not filtered by the backoff. Pull asks this to find out which local rows are unsent,
// so that a row the knitter has edited is never overwritten by the server's older copy — and a row
// waiting out a backoff is exactly a row whose local copy is newer. Filtering here would hand the
// knitter's unsent edit to the next pull to overwrite, which is the opposite of what an outbox is
// for. Push asks `due` instead.
export async function pending(table?: string): Promise<Pending[]> {
  const current = await load();
  return Object.entries(current)
    .map(([key, entry]) => ({ ...parse(key), kind: entry.kind, attempts: entry.attempts }))
    .filter((entry) => !table || entry.table === table);
}

// What is waiting *and* ready to be tried again. Push's view of the same queue.
export async function due(table?: string, now = Date.now()): Promise<Pending[]> {
  const current = await load();
  return Object.entries(current)
    .filter(([, entry]) => entry.nextAt <= now)
    .map(([key, entry]) => ({ ...parse(key), kind: entry.kind, attempts: entry.attempts }))
    .filter((entry) => !table || entry.table === table);
}

// A push that failed. Each entry waits longer than the last, and once it has failed enough times
// the engine stops batching it with the others.
export async function recordFailure(failed: Pending[], now = Date.now()): Promise<void> {
  const current = await load();
  for (const entry of failed) {
    const existing = current[keyOf(entry.table, entry.id)];
    // Gone, or marked again mid-flight: the newer state wins and starts clean.
    if (!existing || existing.kind !== entry.kind) continue;
    const attempts = existing.attempts + 1;
    current[keyOf(entry.table, entry.id)] = { ...existing, attempts, nextAt: now + backoffFor(attempts) };
  }
  await persist();
}

// Cleared only for what was actually sent, and only after it was sent. An entry marked again while
// the request was in flight has to survive, or that change is lost — so the caller passes back
// exactly what it pushed rather than asking for a wholesale clear.
export async function clear(sent: Pending[]): Promise<void> {
  const current = await load();
  for (const entry of sent) {
    // Still the same kind? A row marked upsert, pushed, then deleted mid-flight must stay marked.
    if (current[keyOf(entry.table, entry.id)]?.kind === entry.kind) {
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
    for (const [key, entry] of Object.entries(adopting)) {
      // A delete already recorded for this account outranks an inherited edit, same rule as mark().
      if (mine[key]?.kind === 'delete' && entry.kind === 'upsert') continue;
      mine[key] = entry;
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
    const parsed = JSON.parse(raw) as Record<string, PendingKind | Entry>;
    await AsyncStorage.removeItem(OUTBOX_KEY);
    // Same tolerance as load(): this one was written before entries carried a failure count.
    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [
        key,
        typeof value === 'string' ? { kind: value, attempts: 0, nextAt: 0 } : value,
      ]),
    );
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
