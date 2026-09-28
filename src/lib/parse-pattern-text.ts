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

// Which vocabulary to read the text with. 'both' tries crochet first and falls through to
// knitting, which is what a pattern using the two together needs.
export type ParseCraft = 'knit' | 'crochet' | 'both';

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

// ---- Reading a row header ----
//
// Patterns number their rows in every notation going, and all of them have to be read: a header
// the rule misses is not a row with a problem, it is a row that does not exist. A pattern written
// in the commonest shorthand of all — "R21: k2, p2" — used to parse to *nothing*, and all the
// knitter was told was that no rows had been found.

// How the row word itself can be written. The bare "R" only counts when a number follows it, which
// is what stops it eating "Rep…", "Rib…" or "Round the neckline…".
const ROW_WORD = String.raw`(?:rows?|rnds?|rounds?|r)`;

// What can sit between the header and the instruction: a colon, full stop, bracket or equals sign;
// a dash, which has to be followed by a space so it can't be read as a range; or nothing but
// whitespace, as in "r21 k2, p2". Captured, because the loose form has to be checked (see below).
const SEPARATOR = String.raw`(\s*[:.)\]=]+\s*|\s*[-–—]\s+|\s+)`;

// `Row 3 (RS):`, `Rows 5-8:`, `R5–R8:`, `Rnd2.`, `Rows 1 and 2:`, `R21 k2, p2`. Captures the
// number, the optional end-of-range, the optional parenthetical (which usually carries the side),
// the separator, and the instruction body.
const ROW_HEADER = new RegExp(
  String.raw`^${ROW_WORD}\s*(\d+)` +
    String.raw`(?:\s*(?:[-–—]|to|and|&|\+)\s*(?:${ROW_WORD}\s*)?(\d+))?` +
    String.raw`(?:\s*[([]([^)\]]*)[)\]])?` +
    SEPARATOR +
    String.raw`(.*)$`,
  'i',
);

// The other common convention, and the one most European patterns use: `1st row (WS row): …`,
// `2nd row (RS row): …`. An ordinal header names a single row, so it has no range — the empty
// group keeps the capture order identical to ROW_HEADER's.
const ORDINAL_ROW_HEADER = new RegExp(
  String.raw`^(\d+)(?:st|nd|rd|th)\s*(?:rows?|rnds?|rounds?)()` +
    String.raw`(?:\s*[([]([^)\]]*)[)\]])?` +
    SEPARATOR +
    String.raw`(.*)$`,
  'i',
);

// A plainly numbered list — what a pattern typed into a note or lifted out of a table looks like:
// "1: k2, p2", "1) knit", "1-4: knit". Only a colon or a bracket counts as the separator here:
// "1. Cast on 20 sts." is a numbered prose step far more often than it is a row, and a bare number
// followed by nothing but a space is not a header at all.
const BARE_NUMBER_HEADER =
  /^(\d+)(?:\s*[-–—]\s*(\d+))?(?:\s*[([]([^)\]]*)[)\]])?(\s*[:)]\s*)(.*)$/;

// A side marker doesn't always sit in brackets ahead of the colon: "Row 1 RS: knit" and
// "Row 1: (RS) knit" are both ordinary, and in the first it is all that stands between the number
// and the instruction.
const LEADING_SIDE =
  /^[([]?\s*(rs|ws|right\s*side|wrong\s*side)(?:\s*rows?)?\s*[)\]]?\s*[:.,\-–—]?\s*/i;

type RowHeader = {
  from: number;
  to: number;
  parenthetical: string | undefined;
  body: string;
};

