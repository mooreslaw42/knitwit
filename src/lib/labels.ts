import { MaxNameLength } from '@/constants/theme';

// Free-text project labels: "Christmas presents 2027", "for Mum", "stash-bust".
//
// The whole point is that the knitter invents them, so there is no catalogue and no validation
// beyond keeping them typeable and comparable. What these functions do is stop the same group
// becoming three groups through a stray capital or a trailing space.

// Two labels are the same group if they read the same. Compared case- and space-insensitively so
// "Christmas Presents 2027" and "christmas presents 2027" don't split a group in half.
export const labelKey = (label: string) => label.trim().replace(/\s+/g, ' ').toLowerCase();

export function cleanLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ').slice(0, MaxNameLength);
}

// Add a label to a list, keeping the first spelling the knitter used rather than the newest — the
// group already has a name by the time you type it a second time.
export function addLabel(labels: string[], raw: string): string[] {
  const clean = cleanLabel(raw);
  if (!clean) return labels;
  if (labels.some((l) => labelKey(l) === labelKey(clean))) return labels;
  return [...labels, clean];
}

export function removeLabel(labels: string[], raw: string): string[] {
  return labels.filter((l) => labelKey(l) !== labelKey(raw));
}

export function hasLabel(labels: string[], raw: string): boolean {
  return labels.some((l) => labelKey(l) === labelKey(raw));
}

// Every label in use across the knitter's projects, deduplicated on how they read and sorted the
// way they'd be looked for. One canonical spelling per group — the one used most, so a typo on a
// single project doesn't rename the group in the filter row.
export function labelsInUse(projects: { labels?: string[] }[]): string[] {
  const seen = new Map<string, { spellings: Map<string, number>; count: number }>();
  for (const p of projects) {
    for (const label of p.labels ?? []) {
      const key = labelKey(label);
      if (!key) continue;
      const entry = seen.get(key) ?? { spellings: new Map(), count: 0 };
      entry.spellings.set(label, (entry.spellings.get(label) ?? 0) + 1);
      entry.count += 1;
      seen.set(key, entry);
    }
  }
  return [...seen.values()]
    .map((e) => [...e.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0])
    .sort((a, b) => a.localeCompare(b));
}
