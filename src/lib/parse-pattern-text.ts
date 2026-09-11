import {
  formatSizeRun,
  parseSizeRun,
  rowStitchesAfter,
  sectionRowCounts,
  sizeValue,
} from '@/lib/knitwit-helpers';
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
  // A cast-on the prose stated ("Cast on 6 (6) 7 sts"), if it did. Null means the caller should
  // keep whatever it already had.
  castOn: SizedNumber | null;
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

// The other common convention, and the one most European patterns use: `1st row (WS row): …`,
// `2nd row (RS row): …`. Same capture order as ROW_HEADER, minus the range — an ordinal header
// names a single row.
const ORDINAL_ROW_HEADER =
  /^\s*(\d+)(?:st|nd|rd|th)\s+(?:rows?|rnds?|rounds?)\s*(?:\(([^)]*)\))?\s*[:.]\s*(.*)$/i;

// `Work 1st – 4th row a total of 7 (8) 8 (8) 9 times.` / `Repeat 1st – 2nd row … 4 times.`
// The block being repeated was just defined above it, so these lines multiply what came before
// rather than adding anything of their own.
const BLOCK_REPEAT_TIMES =
  /^\s*(?:work|repeat|rep)\s+(\d+)(?:st|nd|rd|th)\s*(?:[-–—]|to)\s*(\d+)(?:st|nd|rd|th)\s+(?:rows?|rnds?)\b[^.]*?\b(?:a\s+total\s+of\s+)?([\d()\s,]+?)\s*times/i;

// `Repeat 1st – 2nd row until you have worked a total of 23 (25) 25 rows.` — the same thing
// expressed as a row count rather than a repeat count.
const BLOCK_REPEAT_UNTIL =
  /^\s*(?:work|repeat|rep)\s+(\d+)(?:st|nd|rd|th)\s*(?:[-–—]|to)\s*(\d+)(?:st|nd|rd|th)\s+(?:rows?|rnds?)\b[^.]*?\btotal\s+of\s+([\d()\s,]+?)\s*rows/i;

// `Cast on 6 (6) 7 (7) 9 sts using 3 mm needles.` — a section's starting stitch count, stated in
// prose rather than in a field. Worth picking up: it's what the whole chart counts from.
const CAST_ON_LINE =
  /^\s*(?:cast\s+on|co)\s+([\d()\s,]+?)\s*(?:sts?|stitches)\b/i;