// Does this body open with something that could be an instruction? Only asked of the loose
// "r21 k2, p2" form, which has no punctuation to prove it is a row at all — without the check,
// prose like "Round 2 is worked in the round." would become a row that only fails later.
function looksLikeStitches(body: string, craft: ParseCraft): boolean {
  const first = splitTokens(body)[0];
  if (!first) return false;
  // A repeat or a bracketed group may well be refused further down, but it is unmistakably an
  // instruction, and a refused row keeps the knitter's wording where an ignored line loses it.
  if (/^[*[(\d]/.test(first) || /^rep(?:eat)?\b/i.test(first)) return true;
  return parseToken(first, craft) !== null;
}

function matchRowHeader(line: string, craft: ParseCraft): RowHeader | null {
  const m =
    line.match(ROW_HEADER) ?? line.match(ORDINAL_ROW_HEADER) ?? line.match(BARE_NUMBER_HEADER);
  if (!m) return null;

  const from = parseInt(m[1], 10);
  let parenthetical = m[3];
  let body = m[5];

  // Take a side marker off the front of the instruction, wherever the pattern chose to put it.
  const side = body.match(LEADING_SIDE);
  if (side) {
    parenthetical = parenthetical || side[1];
    body = body.slice(side[0].length);
  }

  // The loose form has nothing but a space to say it is a header, so its instruction has to look
  // like one. A punctuated header is taken at its word: an instruction that can't be charted is
  // then refused with its wording kept, which is the whole point of the row surviving.
  if (!/\S/.test(m[4]) && side == null && !looksLikeStitches(body, craft)) return null;

  return {
    from,
    to: m[2] ? parseInt(m[2], 10) : from,
    parenthetical,
    body: body.trim(),
  };
}

// Rows run together on one line the moment a pattern is copied out of a PDF ("Row 1: knit. Row 2:
// purl."), and the layout it came from leaves non-breaking spaces and bullets behind. All of that
// is straightened out before any line is read: a joined line parses as one row whose instruction
// can't be charted, which costs exactly as much as a missed header.
const JOINED_ROWS = new RegExp(
  String.raw`([.;:)])\s+(?=${ROW_WORD}\s*\d+(?:\s*(?:[-–—]|to)\s*(?:${ROW_WORD}\s*)?\d+)?\s*(?:[([][^)\]]*[)\]])?\s*[:.)])`,
  'gi',
);

function normalizedLines(text: string): string[] {
  return (
    text
      // Every kind of space a word processor or PDF might have used, read as a plain one.
      .replace(/[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/g, ' ')
      .replace(JOINED_ROWS, '$1\n')
      .split(/\r?\n/)
      // A bullet or dash left over from the layout, not part of the instruction. `*` is left
      // alone: it opens a repeat.
      .map((line) => line.trim().replace(/^[•·‣▪◦‧⁃–—-]\s+/, '').trim())
  );
}

// How a repeat line says how many: "… 4 times", "… a total of 7 (8) 8 times", "… twice more",
// "… x 4". Three capture groups — word count, numeral count, count after an "x" — of which
// exactly one ever matches. A numeral has to be followed by "times", or "until it measures 24 cm"
// would read as a repeat count of 24.
const TIMES = String.raw`(?:[^.]*?(?:\b(once|twice|thrice|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b\s*(?:more\s*)?(?:times?)?|([\d()\s,]+?)\s*(?:more\s+)?times)|\s*(?:rows?|rnds?)?\s*[x×]\s*(\d+))`;

// `Work 1st – 4th row a total of 7 (8) 8 (8) 9 times.`, `Repeat rows 1-2 4 times.`,
// `Rep R1–R2 x 4.` The block being repeated was just defined above, so these lines multiply what
// came before rather than adding anything of their own. Group order: verb, first row, last row,
// then the count — written either before "times" or after an "x".
const BLOCK_REPEAT_TIMES = new RegExp(
  String.raw`^(work|repeat|rep)\b\s*(?:${ROW_WORD}\s*)?(\d+)(?:st|nd|rd|th)?\s*(?:[-–—]|to|and|&)\s*(?:${ROW_WORD}\s*)?(\d+)(?:st|nd|rd|th)?` +
    TIMES,
  'i',
);

// `Rep last 2 rows 4 times.` / `Work the last 6 rows twice more.` — the same instruction with the
// block named by position rather than by number, which is how most English-language patterns put
// it. Group order matches BLOCK_REPEAT_TIMES minus the range: verb, block length, count.
const BLOCK_REPEAT_LAST = new RegExp(
  String.raw`^(work|repeat|rep)\b[^.]*?\blast\s+(\d+)\s+(?:rows?|rnds?|rounds?)` + TIMES,
  'i',
);

// `Repeat 1st – 2nd row until you have worked a total of 23 (25) 25 rows.` — the same thing
// expressed as a row count rather than a repeat count.
const BLOCK_REPEAT_UNTIL = new RegExp(
  String.raw`^(?:work|repeat|rep)\b\s*(?:${ROW_WORD}\s*)?(\d+)(?:st|nd|rd|th)?\s*(?:[-–—]|to|and|&)\s*(?:${ROW_WORD}\s*)?(\d+)(?:st|nd|rd|th)?` +
    String.raw`[^.]*?\btotal\s+of\s+([\d()\s,]+?)\s*rows`,
  'i',
);

// A small repeat count is as often written as a word as a numeral: "twice more", "work it three
// times".
const WORD_NUMBERS: Record<string, number> = {
  once: 1,
  twice: 2,
  thrice: 3,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

// The count off a repeat line, from whichever of its alternatives matched: a word, a per-size run,
// or the number after an "x".
function repeatCount(candidates: (string | undefined)[]): SizedNumber | null {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const word = WORD_NUMBERS[candidate.trim().toLowerCase()];
    if (word != null) return word;
    const run = parseSizeRun(candidate);
    if (run != null) return run;
  }
  return null;
}

// How many passes over the block a repeat line is asking for. "A total of 7 times" is seven passes
// in all, and so is "work … 7 times" — the pattern is telling you the whole of what to work. A
// plain "repeat rows 1-2 four times" is four passes *on top of* the one just written out, which is
// what a knitter reading down the page does with it. Getting this backwards makes a section a whole
// repeat too long or too short, so the wording decides rather than a house rule.
function passesFor(line: string, verb: string, times: number): number {
  return /\btotal\b/i.test(line) || /^work/i.test(verb) ? times : times + 1;
}

// `Cast on 6 (6) 7 (7) 9 sts using 3 mm needles.` — a section's starting stitch count, stated in
// prose rather than in a field. Worth picking up: it's what the whole chart counts from.
const CAST_ON_LINE =
  /^\s*(?:\d+[.)]\s*)?(?:cast\s+on|co)\s+([\d()\s,]+?)\s*(?:sts?|stitches)\b/i;

// `Chain 32` / `ch 32 (34) 36` on a line of its own — crochet's cast-on under another name, and
// what every row after it counts from. Anchored at the end so a row's own "ch 2, turn" is not
// mistaken for one: that has words after the number, and this may not.
const FOUNDATION_CHAIN_LINE =
  /^\s*(?:\d+[.)]\s*)?(?:chain|ch)\s+([\d()\s,]+?)\s*(?:chains?|sts?|stitches)?\s*\.?$/i;

// `You now have 13 (14) 15 sts on your needles.` — the pattern checking itself mid-prose, the same
// job as a trailing "(48 sts)". Free accuracy check, so it's worth reading.
const RUNNING_COUNT_LINE =
  /^\s*(?:you\s+(?:now\s+)?have|there\s+(?:are|will\s+be))\s+([\d()\s,]+?)\s*(?:sts?|stitches)\b/i;

// A trailing "(48 sts)" / "48 sts" the pattern states as a check on itself.
const STATED_COUNT = /\(?\b(\d+)\s*(?:sts?|stitches)\b\)?\s*[.]?\s*$/i;

// Count-dependent repeats ("rep from * to last 2 sts") need the live stitch count to expand, which
// also differs per size — that's phase 5b/5c work, so we refuse them here instead of guessing.
const STAR_REPEAT = /\brep(?:eat)?\s+from\s+\*/i;
// Fixed-multiplier repeats are count-independent, so expanding them is always safe. Written with
// either kind of bracket and with the count on either side: "[k2, p2] 3 times", "[k2,p2] x3",
// "(dc, dc incr) x 4", "4x (dc, dc incr)" — the last is how most crochet patterns put it.
const BRACKET_REPEAT = /^[[(]([^\])]+)[\])]\s*(?:x\s*)?(\d+)\s*(?:times?)?$/i;
const REPEAT_FIRST = /^(\d+)\s*x\s*[[(]([^\])]+)[\])]$/i;

