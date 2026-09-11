import { invokeEdgeFunction } from '@/lib/edge-function';
import type { ParseIssue } from '@/lib/parse-pattern-text';
import type { PatternRow, PatternStitchGroup, SizedNumber } from '@/types/knitwit';

// The model half of the hybrid parser. `parse-pattern-text.ts` handles the regular shorthand and
// refuses what it can't chart faithfully; this asks the model for exactly those refusals, and
// merges what comes back into the rows we already have.
//
// The model is called through a Supabase Edge Function, never from here directly — the API key is
// a server-side secret, and the app ships to the web where any client-side key is public.

export type RemoteRowResult = {
  index: number;
  stitches: PatternStitchGroup[];
  confident: boolean;
  note: string;
};

export type RemoteParseResult = {
  model: string;
  rows: RemoteRowResult[];
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
  };
};

// A handful of rows is a small job; if it hasn't come back by now something is wrong.
const ROWS_TIMEOUT_MS = 90_000;

let uid = 0;
const nextId = () => `g${Date.now().toString(36)}${uid++}`;

// Which rows a local parse couldn't chart. A row that came back with no stitch groups is one the
// tokenizer refused — it kept the wording, but drew nothing.
export function unparsedRowIndexes(rows: PatternRow[]): number[] {
  return rows.reduce<number[]>((out, row, i) => {
    if (row.stitches.length === 0 && row.instruction.trim()) out.push(i);
    return out;
  }, []);
}

// The wire format sends one count per size; collapse it back to the app's `SizedNumber`, where a
// value that's the same for every size stays a plain number.
function toSizedNumber(count: number[]): SizedNumber | null {
  if (count.length === 0) return null;
  if (count.every((n) => n === count[0])) return count[0];
  return count;
}

function toGroup(raw: unknown): PatternStitchGroup | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const g = raw as Record<string, unknown>;
  const type = typeof g.type === 'string' ? g.type : '';
  const span = g.span === 'all' || g.span === 'to-last' ? g.span : 'exact';
  if (!type) return null;
  const count = Array.isArray(g.count)
    ? g.count.filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
    : [];
  return {
    id: nextId(),
    type,
    span,
    count: span === 'all' ? null : toSizedNumber(count),
    materialSlot: null,
    note: typeof g.note === 'string' ? g.note : '',
  };
}

// Parse the function's response defensively — it crosses a network boundary and a runtime we
// don't typecheck together with this one, so nothing here assumes the shape is right.
export function toRemoteParseResult(data: unknown): RemoteParseResult {
  if (typeof data !== 'object' || data === null) {
    throw new Error('The server sent back something unexpected.');
  }
  const d = data as Record<string, unknown>;
  if (typeof d.error === 'string') throw new Error(d.error);
  if (!Array.isArray(d.rows)) throw new Error('The server sent back no rows.');

  const rows: RemoteRowResult[] = [];
  for (const raw of d.rows) {
    if (typeof raw !== 'object' || raw === null) continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.index !== 'number') continue;
    const stitches = (Array.isArray(r.stitches) ? r.stitches : [])
      .map(toGroup)
      .filter((g): g is PatternStitchGroup => g !== null);
    rows.push({
      index: r.index,
      stitches,
      confident: r.confident === true && stitches.length > 0,
      note: typeof r.note === 'string' ? r.note : '',
    });
  }

  const usage = (typeof d.usage === 'object' && d.usage !== null ? d.usage : {}) as Record<
    string,
    unknown
  >;
  const num = (v: unknown) => (typeof v === 'number' ? v : 0);

  return {
    model: typeof d.model === 'string' ? d.model : 'unknown',
    rows,
    usage: {
      input_tokens: num(usage.input_tokens),
      output_tokens: num(usage.output_tokens),
      cache_read_input_tokens: num(usage.cache_read_input_tokens),
      cache_creation_input_tokens: num(usage.cache_creation_input_tokens),
    },
  };
}

// Fold the model's rows into the locally parsed ones. Rows the tokenizer already charted are left
// exactly as they were — the model is only ever asked about, and only ever applied to, refusals.
// Rows it wasn't confident about are still applied (so the knitter can see and fix them) but come
// back as issues, which is also how the chart flags them for review.
export function mergeRemoteRows(
  rows: PatternRow[],
  remote: RemoteRowResult[],
): { rows: PatternRow[]; issues: ParseIssue[] } {
  const byIndex = new Map(remote.map((r) => [r.index, r]));
  const issues: ParseIssue[] = [];

  const merged = rows.map((row, i) => {
    const result = byIndex.get(i);
    if (!result) return row;
    if (result.stitches.length === 0) {
      issues.push({
        rowIndex: i,
        message: `Row ${i + 1}: ${result.note || "couldn't be charted — the wording needs a human."}`,
      });
      return row;
    }
    if (!result.confident) {
      issues.push({
        rowIndex: i,
        message: `Row ${i + 1}: charted, but check it — ${result.note || 'the wording was ambiguous.'}`,
      });
    }
    return { ...row, stitches: result.stitches };
  });

  for (const [index] of byIndex) {
    if (index < 0 || index >= rows.length) {
      issues.push({ rowIndex: null, message: `Ignored a charted row ${index + 1} that isn't here.` });
    }
  }

  return { rows: merged, issues };
}

// Ask the model to chart the rows the tokenizer refused.
export async function convertRowsRemotely(params: {
  sectionText: string;
  rows: PatternRow[];
  indexes: number[];
  sizes: string[];
  stitchesBefore: number;
  model?: string;
}): Promise<RemoteParseResult> {
  const payload = {
    task: 'rows' as const,
    sectionText: params.sectionText,
    sizes: params.sizes,
    stitchesBefore: params.stitchesBefore,
    model: params.model,
    rows: params.indexes.map((index) => ({
      index,
      label: params.rows[index]?.label ?? `Row ${index + 1}`,
      side: params.rows[index]?.side ?? 'RS',
      instruction: params.rows[index]?.instruction ?? '',
    })),
  };

  const data = await invokeEdgeFunction('parse-pattern', payload, {
    timeoutMs: ROWS_TIMEOUT_MS,
    timeoutMessage: "That took too long. Try again, or chart the row yourself — it's still here.",
  });
  return toRemoteParseResult(data);
}
