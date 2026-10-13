import { ravelryStashToMaterial } from './stash';
import type { RavelryStash } from './types';

const IMPORTED_AT = '2026-10-13T00:00:00.000Z';

// Shaped on a real /people/{user}/stash/{id}.json response, with the ids and username anonymised.
const sampleStash: RavelryStash = {
  id: 11111111,
  permalink: 'drops-saga',
  name: 'Garnstudio DROPS Saga',
  colorway_name: '3 Birk',
  dye_lot: '123',
  yarn_weight_name: 'DK',
  notes: '',
  photos: [],
  user: { username: 'testknitter' },
  yarn: {
    name: 'DROPS Saga',
    permalink: 'garnstudio-drops-saga',
    grams: 50,
    yardage: 109,
    yarn_company: { name: 'Garnstudio' },
    yarn_weight: { name: 'DK' },
    yarn_fibers: [
      { percentage: 100, fiber_category: { name: 'Wool' }, fiber_type: { name: 'Wool' } },
    ],
  },
  packs: [
    { primary_pack_id: null, grams_per_skein: 50, meters_per_skein: 99.7, yards_per_skein: 109, total_paid: '1.00' },
    { primary_pack_id: 145022644, grams_per_skein: null, meters_per_skein: null },
  ],
};

describe('ravelryStashToMaterial', () => {
  it('maps a full stash entry onto a Material', () => {
    const m = ravelryStashToMaterial(sampleStash, IMPORTED_AT);
    expect(m).toEqual({
      brand: 'Garnstudio DROPS Saga',
      colorName: '3 Birk',
      colorLot: '123',
      price: '1.00',
      weight: '3', // DK → Craft Yarn Council "Light"
      grams: '50',
      meters: '99.7',
      composition: '100% Wool',
      thickness: '',
      strands: '',
      craftType: 'knit',
      washing: '',
      gauge: null,
      link: 'https://www.ravelry.com/yarns/library/garnstudio-drops-saga',
      photo: null,
      ravelrySource: {
        id: '11111111',
        kind: 'stash',
        url: 'https://www.ravelry.com/people/testknitter/stash/drops-saga',
        importedAt: IMPORTED_AT,
      },
    });
  });

  it('takes the head pack (no primary_pack_id), not a split child', () => {
    const m = ravelryStashToMaterial(sampleStash, IMPORTED_AT);
    expect(m.grams).toBe('50');
    expect(m.meters).toBe('99.7');
  });

  it('falls back to converting yardage when no pack metres are given', () => {
    const noPacks: RavelryStash = { ...sampleStash, packs: [] };
    const m = ravelryStashToMaterial(noPacks, IMPORTED_AT);
    expect(m.meters).toBe('100'); // round(109 * 0.9144)
    expect(m.grams).toBe('50'); // from yarn.grams
    expect(m.price).toBe('');
  });

  it('leaves an unknown yarn weight unset rather than guessing', () => {
    const odd: RavelryStash = { ...sampleStash, yarn_weight_name: 'Bulky-ish', yarn: { ...sampleStash.yarn, yarn_weight: { name: 'Bulky-ish' } } };
    expect(ravelryStashToMaterial(odd, IMPORTED_AT).weight).toBe('');
  });

  it('survives a near-empty stash entry without throwing', () => {
    const bare: RavelryStash = { id: 42 };
    const m = ravelryStashToMaterial(bare, IMPORTED_AT);
    expect(m.brand).toBe('');
    expect(m.composition).toBe('');
    expect(m.gauge).toBeNull();
    expect(m.link).toBe('');
    expect(m.ravelrySource).toEqual({ id: '42', kind: 'stash', url: '', importedAt: IMPORTED_AT });
  });
});
