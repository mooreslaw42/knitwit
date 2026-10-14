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
  notes: 'Slight halo, splits if you are not watching.',
  location: 'attic box 3',
  stash_status: { name: 'In stash' },
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
    // The real response has both: this yarn is sold for knitting and crochet alike.
    min_needle_size: { metric: 4 },
    min_hook_size: { metric: 4 },
  },
  // Two packs, and both say two skeins — the second is a child of the first, not another two balls.
  packs: [
    { primary_pack_id: null, skeins: 2, grams_per_skein: 50, meters_per_skein: 99.7, yards_per_skein: 109, total_paid: '1.00' },
    { primary_pack_id: 145022644, skeins: 2, grams_per_skein: null, meters_per_skein: null },
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
      skeins: 2,
      location: 'attic box 3',
      status: 'instash',
      notes: 'Slight halo, splits if you are not watching.',
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

  it('counts the head pack, not every pack, so two skeins do not become four', () => {
    // Both packs say 2.0 and the second is a child of the first. Summing is the obvious reading and
    // the wrong one — telling a knitter they have twice the yarn they do is the one lie a stash
    // must not tell.
    expect(ravelryStashToMaterial(sampleStash, IMPORTED_AT).skeins).toBe(2);
  });

  it('keeps half a skein, and says nothing when Ravelry says nothing', () => {
    const half: RavelryStash = { ...sampleStash, packs: [{ primary_pack_id: null, skeins: 1.5 }] };
    expect(ravelryStashToMaterial(half, IMPORTED_AT).skeins).toBe(1.5);

    // Not counted is not the same answer as none.
    const uncounted: RavelryStash = { ...sampleStash, packs: [{ primary_pack_id: null }] };
    expect(ravelryStashToMaterial(uncounted, IMPORTED_AT).skeins).toBeNull();
  });

  it('folds Ravelry’s stash statuses onto Knitwit’s three', () => {
    const status = (name: string) =>
      ravelryStashToMaterial({ ...sampleStash, stash_status: { name } }, IMPORTED_AT).status;
    expect(status('In stash')).toBe('instash');
    expect(status('Used up')).toBe('usedup');
    expect(status('Will not use')).toBe('notusing');
    // A marketplace Knitwit does not have; for its purposes these are "not knitting this".
    expect(status('For sale')).toBe('notusing');
    expect(status('For trade')).toBe('notusing');
    // Unknown, or never said, reads as having it — which is why it is in the stash at all.
    expect(status('Something new')).toBe('instash');
    expect(ravelryStashToMaterial({ id: 1 }, IMPORTED_AT).status).toBe('instash');
  });

  it('reads the craft off the yarn instead of filing everything as knitting', () => {
    const craftOf = (yarn: RavelryStash['yarn']) =>
      ravelryStashToMaterial({ ...sampleStash, yarn }, IMPORTED_AT).craftType;

    // Hooks and no needles is the one case Ravelry makes clear: a crochet thread.
    expect(craftOf({ min_hook_size: { metric: 2 }, max_hook_size: { metric: 3 } })).toBe('crochet');
    // Needles, or both — most yarn is sold for both — stays knitting, the app's default.
    expect(craftOf({ min_needle_size: { metric: 4 } })).toBe('knit');
    expect(craftOf({ min_needle_size: { metric: 4 }, min_hook_size: { metric: 4 } })).toBe('knit');
    // Says nothing: no reason to guess crochet.
    expect(craftOf({})).toBe('knit');
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
