// Combining two copies of something that only ever counts upwards.
//
// Rows knitted, stitches worked, seconds spent, projects finished. Achievements says it of itself:
// "Monotonic: deleting, frogging or tidying up never takes back what was knitted." Nothing here
// should ever decrease, and last-write-wins makes it decrease all the time — a device that has been
// closed for a week pushes its stale total and a knitter watches their rows count go backwards.
//
// So: the larger of the two, field by field, all the way down.
//
// ## What this does not do, stated plainly
//
// It does not add. Knit fifty rows on a phone and thirty on a laptop, neither having synced in
// between, and the answer is fifty rather than eighty. Both devices started from the same total and
// there is no way, looking only at two numbers, to tell the shared history from the new work.
//
// Getting that right needs a per-device counter — each device tracking its own contribution, the
// total being their sum — which changes the stored shape of every counter in the app and is worth
// doing when somebody actually knits on two devices in one day. Until then this is the honest
// middle: it never loses the larger contribution, and it never goes backwards. Both of which
// last-write-wins does.

type Json = number | string | boolean | null | undefined | Json[] | { [key: string]: Json };

export function mergeMonotonic<T>(local: T | undefined, incoming: T): T {
  if (local === undefined) return incoming;
  return maxDeep(local as Json, incoming as Json) as T;
}

function maxDeep(local: Json, incoming: Json): Json {
  if (typeof local === 'number' && typeof incoming === 'number') {
    return Math.max(local, incoming);
  }

  if (Array.isArray(local) && Array.isArray(incoming)) {
    // Arrays here are day records keyed by date, not ordered lists, so they are merged by that key
    // rather than by position. Merging by position would pair Tuesday with Wednesday whenever one
    // device had a day the other did not.
    return mergeByDate(local, incoming);
  }

  if (isObject(local) && isObject(incoming)) {
    const out: { [key: string]: Json } = { ...local };
    for (const key of Object.keys(incoming)) {
      out[key] = key in local ? maxDeep(local[key], incoming[key]) : incoming[key];
    }
    return out;
  }

  // Different shapes, or anything that is not a number: the arriving value stands. A changed unit
  // or a renamed award is a description, not a count.
  return incoming;
}

function mergeByDate(local: Json[], incoming: Json[]): Json[] {
  const keyed = new Map<string, Json>();
  const keyOf = (entry: Json): string | null =>
    isObject(entry) && typeof entry.date === 'string' ? entry.date : null;

  for (const entry of local) {
    const key = keyOf(entry);
    if (key) keyed.set(key, entry);
  }

  for (const entry of incoming) {
    const key = keyOf(entry);
    // Anything without a date is not a day and cannot be paired up; keeping the arriving copy is
    // the least surprising thing to do with it.
    if (!key) continue;
    const existing = keyed.get(key);
    keyed.set(key, existing ? maxDeep(existing, entry) : entry);
  }

  // Sorted, because two devices that merged the same days in a different order should still hold
  // the same list — otherwise the store looks changed when nothing changed, and the watcher marks
  // it dirty for ever.
  return [...keyed.values()].sort((a, b) => {
    const left = keyOf(a) ?? '';
    const right = keyOf(b) ?? '';
    return left < right ? -1 : left > right ? 1 : 0;
  });
}

function isObject(value: Json): value is { [key: string]: Json } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
