import { parseSectionText } from '@/lib/parse-pattern-text';
import { rowStitchesAfter } from '@/lib/knitwit-helpers';

const chart = (text: string) => parseSectionText(text, 'crochet');

describe('crochet shorthand', () => {
  it('reads a plain row', () => {
    const r = chart('Row 1: ch 1, sc in each st across.');
    expect(r.issues).toEqual([]);
    expect(r.rows[0].stitches.map((g) => g.type)).toEqual(['ch', 'sc']);
  });

  it('counts an amigurumi increase round', () => {
    const r = chart('Round 2: 2 sc in each st around. (12 sts)');
    expect(r.rows[0].stitches[0].type).toBe('scinc');
    // Six stitches in, each doubled, twelve out — the running count comes free.
    expect(rowStitchesAfter(r.rows[0], 6)).toBe(12);
  });

  it('counts a decrease round', () => {
    const r = chart('Round 8: sc2tog, sc2tog, sc2tog.');
    expect(rowStitchesAfter(r.rows[0], 6)).toBe(3);
  });

  it('reads a run written either way round', () => {
    const a = chart('Row 1: sc 6, dc 4.');
    const b = chart('Row 1: 6 sc, 4 dc.');
    expect(a.rows[0].stitches.map((g) => [g.type, g.count])).toEqual([['sc', 6], ['dc', 4]]);
    expect(b.rows[0].stitches.map((g) => [g.type, g.count])).toEqual([['sc', 6], ['dc', 4]]);
  });

  it('reads a bracket repeat the same way knitting does', () => {
    const r = chart('Row 3: [sc, 2 sc in next st] x 3.');
    expect(r.issues).toEqual([]);
    expect(rowStitchesAfter(r.rows[0], 9)).toBe(12);
  });

  it('does not read knitting as crochet', () => {
    const r = chart('Row 1: k2, p2.');
    expect(r.rows[0].stitches).toEqual([]);
  });

  it('does not read crochet as knitting', () => {
    const r = parseSectionText('Row 1: sc in each st across.', 'knit');
    expect(r.rows[0].stitches).toEqual([]);
  });

  it('reads both when the pattern uses both', () => {
    const r = parseSectionText('Row 1: k4, sl st, sc 2.', 'both');
    expect(r.issues).toEqual([]);
    expect(r.rows[0].stitches.map((g) => g.type)).toEqual(['knit', 'slst', 'sc']);
  });
});

