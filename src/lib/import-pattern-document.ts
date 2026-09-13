import { CATEGORY_ORDER, SIZE_OPTIONS } from '@/constants/catalogs';
import { MaxNameLength } from '@/constants/theme';
import { invokeEdgeFunction } from '@/lib/edge-function';
import { parseSectionText } from '@/lib/parse-pattern-text';
import type {
  Gauge,
  LengthUnit,
  Pattern,
  PatternCategory,
  PatternLevel,
  PatternMaterial,
  PatternSection,
  PatternTechnique,
  PatternTool,
  SizedNumber,
  TechniqueCraft,
  ToolType,
} from '@/types/knitwit';

// Whole-document import: a pattern the knitter uploaded or pasted becomes a filled-in draft they
// review before anything is saved.
//
// Everything the model sends is normalised here rather than on the server. It crosses a network
// boundary from a runtime we don't typecheck with this one, and it lands directly in the wizard's
// form state — so nothing below assumes a field is present, is the right type, or is a value the
// app has a label for. An unrecognised category becomes the default, not a broken screen.

export type ImportedPattern = {
  // Everything the wizard needs, ready to merge into its form.
  pattern: Omit<Pattern, 'accentColor' | 'photo' | 'favorited' | 'sourceName' | 'sourceText'>;
  // What the model said it was unsure about, shown to the knitter before they accept.
  notes: string;
  // Problems we found ourselves, rather than ones the model owned up to.
  warnings: string[];
  model: string;
  // Counts for the review summary — cheaper to compute here than to recount in the UI.
  summary: {
    sections: number;
    rowsCharted: number;
    rowsUnparsed: number;
  };
};

const LEVELS: PatternLevel[] = ['beginner', 'easy', 'intermediate', 'advanced'];
const TOOL_TYPES: ToolType[] = [
  'straight',
  'circular',
  'dpn',
  'interchangeable',
  'crochet-hook',
  'cable-needle',
  'cable-pin',
  'other',
];

let uid = 0;
const nextId = (prefix: string) => `${prefix}${Date.now().toString(36)}${uid++}`;

const str = (v: unknown, max = 200): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

// The schema asks for numbers, but this crosses a runtime boundary and older drafts (and a
// provider that isn't honouring the schema) can still send "22 sts per 10cm". Take either.
function num(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : 0;
  const match = str(v).replace(',', '.').match(/\d+(?:\.\d+)?/);
  return match ? parseFloat(match[0]) : 0;
}

// The window a gauge was measured over is part of the gauge, not decoration. Reading "22 sts to 4
// inches" and storing a bare 22 silently records it as metric, which is a different fabric by
// 1.6% — and that was happening to every US pattern before gauge had a unit.
function normaliseGauge(v: unknown): Gauge | null {
  const g = (typeof v === 'object' && v !== null ? v : {}) as Record<string, unknown>;
  const stitches = num(g.stitches);
  const rows = num(g.rows);
  if (stitches <= 0 && rows <= 0) return null;
  const unit: LengthUnit = g.unit === 'inch' ? 'inch' : 'cm';
  // Fall back to the convention of whichever unit was stated: 10cm, or 4in.
  const fallback = unit === 'inch' ? 4 : 10;
  const width = num(g.width) || fallback;
  return { stitches, rows, width, height: num(g.height) || width, unit };
}

function oneOf<T extends string>(v: unknown, allowed: T[], fallback: T): T {
  const s = str(v);
  return (allowed as string[]).includes(s) ? (s as T) : fallback;
}

// Per-size numbers arrive as one entry per size. Collapse a run that's identical across sizes back
// to a plain number, matching how the rest of the app stores them.
function toSized(v: unknown, fallback: number): SizedNumber {
  const nums = arr(v)
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
    .map((n) => Math.max(0, Math.round(n)));
  if (nums.length === 0) return fallback;
  if (nums.every((n) => n === nums[0])) return nums[0];
  return nums;
}

// The wizard offers a fixed list of sizes; a pattern graded "S (M) L" maps onto it, but a pattern
// with its own naming ("6 months", "50cm") should keep its own words rather than be forced.
function normaliseSizes(v: unknown): string[] {
  const sizes = arr(v)
    .map((s) => str(s, 24))
    .filter(Boolean);
  if (sizes.length === 0) return [];
  const canonical = new Map(SIZE_OPTIONS.map((s) => [s.toLowerCase(), s]));
  return sizes.slice(0, 12).map((s) => canonical.get(s.toLowerCase()) ?? s);
}

function normaliseMaterials(v: unknown): PatternMaterial[] {
  return arr(v)
    .slice(0, 12)
    .map((raw, i) => {
      const m = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
      return {
        id: nextId('pm'),
        label: str(m.label, MaxNameLength) || `Yarn ${String.fromCharCode(65 + i)}`,
        // One letter is all the chart has room for.
        short: (str(m.short, 2) || String.fromCharCode(65 + i)).slice(0, 1).toUpperCase(),
      };
    })
    .filter((m) => m.label);
}

function normaliseTools(v: unknown): PatternTool[] {
  return arr(v)
    .slice(0, 12)
    .map((raw) => {
      const t = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
      return {
        id: nextId('pt'),
        type: oneOf(t.type, TOOL_TYPES, 'other'),
        thickness: str(t.thickness, 40),
        note: str(t.note, 120),
      };
    });
}

function normaliseTechniques(v: unknown): PatternTechnique[] {
  return arr(v)
    .slice(0, 20)
    .map((raw) => {
      const t = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
      return { id: nextId('tq'), name: str(t.name, MaxNameLength), note: str(t.note, 300) };
    })
    .filter((t) => t.name);
}

