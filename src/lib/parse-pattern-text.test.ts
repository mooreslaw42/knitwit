import { parseSectionText, reconcileRowCounts } from '@/lib/parse-pattern-text';

// Compact view of a parsed row for assertions.
const shape = (text: string) =>
  parseSectionText(text).rows.map((r) => ({
    label: r.label,
    side: r.side,
    stitches: r.stitches.map((g) => `${g.type}:${g.span}:${g.count ?? '-'}`),
  }));

describe('parseSectionText', () => {
  it('reads a row header with an explicit side and plain runs', () => {
    expect(shape('Row 1 (RS): K2, p4, k2.')).toEqual([
      {
        label: 'Row 1',
        side: 'RS',
        stitches: ['knit:exact:2', 'purl:exact:4', 'knit:exact:2'],
      },
    ]);
  });

  it('infers the side from the row number when the pattern does not state it', () => {
    const rows = shape('Row 1: knit\nRow 2: purl');
    expect(rows.map((r) => r.side)).toEqual(['RS', 'WS']);
  });

  it('reads to-end and to-last spans', () => {
    expect(shape('Row 1: K1, knit to last 2 sts, k1')).toEqual([
      {
        label: 'Row 1',
        side: 'RS',
        stitches: ['knit:exact:1', 'knit:to-last:2', 'knit:exact:1'],
      },
    ]);
    expect(shape('Row 3: purl to end')[0].stitches).toEqual(['purl:all:-']);
  });

  it('never mistakes a named stitch for a plain run', () => {
    // The classic trap: k2tog must not parse as "k" followed by "2tog".
    expect(shape('Row 1: k2tog, ssk, yo, kfb, M1L, M1R, sl1, ktbl')[0].stitches).toEqual([
      'k2tog:exact:1',
      'ssk:exact:1',
      'yo:exact:1',
      'kfb:exact:1',
      'm1l:exact:1',
      'm1r:exact:1',
      'slip:exact:1',
      'ktbl:exact:1',
    ]);
  });

  it('expands a fixed-multiplier repeat, which is count-independent', () => {
    expect(shape('Row 1: [k2, p2] 3 times')[0].stitches).toEqual([
      'knit:exact:2',
      'purl:exact:2',
      'knit:exact:2',
      'purl:exact:2',
      'knit:exact:2',
      'purl:exact:2',
    ]);
  });

  it('expands a row range into one row each, keeping the instruction', () => {
    const result = parseSectionText('Rows 5-8: knit');
    expect(result.rows.map((r) => r.label)).toEqual(['Row 5', 'Row 6', 'Row 7', 'Row 8']);
    expect(result.rows.every((r) => r.instruction === 'knit')).toBe(true);
  });

  it('refuses a count-dependent repeat rather than inventing stitches, keeping the wording', () => {
    const result = parseSectionText('Row 1: K2, *yo, k2tog; rep from * to last 2 sts, k2.');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].stitches).toEqual([]);
    // Nothing the knitter wrote is lost.
    expect(result.rows[0].instruction).toContain('rep from *');
    expect(result.issues[0].message).toMatch(/rep from \*/);
  });

  // A real import lost every shaping row of a section — eleven increases — because the pattern
  // said "to 1 st remaining" where the parser only knew "to last 1 st". They are the same
  // instruction, and a row the parser cannot read is refused whole, so the loss was total.
  it('reads a to-last span with the count on either side of the noun', () => {
    const both = [
      'Row 1 (RS): K to last 1 st, M1R, k1.',
      'Row 1 (RS): K to 1 st remaining, M1R, k1.',
      'Row 1 (RS): K until 1 st remains, M1R, k1.',
      'Row 1 (RS): K to 1 st rem, M1R, k1.',
    ];
    for (const text of both) {
      expect(shape(text)[0].stitches).toEqual(['knit:to-last:1', 'm1r:exact:1', 'knit:exact:1']);
    }
  });

  it('keeps the plural and the per-size run in the remaining form', () => {
    expect(shape('Row 1: Knit to 2 sts remaining, k2tog.')[0].stitches).toEqual([
      'knit:to-last:2',
      'k2tog:exact:1',
    ]);
    // Per-size runs survive here exactly as they do in the "to last" form — one count per size,
    // not the first one flattened over all of them.
    expect(shape('Row 1: Knit to 2 (2) 3 sts remaining, k1.')[0].stitches[0]).toBe(
      'knit:to-last:2,2,3',
    );
  });

  // The looser second form must not start eating spans that mean something else.
  it('still reads a whole-row instruction as a whole row', () => {
    expect(shape('Row 1: knit to end')[0].stitches).toEqual(['knit:all:-']);
    expect(shape('Row 2: purl all sts')[0].stitches).toEqual(['purl:all:-']);
  });

  it('refuses a row with an unreadable token instead of dropping it silently', () => {
    const result = parseSectionText('Row 1: k2, frobnicate 3, k2');
    expect(result.rows[0].stitches).toEqual([]);
    expect(result.issues[0].message).toContain('frobnicate');
    expect(result.rows[0].instruction).toContain('frobnicate');
  });

  it('strips a stated stitch count instead of reading it as a stitch', () => {
    const result = parseSectionText('Row 1: K1, M1L, knit to last st, M1R, K1. (22 sts)');
    expect(result.expectedCounts).toEqual([22]);
    expect(result.rows[0].stitches.map((g) => g.type)).toEqual([
      'knit',
      'm1l',
      'knit',
      'm1r',
      'knit',
    ]);
  });

  it('keeps non-row lines aside rather than treating them as rows', () => {
    const result = parseSectionText('SLEEVE\nWork in the round.\nRow 1: knit');
    expect(result.rows).toHaveLength(1);
    expect(result.ignoredLines).toEqual(['SLEEVE', 'Work in the round.']);
  });

  it('reports when nothing row-like was found', () => {
    expect(parseSectionText('Just some prose.').issues[0].message).toMatch(/No rows found/);
  });
});

