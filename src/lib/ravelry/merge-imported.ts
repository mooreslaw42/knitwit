import type { Material, Pattern, Project, Tool } from '@/types/knitwit';

// What a re-import is allowed to overwrite.
//
// Reconciling by `ravelrySource.id` means a second import lands on the row the first one made — and
// it used to replace that row wholesale. Fine for the facts Ravelry owns, quietly destructive for
// everything the knitter has done since: a pattern they charted from its PDF came back empty, and a
// project they had been counting rows on was reset to a placeholder. The counter is the point of
// this app; losing someone's row count because they pressed Import twice is the worst thing this
// feature could do.
//
// So: Ravelry is authoritative for what Ravelry knows, the knitter for what they have changed here,
// and an import never writes a blank over something real. Two rules do most of the work.
//
//   - A field the mapper left empty ('' / null / []) means "Ravelry did not say", not "make it empty".
//   - Charted structure and measured gauge belong to the knitter. An import that has none keeps theirs.

// Ravelry said something, so take it; otherwise leave what is there.
function fromRavelry(incoming: string, existing: string): string {
  return incoming || existing;
}

// The same, for a list Ravelry owns (tags, needle sizes): it wins when it has anything to say.
function ravelryList<T>(incoming: T[], existing: T[]): T[] {
  return incoming.length > 0 ? incoming : existing;
}

// Structure the knitter may have built — a chart, a row count. Once they have any, an import does
// not get to replace it, even with a well-meaning placeholder.
function knittersOwn<T>(existing: T[], incoming: T[]): T[] {
  return existing.length > 0 ? existing : incoming;
}

export function mergeMaterial(existing: Material, incoming: Material): Material {
  return {
    // thickness, strands, washing, careSymbols, crafts, craftType and the knitter's measured gauge
    // all survive here: the mapper has nothing to say about any of them, so it must not blank them.
    ...existing,
    brand: fromRavelry(incoming.brand, existing.brand),
    colorName: fromRavelry(incoming.colorName, existing.colorName),
    colorLot: fromRavelry(incoming.colorLot, existing.colorLot),
    price: fromRavelry(incoming.price, existing.price),
    weight: fromRavelry(incoming.weight, existing.weight),
    grams: fromRavelry(incoming.grams, existing.grams),
    meters: fromRavelry(incoming.meters, existing.meters),
    composition: fromRavelry(incoming.composition, existing.composition),
    link: fromRavelry(incoming.link, existing.link),
    photo: incoming.photo ?? existing.photo,
    ravelrySource: incoming.ravelrySource,
  };
}

export function mergeTool(existing: Tool, incoming: Tool): Tool {
  return {
    ...existing,
    type: incoming.type,
    thickness: fromRavelry(incoming.thickness, existing.thickness),
    length: fromRavelry(incoming.length, existing.length),
    // Ravelry counts the needles in the drawer; that is the number worth trusting.
    quantity: incoming.quantity,
    ravelrySource: incoming.ravelrySource,
  };
}

export function mergePattern(existing: Pattern, incoming: Pattern): Pattern {
  return {
    // accentColor, swatchGauge, language and the knitter's own notes carry over untouched. So do
    // category and level: those are the mapper's *guess* from Ravelry's category tree, and someone
    // who corrected a wrong guess should not have it put back on every import.
    ...existing,
    name: fromRavelry(incoming.name, existing.name),
    craft: incoming.craft,
    needleSize: fromRavelry(incoming.needleSize, existing.needleSize),
    photo: incoming.photo ?? existing.photo,
    gauge: incoming.gauge ?? existing.gauge,
    favorited: incoming.favorited,
    // The charted body. A metadata card brings none of this, and an import must never be the reason
    // a knitter loses the chart they built from the PDF — that is a slow, paid-for AI pass.
    sections: knittersOwn(existing.sections, incoming.sections),
    materials: knittersOwn(existing.materials, incoming.materials),
    tools: knittersOwn(existing.tools, incoming.tools),
    techniques: knittersOwn(existing.techniques, incoming.techniques),
    sizes: knittersOwn(existing.sizes, incoming.sizes),
    ravelrySource: incoming.ravelrySource,
  };
}

export function mergeProject(existing: Project, incoming: Project): Project {
  return {
    // colour, sizeIndex, slotMaterials/slotTools and anything else the knitter set here survive.
    ...existing,
    name: fromRavelry(incoming.name, existing.name),
    startedOn: incoming.startedOn ?? existing.startedOn,
    craft: incoming.craft,
    photo: incoming.photo ?? existing.photo,
    needleSize: fromRavelry(incoming.needleSize, existing.needleSize),
    labels: ravelryList(incoming.labels, existing.labels),
    status: incoming.status,
    gauge: incoming.gauge ?? existing.gauge,
    // Re-linked each time: the pattern this was made from may only have been imported on this run.
    patternId: incoming.patternId ?? existing.patternId,
    materialSkeins: incoming.materialSkeins ?? existing.materialSkeins,
    // Where the knitting actually is. The import only ever brings a placeholder section, so the
    // moment a project has sections of its own — a row count, a chart copied from a pattern — the
    // knitter's stay. This is the row count someone would otherwise lose.
    sections: knittersOwn(existing.sections, incoming.sections),
    ravelrySource: incoming.ravelrySource,
  };
}
