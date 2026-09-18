import { EN, type PatternStrings } from '@/lib/pattern-html';
import type { Pattern } from '@/types/knitwit';

// Taking a pattern apart into the sentences that need translating, and putting it back together.
//
// ## Why a flat list with addresses, and not the pattern itself
//
// The obvious design hands the model the pattern and asks for the pattern back. It fails in a way
// that is hard to see: a model rebuilding a nested object drops a field, renames one, merges two
// sections, or quietly reorders rows — and the result still parses, so nothing complains. The
// knitter finds out at row 40.
//
// So the model never sees the shape. It gets a list of `{ id, text }` and returns a list of
// `{ id, text }`, and the shape is rebuilt here from the original. Anything it fails to return, or
// invents an id for, simply keeps the words it had. The worst case is an untranslated line rather
// than a pattern that has quietly changed.
//
// ## What is deliberately not sent
//
// Numbers, sizes, needle sizes, stitch counts, colours. None of them are language, all of them are
// load-bearing, and a model asked to pass them through is a model given the opportunity to round
// one. They stay exactly where they are.

export type Translatable = { id: string; text: string };

const LABEL = 'label.';
const worthSending = (text: string) => text.trim().length > 0;

// Every piece of language in a pattern, with an address to put it back at.
export function translatableStrings(
  pattern: Pattern,
  strings: PatternStrings = EN,
): Translatable[] {
  const out: Translatable[] = [];
  const add = (id: string, text: string) => {
    if (worthSending(text)) out.push({ id, text });
  };

  // The document's own furniture — "Yarn", "Row", "Notes" — so a translated pattern is not an
  // English form with foreign words in it.
  for (const [key, text] of Object.entries(strings)) add(`${LABEL}${key}`, text);

  add('name', pattern.name);
  add('notes', pattern.notes);

  pattern.materials.forEach((m, i) => add(`m${i}.label`, m.label));
  pattern.techniques.forEach((t, i) => {
    add(`t${i}.name`, t.name);
    add(`t${i}.note`, t.note);
  });
  pattern.tools.forEach((t, i) => add(`o${i}.note`, t.note));

  pattern.sections.forEach((section, si) => {
    add(`s${si}.name`, section.name);
    add(`s${si}.description`, section.description);
    add(`s${si}.notes`, section.notes);
    section.rows.forEach((row, ri) => {
      add(`s${si}.r${ri}.label`, row.label);
      add(`s${si}.r${ri}.instruction`, row.instruction);
    });
    section.rowNotes.forEach((note, ni) => add(`s${si}.n${ni}.text`, note.text));
  });

  return out;
}

// The pattern again, in the other language, with anything untranslated left as it was.
export function applyTranslation(
  pattern: Pattern,
  strings: PatternStrings,
  translated: Translatable[],
): { pattern: Pattern; strings: PatternStrings } {
  const byId = new Map<string, string>();
  for (const entry of translated) {
    if (entry && typeof entry.id === 'string' && typeof entry.text === 'string') {
      if (worthSending(entry.text)) byId.set(entry.id, entry.text);
    }
  }
  // The original is the default for everything, so a model that returns half a pattern produces a
  // half-translated pattern rather than a half-empty one.
  const at = (id: string, fallback: string) => byId.get(id) ?? fallback;

  const nextStrings = Object.fromEntries(
    Object.entries(strings).map(([key, text]) => [key, at(`${LABEL}${key}`, text)]),
  ) as PatternStrings;

  return {
    strings: nextStrings,
    pattern: {
      ...pattern,
      name: at('name', pattern.name),
      notes: at('notes', pattern.notes),
      materials: pattern.materials.map((m, i) => ({ ...m, label: at(`m${i}.label`, m.label) })),
      techniques: pattern.techniques.map((t, i) => ({
        ...t,
        name: at(`t${i}.name`, t.name),
        note: at(`t${i}.note`, t.note),
      })),
      tools: pattern.tools.map((t, i) => ({ ...t, note: at(`o${i}.note`, t.note) })),
      sections: pattern.sections.map((section, si) => ({
        ...section,
        name: at(`s${si}.name`, section.name),
        description: at(`s${si}.description`, section.description),
        notes: at(`s${si}.notes`, section.notes),
        rows: section.rows.map((row, ri) => ({
          ...row,
          label: at(`s${si}.r${ri}.label`, row.label),
          instruction: at(`s${si}.r${ri}.instruction`, row.instruction),
        })),
        rowNotes: section.rowNotes.map((note, ni) => ({
          ...note,
          text: at(`s${si}.n${ni}.text`, note.text),
        })),
      })),
    },
  };
}