// Crochet shorthand, read through the same token pipeline as knitting: a row is split on commas,
// each token becomes a PatternStitchGroup, and the running count falls out of `takes`/`delta`
// exactly as it does for knits and purls. Nothing below is new machinery — it is vocabulary.
//
// US names throughout. A UK pattern says "dc" for what this reads as "sc", so it has to be
// converted before it gets here (CROCHET_UK_TO_US); reading a UK pattern as US produces a chart
// that is wrong rather than one that fails, which is why the craft and the dialect both matter.
const CROCHET_NAMED: { re: RegExp; type: string }[] = [
  { re: /^(?:sc2tog|sc\s*2\s*tog)$/i, type: 'sc2tog' },
  { re: /^(?:dc2tog|dc\s*2\s*tog)$/i, type: 'dc2tog' },
  { re: /^(?:sl\s*st|slst|ss|slip\s*stitch)$/i, type: 'slst' },
  { re: /^(?:hdc|half\s+double\s+crochet)$/i, type: 'hdc' },
  { re: /^(?:dc|double\s+crochet)$/i, type: 'dc' },
  { re: /^(?:tr|treble(?:\s+crochet)?|triple\s+crochet)$/i, type: 'tr' },
  { re: /^(?:sc|single\s+crochet)$/i, type: 'sc' },
  { re: /^(?:ch|chain)$/i, type: 'ch' },
  { re: /^(?:shell|fan)$/i, type: 'shell' },
];