// The shorthand a knitter actually types. A pattern written "R21: k2, p2" throughout used to parse
// to *zero* rows, and the only thing it said was that no rows had been found — the notation was the
// whole of the problem, and every row in the pattern was lost to it.
describe('row headers, in every notation', () => {
  const labels = (text: string) => parseSectionText(text).rows.map((r) => r.label);

  it('reads a row numbered with a bare R, spaced or not', () => {
    for (const text of ['R1: k2, p2', 'r1: k2, p2', 'R 1: k2, p2', 'Row1: k2, p2']) {
      expect(shape(text)[0].stitches).toEqual(['knit:exact:2', 'purl:exact:2']);
    }
  });

  it('keeps the row number the pattern gave it', () => {
    expect(labels('r21: knit')).toEqual(['Row 21']);
  });

  it('reads a row with no separator at all', () => {
    // "r21 k to end" — nothing but a space between the number and the instruction.
    expect(shape('r21 k to end')[0].stitches).toEqual(['knit:all:-']);
    expect(labels('r21 k to end')).toEqual(['Row 21']);
  });

  it('reads the other separators patterns use', () => {
    for (const text of ['Row 1) knit', 'R1. knit', 'Row 1 – knit', 'Row 1 = knit']) {
      expect(shape(text)[0].stitches).toEqual(['knit:all:-']);
    }
  });

  it('reads rounds as readily as rows', () => {
    expect(labels('Rnd1: knit\nRnd 2: knit\nRound 3: knit\nR4: knit')).toHaveLength(4);
  });

  it('reads a range however it is written', () => {
    for (const text of ['Rows 1-4: knit', 'R1-R4: knit', 'Rows 1 to 4: knit', 'Rows 1–4: knit']) {
      expect(labels(text)).toEqual(['Row 1', 'Row 2', 'Row 3', 'Row 4']);
    }
    expect(labels('Rows 1 and 2: knit')).toEqual(['Row 1', 'Row 2']);
  });

  it('reads a plainly numbered list', () => {
    expect(shape('1: knit')[0].stitches).toEqual(['knit:all:-']);
    expect(shape('1) knit')[0].stitches).toEqual(['knit:all:-']);
  });

  // "1." is a numbered prose step far more often than it is a row, and reading it as one would turn
  // a set-up instruction into a row that charts nothing.
  it('does not mistake a numbered prose step for a row', () => {
    const result = parseSectionText('1. Cast on 20 sts.\n2: knit');
    expect(result.rows.map((r) => r.label)).toEqual(['Row 2']);
    expect(result.castOn).toBe(20);
  });

  it('finds the side wherever the pattern put it', () => {
    for (const text of [
      'Row 1 (WS): purl',
      'Row 1 [WS]: purl',
      'Row 1 WS: purl',
      'Row 1 (WS row): purl',
      'Row 1: (WS) purl',
    ]) {
      expect(shape(text)[0].side).toBe('WS');
    }
  });

  // The loose form has no punctuation to prove it is a row, so prose that opens with a row number
  // must not become one — it would chart nothing and claim a row the pattern never had.
  it('leaves prose about rows as prose', () => {
    for (const text of [
      'Round 2 is worked in the round.',
      'Rows 1 and 2 form the pattern repeat.',
      'Row 4 of the chart is where the cable crosses.',
    ]) {
      const result = parseSectionText(text);
      expect(result.rows).toHaveLength(0);
      expect(result.ignoredLines).toEqual([text]);
    }
  });

  // Copy a pattern out of a PDF and the rows arrive run together, with whatever spaces and bullets
  // the layout left behind.
  it('separates rows that arrived on one line', () => {
    const result = parseSectionText('Row 1: knit. Row 2: purl. Row 3: knit.');
    expect(result.rows.map((r) => r.label)).toEqual(['Row 1', 'Row 2', 'Row 3']);
    expect(result.rows[1].stitches[0]).toMatchObject({ type: 'purl', span: 'all' });
  });

  it('copes with a non-breaking space and a bullet', () => {
    expect(shape('\u2022 R\u00a01: k2,\u00a0p2')[0].stitches).toEqual([
      'knit:exact:2',
      'purl:exact:2',
    ]);
  });

  it('says what a row should look like when it finds none', () => {
    expect(parseSectionText('Just some prose.').issues[0].message).toContain('"R1:"');
  });
});

