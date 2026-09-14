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