// Every spelling of a crochet stitch, as one alternation, for the rules that need a name with
// something attached to it — a count in front, a multiplier, the word "increase". Anchored at both
// ends wherever it is used, so "dc" cannot win the first two letters of "double crochet".
const CROCHET_NAME =
  String.raw`sc\s*2\s*tog|sc2tog|dc\s*2\s*tog|dc2tog|slip\s*stitch|sl\s*st|slst|` +
  String.raw`half\s+double\s+crochet|hdc|double\s+crochet|dc|treble(?:\s+crochet)?|triple\s+crochet|tr|` +
  String.raw`single\s+crochet|sc|chain|ch|shell|fan|ss`;

const crochetType = (name: string): string | null =>
  CROCHET_NAMED.find((n) => n.re.test(name.trim().replace(/\s+/g, ' ')))?.type ?? null;

// Longest/most specific first: `k2tog` must never fall through to the generic `k<number>` rule.
// Spacing is optional throughout — "k2tog", "k2 tog" and "K 2 tog" are the same instruction typed
// by three different people.
const NAMED: { re: RegExp; type: string }[] = [
  { re: /^k\s*2\s*tog(?:\s*tbl)?$/i, type: 'k2tog' },
  { re: /^p\s*2\s*tog(?:\s*tbl)?$/i, type: 'p2tog' },
  { re: /^ssk$/i, type: 'ssk' },
  // "sl 1, k1, psso" and its abbreviations are an ssk by another name: the same two stitches
  // worked into one, leaning the same way. Written with commas it arrives here as one token
  // because JOINED_DECREASES glued it back together first.
  { re: /^(?:skp|skpo|sl\s*1,?\s*k\s*1,?\s*psso)$/i, type: 'ssk' },
  { re: /^kfb$/i, type: 'kfb' },
  // No entry of their own, but the same stitch count in and out as the entry they map to, which is
  // what the running count is built on. The chart glyph is the one thing that's approximate, and a
  // knitter who cares can change it — the alternative is refusing an ordinary row outright.
  { re: /^ssp$/i, type: 'p2tog' },
  { re: /^pfb$/i, type: 'kfb' },
  { re: /^m1l$/i, type: 'm1l' },
  { re: /^m1r$/i, type: 'm1r' },
  { re: /^m1p?$/i, type: 'm1l' }, // unspecified lean: pick left, the knitter can flip it
  { re: /^(?:yo|yfwd|yon|yrn|yf)$/i, type: 'yo' },
  { re: /^(?:pm|place\s+marker)$/i, type: 'pm' },
  // "inc"/"dec" name the shaping without naming the stitch. The count is what the chart is for, so
  // the commonest stitch for each is used and the knitter can swap it.
  { re: /^inc(?:rease)?\s*1?$/i, type: 'kfb' },
  { re: /^dec(?:rease)?\s*1?$/i, type: 'k2tog' },
];

// "sl 1, k1, psso" is a single decrease written as three comma-separated instructions, so splitting
// the row on commas takes it apart into pieces that mean nothing on their own. It is glued back
// together before the split, and NAMED reads the result.
const JOINED_DECREASES = /\bsl\s*1\s*,\s*k\s*1\s*,\s*psso\b/gi;