describe('stitch shorthand', () => {
  it('reads a decrease however it is spaced', () => {
    expect(shape('R1: k2 tog, p 2 tog, K 2 TOG')[0].stitches).toEqual([
      'k2tog:exact:1',
      'p2tog:exact:1',
      'k2tog:exact:1',
    ]);
  });

  it('reads a run written with its stitches spelled out', () => {
    expect(shape('R1: knit 2 sts, purl 4 sts, k1')[0].stitches).toEqual([
      'knit:exact:2',
      'purl:exact:4',
      'knit:exact:1',
    ]);
  });

  it('reads a slip with the modifier that says how to slip it', () => {
    for (const token of ['sl1 wyif', 'sl 1 purlwise', 'slip 1 pwise', 'sl1 as if to knit']) {
      expect(shape(`R1: ${token}, k to end`)[0].stitches).toEqual([
        'slip:exact:1',
        'knit:all:-',
      ]);
    }
  });

  it('reads "sl 1, k1, psso" as the one decrease it is', () => {
    expect(shape('R1: sl 1, k1, psso, knit to end')[0].stitches).toEqual([
      'ssk:exact:1',
      'knit:all:-',
    ]);
    expect(shape('R1: skp, knit to end')[0].stitches[0]).toBe('ssk:exact:1');
  });

  it('reads a shaping named without its stitch', () => {
    expect(shape('R1: inc, k to last st, dec')[0].stitches).toEqual([
      'kfb:exact:1',
      'knit:to-last:1',
      'k2tog:exact:1',
    ]);
  });

  it('reads ktbl with the number on either side', () => {
    expect(shape('R1: ktbl2, k1 tbl, ktbl')[0].stitches).toEqual([
      'ktbl:exact:2',
      'ktbl:exact:1',
      'ktbl:exact:1',
    ]);
  });

  it('binds off the whole row when the pattern says so', () => {
    expect(shape('R1: k2, BO all sts')[0].stitches).toEqual(['knit:exact:2', 'bo:all:-']);
    expect(shape('R1: cast off remaining sts')[0].stitches).toEqual(['bo:all:-']);
  });

  // "turn" is not a stitch and charts nothing, but it used to cost the whole row.
  it('works past an instruction about the fabric rather than the stitches', () => {
    const result = parseSectionText('R1: k2, p2, turn');
    expect(result.rows[0].stitches.map((g) => g.type)).toEqual(['knit', 'purl']);
    expect(result.issues).toEqual([]);
    // Nothing is lost: the row still says what the knitter wrote.
    expect(result.rows[0].instruction).toContain('turn');
  });

  it('reads crochet shorthand through a round header', () => {
    const result = parseSectionText('Rnd1: ch 2, dc in each st around, turn', 'crochet');
    expect(result.rows[0].stitches.map((g) => `${g.type}:${g.span}`)).toEqual([
      'ch:exact',
      'dc:all',
    ]);
  });

  // A trailing "4 sts" is a count of the row about half the time and the last instruction in it the
  // other half. Reading "purl 4 sts" as a count silently drops four stitches off the row.
  it('tells a stated count from an instruction that ends in stitches', () => {
    expect(parseSectionText('R1: k2, p2. (4 sts)').expectedCounts).toEqual([4]);
    expect(parseSectionText('R1: k2tog, k to end. 47 sts.').expectedCounts).toEqual([47]);
    expect(parseSectionText('R1: knit 2 sts, purl 4 sts').expectedCounts).toEqual([null]);
    expect(parseSectionText('Rnd1: 2 sc in each st around (12 sts)', 'crochet').expectedCounts).toEqual([
      12,
    ]);
  });

  // The point of all of it: a pattern in shorthand reconciles against its own stated counts, which
  // is what makes the chart trustworthy rather than merely present.
  it('reconciles a shorthand pattern against the counts it states', () => {
    const text = [
      'Cast on 20 sts.',
      'R1 (RS): K1, M1L, k to last st, M1R, K1. (22 sts)',
      'R2 (WS): p to end. 22 sts.',
      'R3: k2tog, k to last 2 sts, ssk. (20 sts)',
    ].join('\n');
    const result = parseSectionText(text);
    expect(result.castOn).toBe(20);
    expect(result.rows).toHaveLength(3);
    expect(reconcileRowCounts(result.rows, result.expectedCounts, 20)).toEqual([]);
  });
});

