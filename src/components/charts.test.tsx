import { render, screen } from '@testing-library/react-native';

import { CrochetChart } from '@/components/crochet-chart';
import { StitchChart } from '@/components/stitch-chart';
import type { PatternRow, PatternStitchGroup } from '@/types/knitwit';

// The app's first render tests, and they start here on purpose: every chart bug this project has
// had was found by eye, in a browser, after it shipped. A chart that quietly drew forty of a row's
// sixty stitches, and a row with nothing in it drawn as a blank band with a number beside it, were
// both invisible to a suite that only ever tested the arithmetic feeding them.
//
// So these assert what the picture *says*, not how it is built: how many rows it drew, what it
// admits to leaving out, and what it puts against a row it could not chart.

const group = (type: string, count: number | null, span: PatternStitchGroup['span'] = 'exact') => ({
  id: `g${type}${count}${Math.random()}`,
  type,
  span,
  count,
  materialSlot: null,
  note: '',
});

const row = (id: string, stitches: PatternStitchGroup[], side: 'RS' | 'WS' = 'RS'): PatternRow => ({
  id,
  label: `Row ${id}`,
  side,
  marker: false,
  instruction: '',
  stitches,
});

// Rows of plain single crochet, `width` stitches each.
const rows = (count: number, width: number): PatternRow[] =>
  Array.from({ length: count }, (_, i) =>
    row(`r${i}`, [group('sc', width)], i % 2 === 0 ? 'RS' : 'WS'),
  );

const json = () => JSON.stringify(screen.toJSON());

describe('the crochet chart', () => {
  it('draws a line per row, numbered', async () => {
    await render(<CrochetChart rows={rows(5, 6)} castOn={6} />);
    const drawing = json();
    for (const n of ['1', '2', '3', '4', '5']) {
      expect(drawing).toContain(`"${n}"`);
    }
  });

  // The bug: a row wider than the chart simply stopped, with nothing to say so, and the knitter
  // was looking at a narrower garment than the one they had written.
  it('says when a row runs on past what it can draw', async () => {
    await render(<CrochetChart rows={[row('wide', [group('sc', 200)])]} castOn={200} />);
    expect(json()).toContain('runs on');
  });

  it('says nothing of the sort when the whole row fits', async () => {
    await render(<CrochetChart rows={[row('ok', [group('sc', 20)])]} castOn={20} />);
    expect(json()).not.toContain('runs on');
  });

  it('counts the rows it is not showing', async () => {
    await render(<CrochetChart rows={rows(80, 4)} castOn={4} />);
    expect(json()).toContain('Showing the first');
  });

  // The other bug: a row the parser refused was drawn as an empty band with a number beside it,
  // which reads as a gap in the fabric rather than a gap in what the app understood.
  it('marks a row it has no stitches for', async () => {
    await render(
      <CrochetChart rows={[row('a', [group('sc', 4)]), row('b', [])]} castOn={4} />,
    );
    expect(json()).toContain('not charted');
  });

  it('leaves that off when every row is charted', async () => {
    await render(<CrochetChart rows={rows(3, 4)} castOn={4} />);
    expect(json()).not.toContain('not charted');
  });

  // A section whose rows are all refused still has rows, and the chart has to be drawable.
  it('draws something for a section with nothing charted at all', async () => {
    await render(<CrochetChart rows={[row('a', []), row('b', [])]} castOn={0} />);
    expect(json()).toContain('not charted');
  });
});

describe('the knitting chart', () => {
  const knitRows = (count: number, width: number): PatternRow[] =>
    Array.from({ length: count }, (_, i) =>
      row(`k${i}`, [group('knit', width)], i % 2 === 0 ? 'RS' : 'WS'),
    );

  it('draws a cell per stitch', async () => {
    await render(<StitchChart rows={knitRows(2, 5)} castOn={5} />);
    // Ten cells — five stitches on each of two rows — plus the one the legend draws beside
    // "k · Knit". Stated rather than worked around: if the legend changes, this fails loudly and
    // the reason is written right here.
    expect(json()?.split('"|"').length - 1).toBe(11);
  });

  it('says when a row is wider than it can draw', async () => {
    await render(<StitchChart rows={[row('wide', [group('knit', 300)])]} castOn={300} />);
    expect(json()).toContain('runs on');
  });

  it('marks a row it has no stitches for', async () => {
    await render(<StitchChart rows={[row('a', [group('knit', 4)]), row('b', [])]} castOn={4} />);
    expect(json()).toContain('not charted');
  });

  // The craft decides which drawing a section gets, and a crochet section handed to the knitting
  // chart used to come out as a grid of letters.
  it('hands a crochet section to the crochet chart', async () => {
    await render(<StitchChart rows={[row('a', [group('dc', 3)])]} castOn={3} craft="crochet" />);
    expect(json()).toContain('Double crochet');
  });
});
