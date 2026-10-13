// Turn a knitter's Ravelry needle/hook inventory into Knitwit tools.
//
// Ravelry stores one record per physical needle, so two identical 3.25mm DPNs arrive as two records
// that share a needle_type_id. Knitwit stores one Tool with a quantity, so this collapses each type
// into a single tool and counts the duplicates. A pure, list-in list-out function, clock passed in.
// See docs/plans/ravelry-import.md, Phase 1.

import type { Tool, ToolType } from '@/types/knitwit';
import type { RavelryNeedleRecord } from './types';

// Ravelry's needle `type_name` onto Knitwit's ToolType. Steel and Tunisian hooks are crochet hooks;
// anything unrecognised becomes 'other' rather than being dropped or guessed into the wrong bucket.
const TOOL_TYPE: Record<string, ToolType> = {
  straight: 'straight',
  dp: 'dpn',
  circular: 'circular',
  hook: 'crochet-hook',
  steel: 'crochet-hook',
  tunisian: 'crochet-hook',
  cable: 'cable-needle',
};

function toolType(name: string | null | undefined): ToolType {
  return TOOL_TYPE[(name ?? '').trim().toLowerCase()] ?? 'other';
}

const INCH_TO_CM = 2.54;

export function ravelryNeedlesToTools(
  records: RavelryNeedleRecord[],
  importedAt: string,
): Tool[] {
  const byType = new Map<string, { record: RavelryNeedleRecord; count: number }>();
  for (const rec of records) {
    // Group on the needle type where there is one, so duplicates coalesce; fall back to the record's
    // own id, which keeps a typeless record as its own single tool rather than merging unlike needles.
    const key = rec.needle_type_id != null ? `t${rec.needle_type_id}` : `r${rec.id}`;
    const seen = byType.get(key);
    if (seen) seen.count += 1;
    else byType.set(key, { record: rec, count: 1 });
  }

  return [...byType.values()].map(({ record, count }) => {
    const nt = record.needle_type ?? {};
    return {
      type: toolType(nt.type_name),
      thickness: nt.metric_name ? `${nt.metric_name}mm` : '',
      // Ravelry records needle length in inches; Knitwit keeps lengths in centimetres (see seeds).
      length: nt.length != null ? `${Math.round(nt.length * INCH_TO_CM)}cm` : '',
      quantity: count,
      ravelrySource: {
        id: record.needle_type_id != null ? String(record.needle_type_id) : String(record.id),
        kind: 'needle',
        // An inventory needle is not a page on Ravelry, so there is nothing to link back to.
        url: '',
        importedAt,
      },
    };
  });
}
