// Turn one Ravelry stash entry into a Knitwit Material.
//
// A pure function: Ravelry in, a Material out, no store and no clock (the import timestamp is passed
// so the result is testable). The caller keys it into the store and, on a re-import, reconciles by
// `ravelrySource.id`. See docs/plans/ravelry-import.md, Phase 1.

import type { CraftType, Material } from '@/types/knitwit';
import type { RavelryStash, RavelryStashPack } from './types';

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
    grams: str(pack?.grams_per_skein ?? yarn.grams),
    meters: metres,
    composition,
    thickness: '',
    strands: '',
    craftType: 'knit' as CraftType,
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
