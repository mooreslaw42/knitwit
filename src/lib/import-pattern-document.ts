import { CATEGORY_ORDER, SIZE_OPTIONS } from '@/constants/catalogs';
import { parseSectionText } from '@/lib/parse-pattern-text';
import { getSupabase } from '@/lib/supabase';
import type {
  Pattern,
  PatternCategory,
  PatternLevel,
  PatternMaterial,
  PatternSection,
  PatternTechnique,
  PatternTool,
  SizedNumber,
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

// "24" out of "24 sts per 10cm" — the gauge fields are numeric inputs in the wizard.
function digits(v: unknown): string {
  const match = str(v).match(/\d+/);
  return match ? match[0] : '';
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
        label: str(m.label, 120) || `Yarn ${String.fromCharCode(65 + i)}`,
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
      return { id: nextId('tq'), name: str(t.name, 80), note: str(t.note, 300) };
    })
    .filter((t) => t.name);
}

// Each section's instructions go straight through the deterministic parser, so the knitter lands
// on a pattern that is already charted wherever charting was possible — and the rows it refused
// are exactly the ones the per-section "Read it with AI" button exists for.
function normaliseSections(v: unknown): PatternSection[] {
  return arr(v)
    .slice(0, 40)
    .map((raw, i) => {
      const s = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
      const description = typeof s.description === 'string' ? s.description.trim() : '';
      const parsed = description ? parseSectionText(description) : null;
      const rows = parsed ? parsed.rows : [];
      const castOn = toSized(s.castOn, 0);

      return {
        name: str(s.name, 80) || `Section ${i + 1}`,
        castOn,
        // Fall back to the number of rows we actually read, so the counter has something sane.
        totalRows: toSized(s.totalRows, Math.max(1, rows.length)),
        materials: [],
        tools: [],
        techniques: [],
        description,
        rows,
        notes: [],
        markers: [],
      };
    })
    .filter((s) => s.description || s.rows.length > 0);
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

  const sections = normaliseSections(draft.sections);
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
      level: oneOf<PatternLevel>(draft.level, LEVELS, 'intermediate'),
      needleSize: str(draft.needleSize, 60),
      // Legacy field, superseded by needleSize — imports never set it.
      weight: '',
      video: '',
      gaugeStitches: digits(draft.gaugeStitches),
      gaugeRows: digits(draft.gaugeRows),
      sizes: normaliseSizes(draft.sizes),
      materials: normaliseMaterials(draft.materials),
      tools: normaliseTools(draft.tools),
      techniques: normaliseTechniques(draft.techniques),
      sections,
    },
    notes: str(draft.notes, 600),
    model: typeof d.model === 'string' ? d.model : 'unknown',
    summary: { sections: sections.length, rowsCharted, rowsUnparsed },
  };
}

export async function importPatternDocument(text: string, model?: string): Promise<ImportedPattern> {
  const { data, error } = await getSupabase().functions.invoke('parse-pattern', {
    body: { task: 'document', text, model },
  });
  if (error) {
    const body = await readErrorBody(error);
    throw new Error(body ?? "Couldn't reach the pattern reader. Check your connection and retry.");
  }
  return toImportedPattern(data);
}

// supabase-js hides the function's own error message behind a generic FunctionsHttpError; the
// useful text is in the response body.
async function readErrorBody(error: unknown): Promise<string | null> {
  const context = (error as { context?: unknown }).context;
  if (typeof context !== 'object' || context === null) return null;
  const response = context as { json?: () => Promise<unknown> };
  if (typeof response.json !== 'function') return null;
  try {
    const body = await response.json();
    const message = (body as Record<string, unknown> | null)?.error;
    return typeof message === 'string' ? message : null;
  } catch {
    return null;
  }
}
