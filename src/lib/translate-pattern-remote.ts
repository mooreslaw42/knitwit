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

const TRANSLATE_TIMEOUT_MS = 120_000;

export type TranslationResult = {
  pattern: Pattern;
  strings: PatternStrings;
  // What the model thought it was reading. Worth keeping: a second share into the same language it
  // is already in has nothing to do.
  sourceLanguage: string;
};

export async function translatePattern(
  pattern: Pattern,
  strings: PatternStrings,
  language: string,
  signal?: AbortSignal,
): Promise<TranslationResult> {
  const entries = translatableStrings(pattern, strings);
  if (entries.length === 0) return { pattern, strings, sourceLanguage: '' };

  const data = await invokeEdgeFunction(
    'parse-pattern',
    { task: 'translate', language, entries },
    {
      timeoutMs: TRANSLATE_TIMEOUT_MS,
      timeoutMessage: 'Translating took too long. Try again in a moment.',
      signal,
    },
  );

  const body = data as { entries?: unknown; sourceLanguage?: unknown };
  const translated: Translatable[] = Array.isArray(body.entries)
    ? (body.entries as Translatable[])
    : [];

  return {
    ...applyTranslation(pattern, strings, translated),
    sourceLanguage: typeof body.sourceLanguage === 'string' ? body.sourceLanguage : '',
  };
}
