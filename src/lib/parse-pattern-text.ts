import { parseSizeRun, rowStitchesAfter, sectionRowCounts } from '@/lib/knitwit-helpers';
import type { PatternRow, PatternStitchGroup, SizedNumber, StitchSide } from '@/types/knitwit';

// Deterministic parser for written knitting rows — phase 5a of the stitch engine.
//
// It handles the regular shorthand ("Row 1 (RS): K2, yo, k2tog, knit to last 2 sts, k2") and
// deliberately *refuses* what it cannot do faithfully rather than guessing. A row it can't chart
// is still returned, with its original wording preserved in `instruction` and an issue raised, so
// nothing the knitter wrote is ever lost. The refused cases are what the model handles later.

export type ParseIssue = {
  rowIndex: number | null; // null = an issue with the text as a whole
  message: string;
};

export type ParseResult = {
  rows: PatternRow[];
  // Stitch count the pattern *claims* for each row ("… (48 sts)"), parallel to `rows`. Used to
  // check our own work; null where the pattern didn't say.
  expectedCounts: (number | null)[];
  issues: ParseIssue[];
  // Lines that didn't look like rows at all (headings, prose). Kept so a caller can show them.
  ignoredLines: string[];
};

let uid = 0;
const nextId = (prefix: string) => `${prefix}${Date.now().toString(36)}${uid++}`;

const group = (
  type: string,
  span: PatternStitchGroup['span'],
  count: SizedNumber | null,
): PatternStitchGroup => ({
  id: nextId('g'),
  type,
  span,
  count,
  materialSlot: null,
  note: '',
});

// `Row 3 (RS):`, `Rows 5-8:`, `Round 2:` — captures number, optional end-of-range, optional
// parenthetical (which usually carries the side), and the instruction body.
const ROW_HEADER =
  /^\s*(?:rows?|rnds?|rounds?)\s+(\d+)\s*(?:[-–—to]+\s*(\d+))?\s*(?:\(([^)]*)\))?\s*[:.]\s*(.*)$/i;

// A trailing "(48 sts)" / "48 sts" the pattern states as a check on itself.
const STATED_COUNT = /\(?\b(\d+)\s*(?:sts?|stitches)\b\)?\s*[.]?\s*$/i;

// Count-dependent repeats ("rep from * to last 2 sts") need the live stitch count to expand, which
// also differs per size — that's phase 5b/5c work, so we refuse them here instead of guessing.
const STAR_REPEAT = /\brep(?:eat)?\s+from\s+\*/i;
// Fixed-multiplier repeats are count-independent, so expanding them is always safe.
const BRACKET_REPEAT = /^\[([^\]]+)\]\s*(?:x\s*)?(\d+)\s*(?:times?)?$/i;

// Longest/most specific first: `k2tog` must never fall through to the generic `k<number>` rule.
const NAMED: { re: RegExp; type: string }[] = [
  { re: /^k2tog(?:tbl)?$/i, type: 'k2tog' },
  { re: /^p2tog$/i, type: 'p2tog' },
  { re: /^ssk$/i, type: 'ssk' },
  { re: /^kfb$/i, type: 'kfb' },
  { re: /^m1l$/i, type: 'm1l' },
  { re: /^m1r$/i, type: 'm1r' },
  { re: /^m1$/i, type: 'm1l' }, // unspecified lean: pick left, the knitter can flip it
  { re: /^(?:yo|yfwd|yon)$/i, type: 'yo' },
  { re: /^(?:pm|place\s+marker)$/i, type: 'pm' },
];

function parseToken(raw: string): PatternStitchGroup | null {
  const t = raw.trim().replace(/[.;]+$/, '').trim();
  if (!t) return null;

  for (const { re, type } of NAMED) {
    if (re.test(t)) return group(type, 'exact', 1);
  }

  // "knit to last 2 sts" / "p to last st" / "knit to last 2 (2) 3 sts"
  const toLast = t.match(/^(k|knit|p|purl)\b.*?\bto\s+last\s+([\d()\s,]*?)\s*(?:sts?|stitches?)?$/i);
  if (toLast) {
    const type = /^(k|knit)$/i.test(toLast[1]) ? 'knit' : 'purl';
    return group(type, 'to-last', parseSizeRun(toLast[2]) ?? 1);
  }

  // "knit to end" / "purl to end" / bare "knit" / bare "purl" — work across everything left.
  if (/^(?:k|knit)\s+to\s+(?:the\s+)?end$/i.test(t) || /^knit(?:\s+all)?$/i.test(t)) {
    return group('knit', 'all', null);
  }
  if (/^(?:p|purl)\s+to\s+(?:the\s+)?end$/i.test(t) || /^purl(?:\s+all)?$/i.test(t)) {
    return group('purl', 'all', null);
  }

  // "sl1" / "sl 2" / "slip"
  const slip = t.match(/^(?:sl|slip)\s*(\d+)?$/i);
  if (slip) return group('slip', 'exact', slip[1] ? parseInt(slip[1], 10) : 1);

  // "ktbl" / "ktbl2"
  const tbl = t.match(/^ktbl\s*(\d+)?$/i);
  if (tbl) return group('ktbl', 'exact', tbl[1] ? parseInt(tbl[1], 10) : 1);

  // "BO 4" / "bind off 4" / "CO 6" / "cast on 6"
  const off = t.match(/^(?:bo|bind\s*off|cast\s*off)\s*(\d+)?$/i);
  if (off) return group('bo', 'exact', off[1] ? parseInt(off[1], 10) : 1);
  const on = t.match(/^(?:co|cast\s*on)\s*(\d+)?$/i);
  if (on) return group('co', 'exact', on[1] ? parseInt(on[1], 10) : 1);

  // Plain runs: "k2", "p10", "knit 3", a per-size run "k2 (3) 4", and bare "k"/"p" meaning one.
  const run = t.match(/^(k|knit|p|purl)\s*([\d()\s,]*)$/i);
  if (run) {
    const type = /^(k|knit)$/i.test(run[1]) ? 'knit' : 'purl';
    return group(type, 'exact', parseSizeRun(run[2]) ?? 1);
  }

  return null;
}

