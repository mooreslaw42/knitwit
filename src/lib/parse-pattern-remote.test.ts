// The Edge Function is Deno and can't be imported here, so the boundary is tested from this side:
// given a response shape, do we read it correctly and merge it without touching rows we already
// charted? The network call itself is the one part with nothing to assert.
import {
  mergeRemoteRows,
  sectionRowsFrom,
  toRemoteParseResult,
  unparsedRowIndexes,
  type RemoteRowResult,
} from '@/lib/parse-pattern-remote';
import type { PatternRow } from '@/types/knitwit';

// Stubbed to keep AsyncStorage out of this suite — importing it under Jest reaches for a native
// module that isn't there. Nothing here calls the network anyway. (jest.mock is hoisted above the
// imports, so its position in the file doesn't matter.)
jest.mock('@/lib/supabase', () => ({ getSupabase: jest.fn() }));

const row = (id: string, instruction: string, stitches: PatternRow['stitches'] = []): PatternRow => ({
  id,
  label: id,
  side: 'RS',
  marker: false,
  instruction,
  stitches,
});

const knit = { id: 'g1', type: 'knit', span: 'all' as const, count: null, materialSlot: null, note: '' };

describe('unparsedRowIndexes', () => {
  it('finds rows that kept their wording but charted nothing', () => {
    const rows = [row('a', 'knit', [knit]), row('b', '*k2tog; rep from *'), row('c', 'purl', [knit])];
    expect(unparsedRowIndexes(rows)).toEqual([1]);
  });

  it('ignores a row that is simply empty', () => {
    expect(unparsedRowIndexes([row('a', '   ')])).toEqual([]);
  });
});

describe('toRemoteParseResult', () => {
  const response = {
    model: 'claude-sonnet-5',
    usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 900 },
    rows: [
      {
        index: 2,
        confident: true,
        note: '',
        stitches: [
          { type: 'knit', span: 'exact', count: [2, 2, 3], note: '' },
          { type: 'knit', span: 'all', count: [], note: '' },
          { type: 'purl', span: 'exact', count: [4, 4, 4], note: '' },
        ],
      },
    ],
  };

  it('collapses a per-size run, keeping a varying one as an array', () => {
    const result = toRemoteParseResult(response);
    expect(result.rows[0].stitches.map((g) => g.count)).toEqual([[2, 2, 3], null, 4]);
  });

  it('reads the model name and fills in a usage field the provider omitted', () => {
    const result = toRemoteParseResult(response);
    expect(result.model).toBe('claude-sonnet-5');
    expect(result.usage.cache_read_input_tokens).toBe(900);
    expect(result.usage.cache_creation_input_tokens).toBe(0);
  });

  it('treats a row with no usable stitches as unconfident', () => {
    const result = toRemoteParseResult({
      rows: [{ index: 0, confident: true, note: 'cable', stitches: [] }],
    });
    expect(result.rows[0].confident).toBe(false);
  });

  it('surfaces an error body as an error', () => {
    expect(() => toRemoteParseResult({ error: 'not configured' })).toThrow('not configured');
  });

  it('rejects a response that is not shaped like one', () => {
    expect(() => toRemoteParseResult({ rows: 'nope' })).toThrow();
  });
});

describe('mergeRemoteRows', () => {
  const rows = [row('a', 'knit', [knit]), row('b', 'rep from *'), row('c', 'rep from *')];

  it('applies charted stitches only to the rows the model was asked about', () => {
    const { rows: merged } = mergeRemoteRows(rows, [
      { index: 1, stitches: [{ ...knit, id: 'g9' }], confident: true, note: '' },
    ]);
    expect(merged[0].stitches).toBe(rows[0].stitches);
    expect(merged[1].stitches.map((g) => g.type)).toEqual(['knit']);
    expect(merged[2].stitches).toEqual([]);
  });

  it('keeps the original wording on every row it touches', () => {
    const { rows: merged } = mergeRemoteRows(rows, [
      { index: 1, stitches: [{ ...knit, id: 'g9' }], confident: true, note: '' },
    ]);
    expect(merged[1].instruction).toBe('rep from *');
  });

  it('applies an unconfident row but raises it for review', () => {
    const { rows: merged, issues } = mergeRemoteRows(rows, [
      { index: 1, stitches: [{ ...knit, id: 'g9' }], confident: false, note: 'the repeat is uneven' },
    ]);
    expect(merged[1].stitches).toHaveLength(1);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ rowIndex: 1 });
    expect(issues[0].message).toContain('the repeat is uneven');
  });

  it('leaves a refused row alone and explains why', () => {
    const { rows: merged, issues } = mergeRemoteRows(rows, [
      { index: 2, stitches: [], confident: false, note: 'this is a cable cross' },
    ]);
    expect(merged[2].stitches).toEqual([]);
    expect(issues[0].message).toContain('this is a cable cross');
  });

  it('ignores a row index that does not exist here', () => {
    const { rows: merged, issues } = mergeRemoteRows(rows, [
      { index: 9, stitches: [{ ...knit, id: 'g9' }], confident: true, note: '' },
    ]);
    expect(merged).toHaveLength(3);
    expect(issues[0]).toMatchObject({ rowIndex: null });
  });
});

// Section mode: the parser read nothing at all, so there are no refused rows to name and the
// model charts the section from scratch. Its reading replaces whatever was there — which is only
// ever nothing, since this path exists precisely because the parser produced nothing.
describe('sectionRowsFrom', () => {
  const modelRow = (i: number, over: Partial<RemoteRowResult> = {}): RemoteRowResult => ({
    index: i,
    stitches: [{ ...knit, id: `g${i}` }],
    confident: true,
    note: '',
    label: `Row ${i + 1}`,
    side: i % 2 === 0 ? 'RS' : 'WS',
    instruction: 'knit all',
    ...over,
  });

  it('builds rows from what the model named, keeping the wording', () => {
    const { rows } = sectionRowsFrom([modelRow(0), modelRow(1)]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ label: 'Row 1', side: 'RS', instruction: 'knit all' });
    expect(rows[1].side).toBe('WS');
  });

  it('puts rows in index order however they arrived', () => {
    const { rows } = sectionRowsFrom([modelRow(2), modelRow(0), modelRow(1)]);
    expect(rows.map((r) => r.label)).toEqual(['Row 1', 'Row 2', 'Row 3']);
  });

  it('falls back to alternating sides when the model did not say', () => {
    const { rows } = sectionRowsFrom([
      modelRow(0, { side: undefined }),
      modelRow(1, { side: undefined }),
    ]);
    expect(rows.map((r) => r.side)).toEqual(['RS', 'WS']);
  });

  it('names a row the model left unlabelled', () => {
    const { rows } = sectionRowsFrom([modelRow(0, { label: undefined })]);
    expect(rows[0].label).toBe('Row 1');
  });

  it('raises an unconfident row for review but still charts it', () => {
    const { rows, issues } = sectionRowsFrom([
      modelRow(0, { confident: false, note: 'the repeat is uneven' }),
    ]);
    expect(rows[0].stitches).toHaveLength(1);
    expect(issues[0].message).toContain('the repeat is uneven');
  });

  it('gives every row a distinct id', () => {
    const { rows } = sectionRowsFrom([modelRow(0), modelRow(1), modelRow(2)]);
    expect(new Set(rows.map((r) => r.id)).size).toBe(3);
  });
});