// Instructions about the fabric rather than the stitches: they consume nothing and add nothing, so
// the chart is identical with or without them. Leaving one out costs nothing — the row keeps its
// original wording either way — where refusing a whole row over a trailing "turn" costs the row.
const NO_OP =
  /^(?:turn(?:\s+(?:the\s+)?(?:work|your\s+work))?|do\s+not\s+turn\b.*|dnt|continue\s+working\b.*|break\s+(?:the\s+)?yarn|cut\s+(?:the\s+)?yarn|fasten\s*off|weave\s+in\b.*|join\s+to\s+work\s+in\s+the\s+round)$/i;

function parseToken(raw: string, craft: ParseCraft): PatternStitchGroup | null {
  const t = raw.trim().replace(/[.;]+$/, '').trim();
  if (!t) return null;

  if (craft !== 'knit') {
    const crocheted = parseCrochetToken(t);
    if (crocheted) return crocheted;
  }
  if (craft === 'crochet') return null;

  for (const { re, type } of NAMED) {
    if (re.test(t)) return group(type, 'exact', 1);
  }

  // "knit to last 2 sts" / "p to last st" / "knit to last 2 (2) 3 sts"
  //
  // And the same instruction with the count on the other side of the noun: "k to 1 st remaining",
  // "knit until 2 sts rem". Both spellings are ordinary in published patterns and mean exactly the
  // same thing, but only the first was read — which quietly cost a real import every shaping row
  // in a section, eleven of them, each one an increase. The second form has to name a number and
  // the stitches and the word "remaining", so it cannot swallow "knit to end" on its way past.
  const toLast =
    t.match(/^(k|knit|p|purl)\b.*?\b(?:to|until)\s+last\s+([\d()\s,]*?)\s*(?:sts?|stitches?)?$/i) ??
    t.match(
      /^(k|knit|p|purl)\b.*?\b(?:to|until)\s+([\d()\s,]+?)\s*(?:sts?|stitches?)\s*(?:remaining|remains|remain|rem)\.?$/i,
    );
  if (toLast) {
    const type = /^(k|knit)$/i.test(toLast[1]) ? 'knit' : 'purl';
    return group(type, 'to-last', parseSizeRun(toLast[2]) ?? 1);
  }

  // Work across everything left, however the pattern phrases it: "knit to end", "k to end of row",
  // "purl all sts", "knit across", "knit around" (a round rather than a row), bare "knit". The
  // trailing "sts"/"stitches" is common in descriptive patterns ("Purl all sts.") and would
  // otherwise sink the whole row.
  const END =
    /^(?:to\s+(?:the\s+)?end(?:\s+of\s+(?:the\s+)?(?:rows?|rnds?|rounds?))?|across|around|all)(?:\s+(?:the\s+)?(?:sts?|stitches|way))?$/i;
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

  // "sl1" / "sl 2" / "slip", with or without the modifier that says how to slip it — "sl1 wyif",
  // "slip 1 purlwise", "sl 1 as if to knit". Which way the stitch is slipped changes nothing about
  // the count, but a pattern that says so would otherwise have its whole row refused.
  const slip = t.match(
    /^(?:sl|slip)\s*(\d+)?(?:\s*(?:sts?|stitches))?(?:[\s,]*(?:wyif|wyib|wyb|p(?:ur)?lwise|pwise|k(?:nit)?wise|kwise|as\s+if\s+to\s+(?:knit|purl)|purlwise|knitwise))*$/i,
  );
  if (slip) return group('slip', 'exact', slip[1] ? parseInt(slip[1], 10) : 1);

  // "ktbl" / "ktbl2" / "k1 tbl" / "k tbl" — the number sits on either side of the abbreviation.
  const tbl = t.match(/^k\s*(\d+)?\s*tbl\s*(\d+)?$/i);
  if (tbl) {
    const count = tbl[1] ?? tbl[2];
    return group('ktbl', 'exact', count ? parseInt(count, 10) : 1);
  }

  // "BO all sts" / "cast off remaining sts" — the end of a piece, rather than a few stitches bound
  // off mid-row.
  const offAll = t.match(
    /^(?:bo|bind\s*off|cast\s*off)\s+(?:all|rem(?:aining)?|the\s+rem(?:aining)?|rest)(?:\s+(?:of\s+the\s+)?(?:sts?|stitches))?$/i,
  );
  if (offAll) return group('bo', 'all', null);

  // "BO 4" / "bind off 4" / "CO 6" / "cast on 6"
  const off = t.match(/^(?:bo|bind\s*off|cast\s*off)\s*(\d+)?(?:\s*(?:sts?|stitches))?$/i);
  if (off) return group('bo', 'exact', off[1] ? parseInt(off[1], 10) : 1);
  const on = t.match(/^(?:co|cast\s*on)\s*(\d+)?(?:\s*(?:sts?|stitches))?$/i);
  if (on) return group('co', 'exact', on[1] ? parseInt(on[1], 10) : 1);

  // Plain runs: "k2", "p10", "knit 3", "knit 2 sts", a per-size run "k2 (3) 4", and bare "k"/"p"
  // meaning one.
  const run = t.match(/^(k|knit|p|purl)\s*([\d()\s,]*?)\s*(?:sts?|stitches)?$/i);
  if (run) {
    const type = /^(k|knit)$/i.test(run[1]) ? 'knit' : 'purl';
    return group(type, 'exact', parseSizeRun(run[2]) ?? 1);
  }

  return null;
}