// A real pattern, transcribed by the knitter who was working it. Every row of it was refused: the
// rows were found — the numbering read fine — and then not one stitch in them was recognised, so
// the chart came out empty with "No stitches" against all 23 rows.
describe('a crochet pattern as it is actually written', () => {
  it('reads the foundation chain as what the rows count from', () => {
    // Crochet's cast-on under another name, and the reason the chart started from zero.
    expect(parseSectionText('Chain 32\nr1: 5x sc', 'crochet').castOn).toBe(32);
    expect(parseSectionText('ch 32 (34) 36\nr1: 5x sc', 'crochet').castOn).toEqual([32, 34, 36]);
  });

  // "ch 2, turn" inside a row is not a foundation chain, and reading it as one would reset the
  // count the section is built on.
  it("does not mistake a row's own chain for the foundation", () => {
    const r = chart('Chain 20\nr1: ch 2, 4x sc, turn');
    expect(r.castOn).toBe(20);
    expect(r.rows[0].stitches.map((g) => `${g.type}:${g.count}`)).toEqual([
      'ch:2',
      'sc:4',
    ]);
  });

  it('reads a skipped stitch, which takes one off the row', () => {
    for (const token of ['skip 2', 'sk 2', 'skip the next 2 sts', 'skip 2 stitches']) {
      expect(chart(`r1: ${token}`).rows[0].stitches[0]).toMatchObject({ type: 'skip', count: 2 });
    }
    // The commonest way a row opens, and the token every row of the pattern above started with.
    expect(chart('r1: skip the first stitch').rows[0].stitches[0]).toMatchObject({
      type: 'skip',
      count: 1,
    });
  });

  // Skip is not slip: one passes a stitch over, the other works it. Reading either as the other
  // puts the running count out by one per stitch.
  it('counts a skip as one fewer stitch, and a slip stitch as the same', () => {
    expect(rowStitchesAfter(chart('r1: skip 2, 8x sc').rows[0], 10)).toBe(8);
    expect(rowStitchesAfter(chart('r1: 10x sl st').rows[0], 10)).toBe(10);
  });

  it('reads the count written in front with an x', () => {
    expect(chart('r1: 5x sc, 2x hdc, 7x SC').rows[0].stitches.map((g) => `${g.type}:${g.count}`)).toEqual([
      'sc:5',
      'hdc:2',
      'sc:7',
    ]);
  });

  it('reads a stitch named in full, with its count either side', () => {
    expect(chart('r1: Chain 3, 2 dc, single crochet 4, slip stitch').rows[0].stitches.map((g) => `${g.type}:${g.count}`)).toEqual([
      'ch:3',
      'dc:2',
      'sc:4',
      'slst:1',
    ]);
  });

  it('reads an increase named by its stitch', () => {
    expect(chart('r1: dc incr, sc incr, dc increase').rows[0].stitches.map((g) => g.type)).toEqual([
      'dcinc',
      'scinc',
      'dcinc',
    ]);
  });

  // The group that crochet writes with round brackets and the count in front. Splitting the row on
  // that comma tore it in half, and neither half meant anything.
  it('expands a bracketed group with the count in front', () => {
    expect(chart('r1: 4x (dc, dc incr)').rows[0].stitches.map((g) => g.type)).toEqual([
      'dc', 'dcinc', 'dc', 'dcinc', 'dc', 'dcinc', 'dc', 'dcinc',
    ]);
    // And the same group with the count after it, either bracket.
    expect(chart('r1: (dc, dc incr) x 2').rows[0].stitches.map((g) => g.type)).toEqual([
      'dc', 'dcinc', 'dc', 'dcinc',
    ]);
    // Nested counts inside the group.
    expect(chart('r1: 3x (dc incr, 2x dc)').rows[0].stitches.map((g) => `${g.type}:${g.count}`)).toEqual([
      'dcinc:1', 'dc:2', 'dcinc:1', 'dc:2', 'dcinc:1', 'dc:2',
    ]);
  });

  it('reads a stitch told where to go', () => {
    expect(chart('r1: slip stitch in row below, 2x sc').rows[0].stitches.map((g) => g.type)).toEqual([
      'slst',
      'sc',
    ]);
  });

  it('works past an instruction about the work rather than the stitches', () => {
    const r = chart('r1: Do not turn work continue working in the same direction');
    expect(r.issues).toEqual([]);
    expect(r.rows[0].stitches).toEqual([]);
    expect(r.rows[0].instruction).toContain('Do not turn');
  });

  // The whole row, as the knitter wrote it.
  it('charts a full row of the real thing', () => {
    const r = chart(
      'r21: skip 1, 8x sc, 2x hdc, 4x (dc, dc incr), 2x dc, , 2x hdc, 4x sc, slip stitch in row below, turn',
    );
    expect(r.issues).toEqual([]);
    expect(r.rows[0].stitches.map((g) => g.type)).toEqual([
      'skip', 'sc', 'hdc',
      'dc', 'dcinc', 'dc', 'dcinc', 'dc', 'dcinc', 'dc', 'dcinc',
      'dc', 'hdc', 'sc', 'slst',
    ]);
  });

  // Two things this pattern contains that nothing should pretend to understand: a typo, and a
  // stitch the catalogue has no entry for. Both name the token, so the knitter can see which word
  // it was — and the row keeps its wording for the model to read.
  it('still refuses what it cannot chart, and says which word', () => {
    const typo = chart('r20: 5x dc, dc inr, 3x hdc');
    expect(typo.rows[0].stitches).toEqual([]);
    expect(typo.issues[0].message).toContain('dc inr');

    const noEntry = chart('r22: 4x dc, (dc + hdc) incr, 3x hdc');
    expect(noEntry.rows[0].stitches).toEqual([]);
    expect(noEntry.issues[0].message).toContain('dc + hdc');
  });
});

// A crochet pattern pasted into a section that is set to knitting reads as row after row of
// nothing, and the refusals blame the stitches rather than the setting behind them.
describe('the wrong craft', () => {
  it('says so when every row would read as crochet', () => {
    const r = parseSectionText('r1: skip 1, 8x sc, 2x hdc\nr2: 4x dc, slip stitch', 'knit');
    expect(r.rows.every((row) => row.stitches.length === 0)).toBe(true);
    expect(r.issues[0].message).toContain('read as crochet');
  });

  it('says nothing of the sort about knitting that simply has a bad row', () => {
    const r = parseSectionText('Row 1: k2, frobnicate 3', 'knit');
    expect(r.issues.some((i) => i.message.includes('read as crochet'))).toBe(false);
  });
});
