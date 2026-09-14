import { stitchGroupLabel } from '@/lib/stitch-group-label';

// These words are what a knitter reads off a row, so they are worth pinning down: "k to last 1"
// and "k to last 0" differ by one character and by a whole stitch.
describe('naming a stitch group', () => {
  it('counts an exact run', () => {
    expect(stitchGroupLabel({ type: 'knit', span: 'exact', count: 2 })).toBe('k2');
  });

  it('says “across” rather than inventing a number', () => {
    expect(stitchGroupLabel({ type: 'purl', span: 'all', count: null })).toBe('p across');
  });

  it('keeps what a to-last run reserves', () => {
    expect(stitchGroupLabel({ type: 'knit', span: 'to-last', count: 1 })).toBe('k to last 1');
  });

  it('admits it does not know rather than reading as “to last 0”', () => {
    expect(stitchGroupLabel({ type: 'knit', span: 'to-last', count: null })).toBe('k to last ?');
  });

  it('leaves a stitch that consumes nothing unnumbered', () => {
    // M1L makes a stitch out of the bar between two; "M1L1" would read as a count it doesn't have.
    expect(stitchGroupLabel({ type: 'm1l', span: 'exact', count: 1 })).toBe('M1L');
  });

  it('falls back to the raw type for a stitch the catalogue has never heard of', () => {
    expect(stitchGroupLabel({ type: 'wibble', span: 'exact', count: 3 })).toBe('wibble');
  });
});
