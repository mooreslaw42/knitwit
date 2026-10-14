import type { ImportedPattern } from '@/lib/import-pattern-document';
import type { Pattern } from '@/types/knitwit';

// Folding a charted PDF into a pattern that came in as a metadata card.
//
// Phase 4 of docs/plans/ravelry-import.md. The card has the good metadata — name, category, the
// photo and the Ravelry link — but an empty counter. Parsing the owned PDF gives the structure the
// card lacked: sections, their rows, and the material/tool/technique slots. So the card keeps its
// identity and the parse supplies the body. Pure, so it is tested on its own.

type ParsedPattern = ImportedPattern['pattern'];

export function mergePatternChart(existing: Pattern, parsed: ParsedPattern): Pattern {
  return {
    ...existing,
    // The structure the PDF gave us — the whole point of charting it.
    sections: parsed.sections,
    materials: parsed.materials,
    tools: parsed.tools,
    techniques: parsed.techniques,
    // Fill these from the parse only where the card had nothing; Ravelry's metadata is otherwise the
    // better source and stays.
    sizes: existing.sizes.length > 0 ? existing.sizes : parsed.sizes,
    needleSize: existing.needleSize || parsed.needleSize,
    gauge: existing.gauge ?? parsed.gauge,
  };
}
