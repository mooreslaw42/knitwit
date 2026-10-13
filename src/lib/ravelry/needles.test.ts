import { ravelryNeedlesToTools } from './needles';
import type { RavelryNeedleRecord } from './types';

const IMPORTED_AT = '2026-10-13T00:00:00.000Z';

// Shaped on a real /people/{user}/needles/list.json response, ids anonymised. Two identical DPNs
// (shared needle_type_id), one circular, one crochet hook, one steel hook with no US size.
const records: RavelryNeedleRecord[] = [
  { id: 1, needle_type_id: 69, needle_type: { length: 8, metric_name: '3.25', name: '3 ', type_name: 'dp' } },
  { id: 2, needle_type_id: 69, needle_type: { length: 8, metric_name: '3.25', name: '3 ', type_name: 'dp' } },
  { id: 3, needle_type_id: 100, needle_type: { length: 40, metric_name: '3', name: '2.5', type_name: 'circular' } },
  { id: 4, needle_type_id: 200, needle_type: { length: 5, metric_name: '3.25', name: 'D', type_name: 'hook' } },
  { id: 5, needle_type_id: 300, needle_type: { length: 5, metric_name: '0.9', name: null, type_name: 'steel' } },
];

describe('ravelryNeedlesToTools', () => {
  it('collapses duplicate needles into one tool with a quantity', () => {
    const tools = ravelryNeedlesToTools(records, IMPORTED_AT);
    expect(tools).toEqual([
      {
        type: 'dpn',
        thickness: '3.25mm',
        length: '20cm', // round(8 * 2.54)
        quantity: 2,
        ravelrySource: { id: '69', kind: 'needle', url: '', importedAt: IMPORTED_AT },
      },
      {
        type: 'circular',
        thickness: '3mm',
        length: '102cm', // round(40 * 2.54)
        quantity: 1,
        ravelrySource: { id: '100', kind: 'needle', url: '', importedAt: IMPORTED_AT },
      },
      {
        type: 'crochet-hook',
        thickness: '3.25mm',
        length: '13cm', // round(5 * 2.54)
        quantity: 1,
        ravelrySource: { id: '200', kind: 'needle', url: '', importedAt: IMPORTED_AT },
      },
      {
        type: 'crochet-hook', // steel hooks are crochet hooks
        thickness: '0.9mm',
        length: '13cm',
        quantity: 1,
        ravelrySource: { id: '300', kind: 'needle', url: '', importedAt: IMPORTED_AT },
      },
    ]);
  });

  it('maps an unknown needle type to "other" rather than guessing', () => {
    const odd: RavelryNeedleRecord[] = [
      { id: 9, needle_type_id: 999, needle_type: { type_name: 'double-ended', metric_name: '4' } },
    ];
    expect(ravelryNeedlesToTools(odd, IMPORTED_AT)[0].type).toBe('other');
  });

  it('keeps a record with no needle_type_id as its own tool', () => {
    const typeless: RavelryNeedleRecord[] = [
      { id: 7, needle_type: { type_name: 'circular', metric_name: '5' } },
      { id: 8, needle_type: { type_name: 'circular', metric_name: '5' } },
    ];
    const tools = ravelryNeedlesToTools(typeless, IMPORTED_AT);
    expect(tools).toHaveLength(2);
    expect(tools.map((t) => t.ravelrySource?.id)).toEqual(['7', '8']);
  });

  it('returns nothing for an empty inventory', () => {
    expect(ravelryNeedlesToTools([], IMPORTED_AT)).toEqual([]);
  });
});