// One crochet token. Same shape of answer as the knitting rules above, so callers can't tell
// which vocabulary read it.
// "5x sc", "2x hdc", "7x SC" — the count in front with an x, which is how a great many crochet
// patterns are written and none of the rules below could read.
const CROCHET_TIMES = new RegExp(String.raw`^(\d+)\s*x\s*(${CROCHET_NAME})$`, 'i');

// "skip 2", "sk 1", "skip the first stitch", "skip the next 2 sts". A skipped stitch is consumed
// by the fabric and nothing is worked into it, so the row comes out shorter — which is why this
// cannot be quietly read as the knitter's "slip".
const CROCHET_SKIP =
  /^(?:sk|skip)\s*(?:the\s+|over\s+)?(?:first|next|last)?\s*(\d+)?\s*(?:sts?|stitch(?:es)?)?$/i;

// "dc incr", "sc increase" — two stitches worked into one, named by the stitch rather than by the
// count. Only the two the catalogue has a symbol and a delta for; anything else is refused rather
// than charted as something it isn't.
const CROCHET_INCREASE = /^(sc|dc|single\s+crochet|double\s+crochet)\s*(?:incr?|increase)$/i;

function parseCrochetToken(t: string): PatternStitchGroup | null {
  // A skip first: "sk" would otherwise never be reached, and reading it as anything else costs
  // the row its count.
  if (/^(?:sk|skip)\b/i.test(t)) {
    const skip = t.match(CROCHET_SKIP);
    if (!skip) return null;
    return group('skip', 'exact', skip[1] ? parseInt(skip[1], 10) : 1);
  }

  const times = t.match(CROCHET_TIMES);
  if (times) {
    const type = crochetType(times[2]);
    if (type) return group(type, 'exact', parseInt(times[1], 10));
  }

  const increase = t.match(CROCHET_INCREASE);
  if (increase) {
    const base = crochetType(increase[1]);
    if (base === 'sc' || base === 'dc') return group(base === 'sc' ? 'scinc' : 'dcinc', 'exact', 1);
    return null;
  }

  // "2 dc in next st" / "2 sc in each st" — an increase, and the commonest way crochet grows.
  //
  // "next" is one increase; "each" is one on every stitch of the row. Reading them the same way
  // is the difference between a round of 6 becoming 7 and becoming 12, so the word decides the
  // span rather than being skipped over.
  const intoOne = t.match(
    /^(\d+)\s*(sc|hdc|dc|tr)\b.*?\bin\s+(?:the\s+)?(next|each|every|all|same)\b/i,
  );
  if (intoOne) {
    const n = parseInt(intoOne[1], 10);
    const base = intoOne[2].toLowerCase();
    const across = /^(?:each|every|all)$/i.test(intoOne[3]);
    if (n === 2 && (base === 'sc' || base === 'dc')) {
      const type = base === 'sc' ? 'scinc' : 'dcinc';
      return across ? group(type, 'all', null) : group(type, 'exact', 1);
    }
    if (n === 5 && base === 'dc') {
      return across ? group('shell', 'all', null) : group('shell', 'exact', 1);
    }
    // Any other number into one stitch has no catalogue entry with the right delta, and charting
    // it as an ordinary stitch would quietly lose the increase. Refused, so the model gets it and
    // the knitter's wording is kept — the same bargain the knitting rules make.
    return null;
  }

  // "dc in each st across" / "sc in each stitch to end" — the whole row in one stitch type.
  const across = t.match(
    /^(?:\d+\s+)?(sc|hdc|dc|tr|sl\s*st|slst)\b.*?\b(?:in\s+)?(?:each|every|all)\b.*?(?:across|around|to\s+(?:the\s+)?end)?$/i,
  );
  if (across) {
    const type = CROCHET_NAMED.find((n) => n.re.test(across[1].replace(/\s+/g, '')))?.type;
    if (type) return group(type, 'all', null);
  }

  // "sc 6" / "6 sc" / "dc2" / "Chain 32" — a plain run, written either way round and with the
  // stitch named in full or in shorthand.
  const run = t.match(new RegExp(String.raw`^(?:(\d+)\s*)?(${CROCHET_NAME})\s*(\d*)$`, 'i'));
  if (run) {
    const type = crochetType(run[2]);
    if (type) {
      const count = run[1] || run[3];
      return group(type, 'exact', count ? parseInt(count, 10) : 1);
    }
  }

  // "slip stitch in row below", "sc in next st" — a single stitch with a note about where it
  // goes. Where it goes changes nothing about the count, and refusing the row over it would.
  const placed = t.match(
    new RegExp(String.raw`^(${CROCHET_NAME})\s+(?:in|into)\s+(?:the\s+)?[a-z0-9\s-]+$`, 'i'),
  );
  if (placed) {
    const type = crochetType(placed[1]);
    if (type) return group(type, 'exact', 1);
  }

  for (const { re, type } of CROCHET_NAMED) {
    if (re.test(t)) return group(type, 'exact', 1);
  }
  return null;
}

