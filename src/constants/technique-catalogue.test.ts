import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

import { STITCHES } from '@/constants/catalogs';
import { FAMILY_ORDER } from '@/lib/technique-catalogue';

// The technique catalogue lives in SQL and the chartable stitches live in TypeScript, and for a
// while they described the same ideas twice with no connection — seven techniques each carrying
// their own hand-typed copy of an abbreviation that happened to match. `stitch_key` joins them,
// and this is what stops the join rotting: the migrations are read as data and checked against
// STITCHES, so a mismatch fails here rather than showing a knitter two different abbreviations for
// one stitch.
//
// Reading SQL in a unit test is unusual. It is worth it because the alternative is a rule nobody
// can enforce until it is already wrong in production.

const MIGRATIONS = join(__dirname, '..', '..', 'supabase', 'migrations');

function sql(): string {
  // Annotated because tsconfig sets `types: ["jest"]`, so Node's own types are not in scope and
  // readdirSync comes back untyped.
  const files: string[] = readdirSync(MIGRATIONS);
  return files
    .filter((f: string) => f.endsWith('.sql'))
    .sort()
    .map((f: string) => readFileSync(join(MIGRATIONS, f), 'utf8'))
    .join('\n');
}

type Row = { id: string; name: string; craft: string; family: string; abbr: string; stitch: string };

// The seed rows carry no abbr or stitch_key column; the later migration's inserts carry both. One
// expression for each shape rather than one clever one for both.
function rows(): Row[] {
  const all = sql();
  const out: Row[] = [];

  // id, name, craft, family, summary, aliases
  const seed = /^\('([\w-]+)','((?:[^']|'')+)','(\w+)','([\w-]+)','(?:[^']|'')*','\{/gm;
  for (const m of all.matchAll(seed)) {
    out.push({ id: m[1], name: m[2], craft: m[3], family: m[4], abbr: '', stitch: '' });
  }

  // id, name, craft, family, abbr, stitch_key, summary, aliases
  const full = /^\('([\w-]+)','((?:[^']|'')+)','(\w+)','([\w-]+)','([^']*)','([\w-]*)','(?:[^']|'')*','\{/gm;
  for (const m of all.matchAll(full)) {
    const existing = out.findIndex((r) => r.id === m[1]);
    const row = { id: m[1], name: m[2], craft: m[3], family: m[4], abbr: m[5], stitch: m[6] };
    if (existing === -1) out.push(row);
    else out[existing] = row;
  }
  return out;
}

// `update ... from (values ('id','abbr'), …)` — both the abbreviations migration and the later
// stitch_key links use this shape.
function updates(after: string): Record<string, string> {
  const all = sql();
  const start = all.indexOf(after);
  if (start === -1) return {};
  const block = all.slice(start, all.indexOf(') as v(', start));
  return Object.fromEntries([...block.matchAll(/\('([\w-]+)',\s*'([^']*)'\)/g)].map((m) => [m[1], m[2]]));
}

const CATALOGUE = rows();
const ABBR = updates('set abbr = v.abbr');
const LINKS = updates('set stitch_key = v.stitch_key');

const abbrOf = (r: Row) => ABBR[r.id] ?? r.abbr;
const stitchOf = (r: Row) => LINKS[r.id] ?? r.stitch;

describe('the technique catalogue as data', () => {
  it('parses — if this fails the rest of the file is meaningless', () => {
    expect(CATALOGUE.length).toBeGreaterThan(130);
  });

  it('has no duplicate ids, which are foreign keys in saved patterns', () => {
    const ids = CATALOGUE.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only uses families the app knows how to group by', () => {
    const unknown = CATALOGUE.filter((r) => !(FAMILY_ORDER as string[]).includes(r.family));
    expect(unknown.map((r) => `${r.id}: ${r.family}`)).toEqual([]);
  });

  it('only uses crafts the app knows', () => {
    const unknown = CATALOGUE.filter((r) => !['knit', 'crochet', 'both'].includes(r.craft));
    expect(unknown.map((r) => `${r.id}: ${r.craft}`)).toEqual([]);
  });
});

describe('the link to the chartable stitches', () => {
  it('never points at a stitch that does not exist', () => {
    const broken = CATALOGUE.filter((r) => stitchOf(r) && !(stitchOf(r) in STITCHES));
    expect(broken.map((r) => `${r.id} -> ${stitchOf(r)}`)).toEqual([]);
  });

  it('agrees with STITCHES about the abbreviation, wherever both have one', () => {
    // The whole point of the link. Two copies of "k2tog" that drift apart would show a knitter one
    // abbreviation in the library and a different one on the chart.
    const disagreements = CATALOGUE.filter((r) => {
      const key = stitchOf(r);
      const mine = abbrOf(r);
      if (!key || !mine) return false;
      return STITCHES[key].abbr.toLowerCase() !== mine.toLowerCase();
    }).map((r) => `${r.id}: catalogue "${abbrOf(r)}" vs STITCHES "${STITCHES[stitchOf(r)].abbr}"`);
    expect(disagreements).toEqual([]);
  });

  it('does not let two techniques claim the same stitch', () => {
    const claimed = CATALOGUE.map(stitchOf).filter(Boolean);
    const twice = claimed.filter((k, i) => claimed.indexOf(k) !== i);
    expect([...new Set(twice)]).toEqual([]);
  });

  it('links the stitches a knitter and a crocheter actually start with', () => {
    const linked = new Set(CATALOGUE.map(stitchOf).filter(Boolean));
    for (const key of ['knit', 'purl', 'sc', 'dc', 'hdc', 'ch']) expect(linked).toContain(key);
  });
});

describe('what the catalogue was missing', () => {
  const of = (craft: string, family: string) =>
    CATALOGUE.filter((r) => r.craft === craft && r.family === family);

  // The gap that prompted all of this: knitting had seven ways to finish and crochet had none, so
  // the library showed a crocheter an empty shelf where fastening off should be.
  it('gives crochet a way to finish', () => {
    expect(of('crochet', 'bind-off').length).toBeGreaterThan(0);
    expect(CATALOGUE.find((r) => r.id === 'fasten-off')).toBeTruthy();
  });

  it('gives crochet a way to increase', () => {
    expect(of('crochet', 'increase').length).toBeGreaterThan(0);
  });

  it('has the basic stitches of both crafts, not only the interesting techniques', () => {
    const ids = new Set(CATALOGUE.map((r) => r.id));
    for (const id of [
      'knit-stitch',
      'purl-stitch',
      'single-crochet',
      'double-crochet',
      'half-double-crochet',
      'treble-crochet',
      'slip-stitch-crochet',
      'turning-chain',
    ]) {
      expect(ids).toContain(id);
    }
  });

  it('knows Tunisian crochet exists', () => {
    expect(CATALOGUE.filter((r) => r.id.startsWith('tunisian-')).length).toBeGreaterThanOrEqual(5);
  });
});