// The model refers to slots by position; the app refers to them by id. Translate, dropping any
// index that points past the end of the list rather than producing a dangling reference.
function slotIds(v: unknown, slots: { id: string }[]): string[] {
  const ids = arr(v)
    .filter((n): n is number => typeof n === 'number' && Number.isInteger(n))
    .map((i) => slots[i]?.id)
    .filter((id): id is string => Boolean(id));
  return Array.from(new Set(ids));
}

// Each section's instructions go straight through the deterministic parser, so the knitter lands
// on a pattern that is already charted wherever charting was possible — and the rows it refused
// are exactly the ones the per-section "Read it with AI" button exists for.
function normaliseSections(
  v: unknown,
  slots: { materials: PatternMaterial[]; tools: PatternTool[]; techniques: PatternTechnique[] },
): PatternSection[] {
  return arr(v)
    .slice(0, 40)
    .map((raw, i) => {
      const s = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
      const description = typeof s.description === 'string' ? s.description.trim() : '';
      const parsed = description ? parseSectionText(description) : null;
      const rows = parsed ? parsed.rows : [];
      const castOn = toSized(s.castOn, 0);

      return {
        name: str(s.name, MaxNameLength) || `Section ${i + 1}`,
        castOn,
        // Fall back to the number of rows we actually read, so the counter has something sane.
        totalRows: toSized(s.totalRows, Math.max(1, rows.length)),
        materials: slotIds(s.usesMaterials, slots.materials),
        tools: slotIds(s.usesTools, slots.tools),
        techniques: slotIds(s.usesTechniques, slots.techniques),
        description,
        rows,
        rowNotes: [],
        notes: '',
        markers: [],
        stitchMultiple: null,
      };
    })
    .filter((s) => s.description || s.rows.length > 0);
}

// A per-size run that doesn't have one entry per size means the sizes were misread — and every
// number in the pattern is then attributed to the wrong size, which is worse than a missing value
// because it looks right. Surfaced in the review card rather than silently corrected.
function sizeMismatches(sections: PatternSection[], sizeCount: number): string[] {
  if (sizeCount < 2) return [];
  const out: string[] = [];
  for (const section of sections) {
    for (const [field, value] of [
      ['cast-on', section.castOn],
      ['row count', section.totalRows],
    ] as const) {
      if (Array.isArray(value) && value.length !== sizeCount) {
        out.push(`${section.name}: ${value.length} ${field} numbers for ${sizeCount} sizes`);
      }
    }
  }
  return out;
}

export function toImportedPattern(data: unknown): ImportedPattern {
  if (typeof data !== 'object' || data === null) {
    throw new Error('The server sent back something unexpected.');
  }
  const d = data as Record<string, unknown>;
  if (typeof d.error === 'string') throw new Error(d.error);

  const draft = (typeof d.draft === 'object' && d.draft !== null ? d.draft : null) as Record<
    string,
    unknown
  > | null;
  if (!draft) throw new Error("The server didn't send back a pattern.");

  // Slots are normalised first: sections refer to them by position, so the ids must exist before
  // the sections can point at them.
  const materials = normaliseMaterials(draft.materials);
  const tools = normaliseTools(draft.tools);
  const techniques = normaliseTechniques(draft.techniques);
  const sizes = normaliseSizes(draft.sizes);

  const sections = normaliseSections(draft.sections, { materials, tools, techniques });
  const rowsCharted = sections.reduce(
    (n, s) => n + s.rows.filter((r) => r.stitches.length > 0).length,
    0,
  );
  const rowsUnparsed = sections.reduce(
    (n, s) => n + s.rows.filter((r) => r.stitches.length === 0).length,
    0,
  );

  return {
    pattern: {
      name: str(draft.name, 120),
      category: oneOf<PatternCategory>(draft.category, [...CATEGORY_ORDER], 'sweaters'),
      // Knitting is the safe default: the app was knitting-only until now, and a pattern wrongly
      // marked crochet would be more confusing than one left at the common case.
      craft: oneOf<TechniqueCraft>(draft.craft, ['knit', 'crochet', 'both'], 'knit'),
      level: oneOf<PatternLevel>(draft.level, LEVELS, 'intermediate'),
      needleSize: str(draft.needleSize, 60),
      // Legacy field, superseded by needleSize — imports never set it.
      weight: '',
      video: '',
      gauge: normaliseGauge(draft.gauge),
      // The knitter's own swatch — never something an import can know.
      swatchGauge: null,
      sizes,
    notes: '',
      materials,
      tools,
      techniques,
      sections,
    },
    notes: str(draft.notes, 600),
    model: typeof d.model === 'string' ? d.model : 'unknown',
    warnings: sizeMismatches(sections, sizes.length),
    summary: { sections: sections.length, rowsCharted, rowsUnparsed },
  };
}

// A whole pattern is a big job — a long PDF measured over a minute in practice, since the model
// reproduces every section's instructions verbatim. The ceiling is generous for that reason, and
// is there to end a hang, not to police a slow read.
const DOCUMENT_TIMEOUT_MS = 180_000;

export async function importPatternDocument(
  text: string,
  options: { model?: string; signal?: AbortSignal } = {},
): Promise<ImportedPattern> {
  const data = await invokeEdgeFunction(
    'parse-pattern',
    { task: 'document', text, model: options.model },
    {
      timeoutMs: DOCUMENT_TIMEOUT_MS,
      signal: options.signal,
      timeoutMessage:
        'Reading this pattern is taking longer than expected. Try again, or import one section at ' +
        'a time by pasting it into a section instead.',
    },
  );
  return toImportedPattern(data);
}