// `You now have 13 (14) 15 sts on your needles.` — the pattern checking itself mid-prose, the same
// job as a trailing "(48 sts)". Free accuracy check, so it's worth reading.
const RUNNING_COUNT_LINE =
  /^\s*(?:you\s+(?:now\s+)?have|there\s+(?:are|will\s+be))\s+([\d()\s,]+?)\s*(?:sts?|stitches)\b/i;

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

  // Work across everything left, however the pattern phrases it: "knit to end", "k to end of row",
  // "purl all sts", "knit across", bare "knit". The trailing "sts"/"stitches" is common in
  // descriptive patterns ("Purl all sts.") and would otherwise sink the whole row.
  const END = /^(?:to\s+(?:the\s+)?end(?:\s+of\s+(?:the\s+)?rows?)?|across|all)(?:\s+(?:sts?|stitches))?$/i;
  const verb = t.match(/^(k|knit|p|purl)\b/i);
  if (verb) {
    const rest = t.slice(verb[0].length).trim();
    // A spelled-out verb on its own means the whole row ("Knit."); the abbreviation on its own
    // means a single stitch ("k, p, k"), so it falls through to the plain-run rule below.
    const wholeRow = END.test(rest) || (rest === '' && verb[1].length > 1);
    if (wholeRow) {
      return group(/^(k|knit)$/i.test(verb[1]) ? 'knit' : 'purl', 'all', null);
    }
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
  let castOn: SizedNumber | null = null;

  // Descriptive patterns define a short block of numbered rows and then say how many times to work
  // it ("Work 1st – 4th row a total of 7 (8) 8 times."). The definition itself isn't worked, so
  // rows are held here until we know whether a repeat instruction follows.
  let pending: { row: PatternRow; expected: number | null; ordinal: number }[] = [];
  let expandedARepeat = false;

  const flush = () => {
    for (const p of pending) {
      rows.push(p.row);
      expectedCounts.push(p.expected);
    }
    pending = [];
  };

  // Append `copies` passes over the rows numbered `from`..`to` in the pending block, renumbering
  // as they land. Fresh ids throughout: two rows must never share one.
  const expand = (from: number, to: number, copies: number, cycleTo?: number) => {
    const block = pending.filter((p) => p.ordinal >= from && p.ordinal <= to);
    if (block.length === 0) {
      flush();
      return false;
    }
    const kept = pending.filter((p) => p.ordinal < from || p.ordinal > to);
    for (const p of kept) {
      rows.push(p.row);
      expectedCounts.push(p.expected);
    }
    const total = cycleTo ?? block.length * copies;
    for (let i = 0; i < Math.min(total, 400); i++) {
      const src = block[i % block.length];
      rows.push({
        ...src.row,
        id: nextId('r'),
        label: `Row ${rows.length + 1}`,
        stitches: src.row.stitches.map((g) => ({ ...g, id: nextId('g') })),
      });
      // Only the final pass lands on the stated count; the intermediate ones are mid-repeat.
      expectedCounts.push(i === total - 1 ? src.expected : null);
    }
    pending = [];
    expandedARepeat = true;
    return true;
  };

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // A repeat instruction multiplies the block above it, so it's handled before anything else.
    const repeatTimes = trimmed.match(BLOCK_REPEAT_TIMES);
    const repeatUntil = trimmed.match(BLOCK_REPEAT_UNTIL);
    if (repeatTimes || repeatUntil) {
      const m = (repeatUntil ?? repeatTimes)!;
      const from = parseInt(m[1], 10);
      const to = parseInt(m[2], 10);
      const run = parseSizeRun(m[3]);
      const first = run == null ? 1 : sizeValue(run, 0);
      const ok = repeatUntil
        ? expand(from, to, 0, Math.max(1, first))
        : expand(from, to, Math.max(1, first));
      if (!ok) {
        ignoredLines.push(trimmed);
      } else if (Array.isArray(run)) {
        // The chart is one list of rows, but this repeat is a different length per size. Charting
        // the first size and saying so beats charting nothing, and beats silently charting a
        // length that's wrong for whoever is knitting it.
        issues.push({
          rowIndex: null,
          message: `"${trimmed}" — the repeat differs per size; charted for the first size (${formatSizeRun(run)}).`,
        });
      }
      continue;
    }

    // "Cast on 6 (6) 7 sts" — the count the whole chart starts from, stated in prose.
    const co = trimmed.match(CAST_ON_LINE);
    if (co && castOn == null) {
      castOn = parseSizeRun(co[1]);
      ignoredLines.push(trimmed);
      continue;
    }

    // "You now have 13 (14) 15 sts" — the pattern checking itself. Attach it to the last row so
    // reconcileRowCounts can use it, exactly like a trailing "(48 sts)".
    const running = trimmed.match(RUNNING_COUNT_LINE);
    if (running) {
      const run = parseSizeRun(running[1]);
      const value = run == null ? null : sizeValue(run, 0);
      if (pending.length > 0) pending[pending.length - 1].expected = value;
      else if (expectedCounts.length > 0) expectedCounts[expectedCounts.length - 1] = value;
      ignoredLines.push(trimmed);
      continue;
    }

    const header = trimmed.match(ROW_HEADER) ?? trimmed.match(ORDINAL_ROW_HEADER);
    if (!header) {
      ignoredLines.push(trimmed);
      continue;
    }

    // The ordinal form has no range, so its capture groups sit one to the left. Normalise.
    const isOrdinal = header.length === 4;
    const from = parseInt(header[1], 10);
    const to = isOrdinal ? from : header[2] ? parseInt(header[2], 10) : from;
    const parenthetical = isOrdinal ? header[2] : header[3];
    const rawBody = (isOrdinal ? header[3] : header[4]).trim();
    let body = rawBody;

    // Numbering restarting at 1 means a new block began, and whatever was pending was never
    // repeated — emit it as written.
    if (from === 1 && pending.length > 0) flush();

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
      const rowIndex = rows.length + pending.length;
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

      pending.push({
        ordinal: rowNumber,
        expected,
        row: {
          id: nextId('r'),
          label: `Row ${rowNumber}`,
          side: sideFor(parenthetical, rowNumber),
          marker: false,
          // Always keep the original wording, whether or not we charted it.
          instruction: rawBody,
          stitches: refused ? [] : stitches,
        },
      });
    }
  }

  flush();

  // Only renumber when a repeat was expanded. A block worked seven times would otherwise label its
  // rows 1,2,3,4,1,2,3,4… — but when nothing repeated, the pattern's own numbering ("Rows 5-8")
  // is what the knitter sees on the page, so it's left alone.
  if (expandedARepeat) {
    rows.forEach((row, i) => {
      row.label = `Row ${i + 1}`;
    });
  }

  if (rows.length === 0) {
    issues.push({
      rowIndex: null,
      message: 'No rows found. Rows should start with "Row 1:" or "1st row:".',
    });
  }

  return { rows, expectedCounts, issues, ignoredLines, castOn };
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
