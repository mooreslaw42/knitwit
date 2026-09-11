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