describe('repeating a block of rows', () => {
  const knitBlock = 'Rows 1-2: knit';

  // "Repeat" and "work" do not mean the same number of passes, and a house rule for both would make
  // every section written the other way a repeat too long or too short.
  it('reads a plain repeat as passes on top of the rows as written', () => {
    expect(parseSectionText(`${knitBlock}\nRepeat rows 1-2 4 times.`).rows).toHaveLength(10);
    expect(parseSectionText(`${knitBlock}\nRep rows 1-2 4 more times.`).rows).toHaveLength(10);
  });

  it('reads "a total of" and "work" as the whole of what to work', () => {
    expect(parseSectionText(`${knitBlock}\nWork rows 1-2 4 times.`).rows).toHaveLength(8);
    expect(parseSectionText(`${knitBlock}\nRepeat rows 1-2 a total of 4 times.`).rows).toHaveLength(
      8,
    );
  });

  it('reads the row numbers in shorthand', () => {
    expect(parseSectionText(`${knitBlock}\nRep R1-R2 x 3`).rows).toHaveLength(8);
    expect(parseSectionText(`${knitBlock}\nRepeat rows 1 and 2 three times`).rows).toHaveLength(8);
  });

  it('reads a block named by position rather than by number', () => {
    const text = 'Row 1: knit\nRow 2: purl\nRep last 2 rows twice more.';
    const rows = parseSectionText(text).rows;
    expect(rows).toHaveLength(6);
    expect(rows.map((r) => r.stitches[0].type)).toEqual([
      'knit',
      'purl',
      'knit',
      'purl',
      'knit',
      'purl',
    ]);
  });

  // "Until it measures 24 cm" is a length, not a count. Guessing one would be worse than leaving
  // the instruction where the knitter can read it.
  it('leaves a repeat it cannot count alone', () => {
    const result = parseSectionText(`${knitBlock}\nRepeat rows 1-2 until it measures 24 cm.`);
    expect(result.rows).toHaveLength(2);
    expect(result.ignoredLines).toEqual(['Repeat rows 1-2 until it measures 24 cm.']);
  });
});

describe('reconcileRowCounts', () => {
  it('passes when the parse agrees with the count the pattern states', () => {
    const { rows, expectedCounts } = parseSectionText(
      'Row 1: K1, M1L, knit to last st, M1R, K1. (22 sts)',
    );
    expect(reconcileRowCounts(rows, expectedCounts, 20)).toEqual([]);
  });

  it('flags a row whose parsed stitch count contradicts the pattern', () => {
    const { rows, expectedCounts } = parseSectionText(
      'Row 1: K1, M1L, knit to last st, M1R, K1. (30 sts)',
    );
    const issues = reconcileRowCounts(rows, expectedCounts, 20);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('pattern says 30 sts');
    expect(issues[0].message).toContain('gives 22');
  });

  it('carries the running count across rows', () => {
    const { rows, expectedCounts } = parseSectionText(
      ['Row 1: K1, M1L, knit to last st, M1R, K1. (22 sts)', 'Row 2: purl to end (22 sts)'].join(
        '\n',
      ),
    );
    expect(reconcileRowCounts(rows, expectedCounts, 20)).toEqual([]);
  });
});