// Split on commas/semicolons that aren't inside [] or *…*.
function splitTokens(body: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let star = false;
  let buf = '';
  for (const ch of body) {
    if (ch === '[') depth++;
    else if (ch === ']') depth = Math.max(0, depth - 1);
    else if (ch === '*') star = !star;
    if ((ch === ',' || ch === ';') && depth === 0 && !star) {
      out.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  out.push(buf);
  return out.map((s) => s.trim()).filter(Boolean);
}

function sideFor(parenthetical: string | undefined, rowNumber: number): StitchSide {
  if (parenthetical) {
    if (/\bws\b|wrong\s*side/i.test(parenthetical)) return 'WS';
    if (/\brs\b|right\s*side/i.test(parenthetical)) return 'RS';
  }
  // Unstated: patterns conventionally start on the right side and alternate.
  return rowNumber % 2 === 1 ? 'RS' : 'WS';
}

export function parseSectionText(text: string): ParseResult {
  const rows: PatternRow[] = [];
  const expectedCounts: (number | null)[] = [];
  const issues: ParseIssue[] = [];
  const ignoredLines: string[] = [];

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const header = trimmed.match(ROW_HEADER);
    if (!header) {
      ignoredLines.push(trimmed);
      continue;
    }

    const from = parseInt(header[1], 10);
    const to = header[2] ? parseInt(header[2], 10) : from;
    const parenthetical = header[3];
    let body = header[4].trim();

    // Pull off a stated stitch count before tokenising, so it isn't mistaken for a stitch.
    let expected: number | null = null;
    const stated = body.match(STATED_COUNT);
    if (stated) {
      expected = parseInt(stated[1], 10);
      body = body.slice(0, stated.index).trim().replace(/[.,;]+$/, '');
    }

    // A range ("Rows 5-8") repeats the same instruction; guard against a reversed or silly range.
    const span = Math.max(1, Math.min(to - from + 1, 200));

    for (let i = 0; i < span; i++) {
      const rowNumber = from + i;
      const rowIndex = rows.length;
      const stitches: PatternStitchGroup[] = [];
      let refused: string | null = null;

      if (STAR_REPEAT.test(body)) {
        refused =
          'Repeats like "rep from *" depend on the live stitch count — left unparsed so nothing is invented.';
      } else {
        for (const token of splitTokens(body)) {
          const bracket = token.match(BRACKET_REPEAT);
          if (bracket) {
            const inner = splitTokens(bracket[1]);
            const times = Math.max(1, Math.min(parseInt(bracket[2], 10) || 1, 200));
            const parsedInner = inner.map(parseToken);
            if (parsedInner.some((g) => g === null)) {
              refused = `Couldn't read the repeat "${token}".`;
              break;
            }
            for (let r = 0; r < times; r++) {
              for (const g of parsedInner) {
                // Fresh ids per repetition — two groups must never share one.
                stitches.push({ ...(g as PatternStitchGroup), id: nextId('g') });
              }
            }
            continue;
          }

          const parsed = parseToken(token);
          if (!parsed) {
            refused = `Couldn't read "${token}".`;
            break;
          }
          stitches.push(parsed);
        }
      }

      if (refused) {
        issues.push({ rowIndex, message: `Row ${rowNumber}: ${refused}` });
      }

      rows.push({
        id: nextId('r'),
        label: `Row ${rowNumber}`,
        side: sideFor(parenthetical, rowNumber),
        marker: false,
        // Always keep the original wording, whether or not we charted it.
        instruction: header[4].trim(),
        stitches: refused ? [] : stitches,
      });
      expectedCounts.push(expected);
    }
  }

  if (rows.length === 0) {
    issues.push({ rowIndex: null, message: 'No rows found. Lines should start with "Row 1:" etc.' });
  }

  return { rows, expectedCounts, issues, ignoredLines };
}

// Check the parse against the counts the pattern states about itself. This is the safety net that
// makes an automated parse trustworthy: if we read a row wrong, the running stitch count usually
// stops agreeing with the pattern, and we say so instead of quietly charting nonsense.
export function reconcileRowCounts(
  rows: PatternRow[],
  expectedCounts: (number | null)[],
  castOn: number,
): ParseIssue[] {
  const issues: ParseIssue[] = [];
  const before = sectionRowCounts(rows, castOn);
  rows.forEach((row, i) => {
    const expected = expectedCounts[i];
    // A refused row charts nothing, so it has no count of its own to check.
    if (expected == null || row.stitches.length === 0) return;
    const after = rowStitchesAfter(row, before[i]);
    if (after !== expected) {
      issues.push({
        rowIndex: i,
        message: `Row ${i + 1}: pattern says ${expected} sts, this parse gives ${after}.`,
      });
    }
  });
  return issues;
}
