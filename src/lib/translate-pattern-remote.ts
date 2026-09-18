import { invokeEdgeFunction } from '@/lib/edge-function';
import type { PatternStrings } from '@/lib/pattern-html';
import { applyTranslation, translatableStrings, type Translatable } from '@/lib/pattern-translate';
import type { Pattern } from '@/types/knitwit';

// Asking for the pattern in another language.
//
// Through the Edge Function, never from here: the API key is a server-side secret and this app
// ships to the web, where a client-side key is a public one.
//
// Nothing is stored. The translation exists for the length of one share — the pattern in the
// knitter's library stays in the language they wrote it in, because it is theirs and a translation
// is a rendering of it rather than a correction to it.
//
// ## Why it goes in batches
//
// It was one call, which worked on the two-line patterns it was tested with and could not work on
// a real one. A ten-section pattern is 543 separate strings; asking a model to hand all of them
// back is minutes of generation, and the request died at the provider's own timeout every time —
// so translation was not slow for big patterns, it was impossible for them.
//
// Batches are small enough to answer quickly and independent of each other, so several are in
// flight at once and a knitter sees progress rather than a spinner that ends in a 502.

// Small enough that a batch comes back in seconds, large enough that a pattern is tens of calls
// rather than hundreds. Each one carries its own slice of the same instructions.
const BATCH = 40;
// Enough to keep the wait short, few enough not to look like an attack on the endpoint.
const AT_ONCE = 4;
const BATCH_TIMEOUT_MS = 90_000;

export type TranslationResult = {
  pattern: Pattern;
  strings: PatternStrings;
  // What the model thought it was reading. Worth keeping: a second share into the same language it
  // is already in has nothing to do.
  sourceLanguage: string;
  // How many strings came back untranslated. Not an error — those keep their original words — but
  // the knitter should be told rather than handed a half-English document with no explanation.
  missing: number;
};

export type TranslationProgress = { done: number; total: number };

function batches<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function translatePattern(
  pattern: Pattern,
  strings: PatternStrings,
  language: string,
  options: { signal?: AbortSignal; onProgress?: (p: TranslationProgress) => void } = {},
): Promise<TranslationResult> {
  const entries = translatableStrings(pattern, strings);
  if (entries.length === 0) {
    return { pattern, strings, sourceLanguage: '', missing: 0 };
  }

  const groups = batches(entries, BATCH);
  const translated: Translatable[] = [];
  let sourceLanguage = '';
  let done = 0;

  const runOne = async (group: Translatable[]): Promise<void> => {
    const data = await invokeEdgeFunction(
      'parse-pattern',
      { task: 'translate', language, entries: group },
      {
        timeoutMs: BATCH_TIMEOUT_MS,
        timeoutMessage: 'Translating took too long. Try again in a moment.',
        signal: options.signal,
      },
    );
    const body = data as { entries?: unknown; sourceLanguage?: unknown };
    if (Array.isArray(body.entries)) translated.push(...(body.entries as Translatable[]));
    // The first batch to name a language names it. They are all reading the same pattern.
    if (!sourceLanguage && typeof body.sourceLanguage === 'string') sourceLanguage = body.sourceLanguage;
  };

  // A few at a time, in order, so the whole thing is not one long wait and not one big burst.
  for (let i = 0; i < groups.length; i += AT_ONCE) {
    if (options.signal?.aborted) throw new Error('Stopped.');
    const wave = groups.slice(i, i + AT_ONCE);
    // A batch that fails leaves its strings in the original language rather than taking the whole
    // pattern down with it — `applyTranslation` keeps the original words for any id it is not
    // given, so the cost of one bad batch is forty English lines, not a failed share.
    await Promise.all(wave.map((group) => runOne(group).catch(() => undefined)));
    done += wave.reduce((n, group) => n + group.length, 0);
    options.onProgress?.({ done: Math.min(done, entries.length), total: entries.length });
  }

  const returned = new Set(translated.map((entry) => entry?.id));
  return {
    ...applyTranslation(pattern, strings, translated),
    sourceLanguage,
    missing: entries.filter((entry) => !returned.has(entry.id)).length,
  };
}