// Split on commas/semicolons that aren't inside brackets or *…*.
//
// Round brackets count as well as square ones. Crochet groups its repeats in them —
// "4x (dc, dc incr)" — and splitting on that comma tore the group into two halves that mean
// nothing apart. Per-size runs like "k2 (3) 4" are unaffected: their brackets balance inside the
// token, so the depth is back to zero by the time the next comma arrives.
function splitTokens(body: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let star = false;
  let buf = '';
  for (const ch of body) {
    if (ch === '[' || ch === '(') depth++;
    else if (ch === ']' || ch === ')') depth = Math.max(0, depth - 1);
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

export function parseSectionText(text: string, craft: ParseCraft = 'knit'): ParseResult {
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

  // Emit `total` rows by cycling `block`, after whatever pending rows sat outside it, renumbering
  // as they land. Fresh ids throughout: two rows must never share one.
  type Pending = (typeof pending)[number];
  const emit = (block: Pending[], kept: Pending[], total: number) => {
    if (block.length === 0) {
      flush();
      return false;
    }
    for (const p of kept) {
      rows.push(p.row);
      expectedCounts.push(p.expected);
    }
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

  // The block named by number — "rows 1-2", "1st – 4th row".
  const expand = (from: number, to: number, passes: number, cycleTo?: number) => {
    const block = pending.filter((p) => p.ordinal >= from && p.ordinal <= to);
    const kept = pending.filter((p) => p.ordinal < from || p.ordinal > to);
    return emit(block, kept, cycleTo ?? block.length * passes);
  };

  // The block named by position — "rep last 2 rows 4 times".
  const expandLast = (count: number, passes: number) => {
    const n = Math.max(1, Math.min(count, pending.length));
    const cut = pending.length - n;
    return emit(pending.slice(cut), pending.slice(0, cut), n * passes);
  };

  for (const trimmed of normalizedLines(text)) {
    if (!trimmed) continue;

    // A repeat instruction multiplies the block above it, so it's handled before anything else.
    // The row-count form ("until you have worked a total of 23 rows") is tried first: it says
    // exactly how long the section ends up, where a repeat count has to be multiplied out.
    const repeatUntil = trimmed.match(BLOCK_REPEAT_UNTIL);
    const repeatTimes = repeatUntil ? null : trimmed.match(BLOCK_REPEAT_TIMES);
    const repeatLast = repeatUntil || repeatTimes ? null : trimmed.match(BLOCK_REPEAT_LAST);
    if (repeatTimes || repeatUntil || repeatLast) {
      // Every one of these counts is written per size as often as not: "a total of 7 (8) 8 times".
      const run = repeatCount(
        repeatUntil
          ? [repeatUntil[3]]
          : repeatTimes
            ? repeatTimes.slice(4, 7)
            : repeatLast!.slice(3, 6),
      );
      const first = Math.max(1, run == null ? 1 : sizeValue(run, 0));
      let ok: boolean;
      if (repeatUntil) {
        ok = expand(parseInt(repeatUntil[1], 10), parseInt(repeatUntil[2], 10), 0, first);
      } else if (repeatTimes) {
        ok = expand(
          parseInt(repeatTimes[2], 10),
          parseInt(repeatTimes[3], 10),
          passesFor(trimmed, repeatTimes[1], first),
        );
      } else {
        ok = expandLast(parseInt(repeatLast![2], 10), passesFor(trimmed, repeatLast![1], first));
      }
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

    // "Cast on 6 (6) 7 sts", or "Chain 32" — the count the whole chart starts from, stated in prose.
    const co = trimmed.match(CAST_ON_LINE) ?? trimmed.match(FOUNDATION_CHAIN_LINE);
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

    const header = matchRowHeader(trimmed, craft);
    if (!header) {
      ignoredLines.push(trimmed);
      continue;
    }

    const { from, to, parenthetical } = header;
    const rawBody = header.body;
    let body = rawBody.replace(JOINED_DECREASES, 'skp');

    // Numbering restarting at 1 means a new block began, and whatever was pending was never
    // repeated — emit it as written.
    if (from === 1 && pending.length > 0) flush();

    // Pull off a stated stitch count before tokenising, so it isn't mistaken for a stitch — unless
    // the "n sts" at the end *is* the last instruction: "purl 4 sts", "knit to last 2 sts". Those
    // read as stitches and a stated count never does, which is the whole of the difference.
    let expected: number | null = null;
    const stated = body.match(STATED_COUNT);
    // Brackets settle it — "(12 sts)" is a pattern counting itself, never an instruction.
    const tail = splitTokens(body).at(-1) ?? '';
    if (stated && (stated[0].includes('(') || parseToken(tail, craft) === null)) {
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
          // "turn", "break yarn" and the like are about the fabric, not the stitches: nothing to
          // chart, and nothing lost by charting nothing, since the wording stays on the row.
          if (NO_OP.test(token.trim().replace(/[.;]+$/, ''))) continue;

          // Trimmed and de-punctuated first. BRACKET_REPEAT is anchored at both ends, so a
          // leading space or the full stop that ends a sentence — "…] x 3." — made it miss, in
          // knitting just as much as in crochet.
          const clean = token.trim().replace(/[.;]+$/, '');
          const ahead = clean.match(REPEAT_FIRST);
          // Same repeat either way round, so the two forms are normalised to one shape here
          // rather than handled twice below.
          const bracket = ahead
            ? ([ahead[0], ahead[2], ahead[1]] as unknown as RegExpMatchArray)
            : clean.match(BRACKET_REPEAT);
          if (bracket) {
            const inner = splitTokens(bracket[1]);
            const times = Math.max(1, Math.min(parseInt(bracket[2], 10) || 1, 200));
            const parsedInner = inner.map((tok) => parseToken(tok, craft));
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

          const parsed = parseToken(token, craft);
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

  // A crochet pattern in a section set to knitting reads as row after row of nothing, because the
  // crochet vocabulary is never tried — and the refusals blame the stitches rather than the
  // setting that caused them. Only asked when every row failed, so it costs a second parse in the
  // one case that is already going badly.
  if (craft === 'knit' && rows.length > 0 && rows.every((r) => r.stitches.length === 0)) {
    const asCrochet = parseSectionText(text, 'crochet');
    if (asCrochet.rows.some((r) => r.stitches.length > 0)) {
      issues.unshift({
        rowIndex: null,
        message:
          'These rows read as crochet, and this section is set to knitting — so none of the ' +
          "stitches were recognised. Set the pattern's craft to crochet and convert again.",
      });
    }
  }

  if (rows.length === 0) {
    issues.push({
      rowIndex: null,
      message:
        'No rows found. A row needs to start with its number — "Row 1:", "R1:", "1st row:" or ' +
        '"Rnd 1:" all work.',
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