// Descriptive patterns — the style most European patterns are written in. They number rows as
// ordinals, define a short block and then say how many times to work it, and state cast-on and
// running stitch counts in prose rather than in fields. Before this was handled, a pattern like
// this parsed to *zero* rows — and since the AI step only ever sees rows the parser refused, zero
// rows meant no way forward at all.
describe('descriptive patterns', () => {
  const STRAP = `Cast on 6 (6) 7 (7) 9 (9) 10 (12) sts using 3 mm [US 2.5] needles.
Now work back and forth in stocking stitch to make the strap. First row is a WS row.
1st row (WS row): Purl all sts.
2nd row (RS row): Knit all sts.
Repeat 1st – 2nd row until you have worked a total of 23 (25) 25 (23) 21 (19) 19 (19) rows of stocking stitch.
Now increase to shape the neckline. First, increase every 4th row.
1st row (RS row): K1, M1L, k to end of row.
2nd row (WS row): Purl all sts.
3rd row (RS row): Knit all sts.
4th row (WS row): Purl all sts.
Work 1st – 4th row a total of 7 (8) 8 (8) 9 (9) 9 (10) times.
You now have 13 (14) 15 (15) 18 (18) 19 (22) sts on your needles.
Now increase every 2nd, ie. every other row.
1st row (RS row): K1, M1L, k to end of row.
2nd row (WS row): Purl all sts.
Work 1st – 2nd row a total of 4 (4) 5 (5) 6 (7) 8 (8) times.
You now have 17 (18) 20 (20) 24 (25) 27 (30) sts on your needles.`;

  it('reads ordinal row headers', () => {
    const result = parseSectionText('1st row (WS row): Purl all sts.\n2nd row (RS row): Knit all sts.');
    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((r) => r.side)).toEqual(['WS', 'RS']);
    expect(result.rows[0].stitches[0]).toMatchObject({ type: 'purl', span: 'all' });
  });

  it('reads "k to end of row" and "Purl all sts", which the shorthand rules missed', () => {
    const result = parseSectionText('1st row (RS row): K1, M1L, k to end of row.');
    expect(result.rows[0].stitches.map((g) => `${g.type}:${g.span}`)).toEqual([
      'knit:exact',
      'm1l:exact',
      'knit:all',
    ]);
  });

  it('takes the cast-on out of the prose, for every size', () => {
    expect(parseSectionText(STRAP).castOn).toEqual([6, 6, 7, 7, 9, 9, 10, 12]);
  });

  it('expands a repeated block instead of charting the definition once', () => {
    // 23 rows of strap, then 7 passes of a 4-row block, then 4 of a 2-row block.
    expect(parseSectionText(STRAP).rows).toHaveLength(23 + 28 + 8);
  });

  it('charts every row of the repeat, not just the first pass', () => {
    const rows = parseSectionText(STRAP).rows;
    expect(rows.every((r) => r.stitches.length > 0)).toBe(true);
    // Row 24 opens the first increase block: K1, M1L, knit to end.
    expect(rows[23].stitches.map((g) => g.type)).toEqual(['knit', 'm1l', 'knit']);
  });

  it('says so when a repeat is a different length per size', () => {
    const issues = parseSectionText(STRAP).issues;
    expect(issues).toHaveLength(3);
    expect(issues[0].message).toContain('differs per size');
  });

  // The whole point: an independent check that the reading is right, not merely plausible.
  it('reconciles against the stitch counts the pattern states about itself', () => {
    const result = parseSectionText(STRAP);
    expect(reconcileRowCounts(result.rows, result.expectedCounts, 6)).toEqual([]);
  });

  it('attaches a prose stitch count to the row it follows', () => {
    const result = parseSectionText(STRAP);
    // 23 strap rows + 28 increase rows → the "13 sts" check lands on the last of them.
    expect(result.expectedCounts[50]).toBe(13);
    expect(result.expectedCounts[58]).toBe(17);
  });

  it('emits a block as written when no repeat instruction follows it', () => {
    const result = parseSectionText('1st row: knit\n2nd row: purl');
    expect(result.rows).toHaveLength(2);
  });
});
