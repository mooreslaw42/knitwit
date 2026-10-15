// Turn one Ravelry stash entry into a Knitwit Material.
//
// A pure function: Ravelry in, a Material out, no store and no clock (the import timestamp is passed
// so the result is testable). The caller keys it into the store and, on a re-import, reconciles by
// `ravelrySource.id`. See docs/plans/ravelry-import.md, Phase 1.

import type { CraftType, Material, MaterialStatus } from '@/types/knitwit';
import type { RavelryStash, RavelryStashPack, RavelryYarn } from './types';

// Ravelry names yarn weights; Knitwit stores Craft Yarn Council codes (see YARN_WEIGHTS). The ones
// Ravelry uses, folded onto the eight codes. Unknown or absent → '' (Knitwit shows it as unset).
const WEIGHT_CODE: Record<string, string> = {
  thread: '0',
  cobweb: '0',
  lace: '0',
  'light fingering': '1',
  fingering: '1',
  sport: '2',
  dk: '3',
  worsted: '4',
  aran: '4',
  bulky: '5',
  'super bulky': '6',
  jumbo: '7',
};

function weightCode(name: string | null | undefined): string {
  return WEIGHT_CODE[(name ?? '').trim().toLowerCase()] ?? '';
}

// The head pack (no primary_pack_id) carries the per-skein figures; fall back to the first one.
function primaryPack(packs: RavelryStashPack[] | null | undefined): RavelryStashPack | undefined {
  if (!packs || packs.length === 0) return undefined;
  return packs.find((p) => p.primary_pack_id == null) ?? packs[0];
}

const YARDS_TO_METRES = 0.9144;

function str(n: number | null | undefined): string {
  return n == null ? '' : String(n);
}

// Which craft the yarn is for, asked of the yarn rather than assumed.
//
// This used to be hardcoded to 'knit', which filed a crocheter's entire stash as knitting. Ravelry
// does not label a yarn by craft, but it does record the tools it is meant for — so a yarn that
// gives hook sizes and no needle sizes is a crochet yarn. Anything that mentions needles, or says
// nothing at all, stays knitting: most yarn is sold for both, and 'knit' is the app's default
// everywhere else.
function craftOf(yarn: RavelryYarn): CraftType {
  const needles = yarn.min_needle_size != null || yarn.max_needle_size != null;
  const hooks = yarn.min_hook_size != null || yarn.max_hook_size != null;
  return hooks && !needles ? 'crochet' : 'knit';
}

// Ravelry's stash statuses onto Knitwit's three. Matched on words rather than on the status id,
// because only one id has ever been observed and Ravelry documents none of them. For sale and for
// trade both mean "not going to knit this" as far as a stash app is concerned.
function stashStatus(name: string | null | undefined): MaterialStatus {
  const n = (name ?? '').toLowerCase();
  if (n.includes('used')) return 'usedup';
  if (n.includes('not') || n.includes('sale') || n.includes('trade')) return 'notusing';
  return 'instash';
}

// How many the knitter has — from the head pack, the same one the per-skein figures come from.
//
// Not the sum of the packs, which is the obvious reading and is wrong: in the captured response a
// two-skein entry has two packs that *both* say `skeins: 2.0`, the second being a child of the
// first (`primary_pack_id` points at it) rather than another two balls. Adding them up would tell a
// knitter they own twice the yarn they do, which is the one lie a stash must not tell.
function skeinsOwned(pack: RavelryStashPack | undefined): number | null {
  if (pack?.skeins == null) return null;
  // Ravelry hands these over as floats (2.0); keep a half, lose the artefact.
  return Math.round(pack.skeins * 100) / 100;
}

export function ravelryStashToMaterial(stash: RavelryStash, importedAt: string): Material {
  const yarn = stash.yarn ?? {};
  const pack = primaryPack(stash.packs);

  // Per-skein length: the pack's metres if Ravelry computed them, else the yarn's yardage converted.
  const metres =
    pack?.meters_per_skein != null
      ? String(pack.meters_per_skein)
      : yarn.yardage != null
        ? String(Math.round(yarn.yardage * YARDS_TO_METRES))
        : '';

  const composition = (yarn.yarn_fibers ?? [])
    .map((f) => {
      const name = f.fiber_category?.name ?? f.fiber_type?.name ?? '';
      const pct = f.percentage != null ? `${f.percentage}% ` : '';
      return `${pct}${name}`.trim();
    })
    .filter(Boolean)
    .join(', ');

  const photo = stash.photos?.[0];
  const owner = stash.user?.username ?? '';

  return {
    // "Garnstudio DROPS Saga" already reads as the company and the line together; the yarn name is
    // the fallback when a stash entry has no composed name of its own.
    brand: stash.name ?? yarn.name ?? '',
    colorName: stash.colorway_name ?? '',
    colorLot: stash.dye_lot ?? '',
    price: pack?.total_paid ?? '',
    weight: weightCode(stash.yarn_weight_name ?? yarn.yarn_weight?.name),
    skeins: skeinsOwned(pack),
    location: stash.location ?? '',
    status: stashStatus(stash.stash_status?.name),
    notes: stash.notes ?? '',
    grams: str(pack?.grams_per_skein ?? yarn.grams),
    meters: metres,
    composition,
    thickness: '',
    strands: '',
    craftType: craftOf(yarn),
    washing: '',
    // The knitter's own measured gauge belongs to a swatch, not to the yarn's suggested range, so a
    // stash import leaves it unset rather than inventing one from the yarn's label.
    gauge: null,
    link: yarn.permalink ? `https://www.ravelry.com/yarns/library/${yarn.permalink}` : '',
    photo: photo?.medium_url ?? photo?.url ?? null,
    ravelrySource: {
      id: String(stash.id),
      kind: 'stash',
      url:
        owner && stash.permalink
          ? `https://www.ravelry.com/people/${owner}/stash/${stash.permalink}`
          : '',
      importedAt,
    },
  };
}
