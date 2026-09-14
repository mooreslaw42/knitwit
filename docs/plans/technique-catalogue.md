# Knitwit — A central technique catalogue

**Status: T1–T4 built 2026-09-14. T5 (picking) and T6 (import) outstanding.**

Decided by survey: the catalogue is a **Supabase table** (`public.technique_catalogue`), cached in
the persisted store so the tab works offline after first load; a knitter **can** still add one of
their own, marked as theirs and never matched from a pattern; the default view shows **anything
they've marked**, with the rest behind Browse; **videos are left empty** for now.

## Where things stand

A technique today is whatever the knitter types: `{ name, craft, notes, link }`, stored per user,
created by hand. Three consequences:

- **Nothing lines up.** "Kitchener stitch", "kitchener", "grafting" and "Kitchener st" are four
  techniques. Nothing can count them, group them or teach them.
- **There is nowhere to put a video.** There's a `link` field and no reason for anyone to fill it
  in one knitter at a time.
- **Pattern import invents.** `PatternTechnique` is `{ id, name, note }` written fresh per pattern,
  so importing two patterns that both use German short rows produces two unrelated records.

## The shape

Split what is true for everyone from what is true for one knitter.

```ts
// Curated. Ships with the app, identical for every user.
type CatalogueTechnique = {
  id: string;            // stable slug: 'german-short-rows'. Never renamed — it's a foreign key.
  name: string;
  craft: TechniqueCraft;
  family: 'cast-on' | 'bind-off' | 'increase' | 'decrease' | 'joining'
        | 'colourwork' | 'shaping' | 'texture' | 'finishing' | 'other';
  summary: string;       // one line, what it is and when you'd reach for it
  aliases: string[];     // what patterns actually call it, for matching
  video: string;
  link: string;
};

// What one knitter records about one technique.
type TechniqueStatus = 'want' | 'learning' | 'known';
type UserTechnique = {
  status: TechniqueStatus;
  notes: string;         // theirs, kept alongside the catalogue's summary
  addedOn: string;
};
```

The store's `techniques: Record<string, Technique>` becomes
`techniques: Record<CatalogueTechniqueId, UserTechnique>` — keyed by the catalogue's slug, so two
knitters' "German short rows" are the same thing and a pattern can point at it.

`ProjectSection.techniqueIds` and the pattern's technique references become catalogue slugs. That
is a straight simplification: they currently point at per-user ids that mean nothing to anyone
else, which is exactly why a project's techniques can't survive being saved as a pattern for
someone else to knit.

## The work

**T1 — The catalogue.** `src/constants/technique-catalogue.ts`: the data, plus `techniqueById`,
`matchTechnique(text)` for the import path, and a family/craft index. Around 70–90 entries to
start, covering the cast-ons, bind-offs, increases, decreases, joins, colourwork and finishing a
pattern actually names, both crafts.

**T2 — Store and migration.** The keying change above, with a hydration repair that matches each
existing user technique to a catalogue entry by name and alias. Their notes come across. Anything
unmatched is handled per the decision below.

**T3 — The Techniques view.** Default to what the knitter has; a toggle to browse the rest; craft
chips (`matchesCraft`, already shared with the Projects list); family grouping; status set from
the row without opening it.

**T4 — The technique screen.** Catalogue content read-only — name, craft, family, summary, video,
reference. The knitter's own notes and status editable, saved as you type, like the notes work.

**T5 — Picking, not typing.** The section kit picker already offers the knitter's techniques as
chips; it gains a "find another" path into the catalogue that sets status `want` on the way in.

**T6 — Import.** The model is given the catalogue's slugs and names in the system prompt — it is
cached, so the list costs nothing per call — and returns slugs. `matchTechnique` catches what it
misses by alias. A technique it can't place keeps its wording (see assumptions).

## Assumptions (stated, not asked)

- **Nothing the pattern says is discarded.** A technique the catalogue doesn't have keeps its
  wording on the pattern, the way an unparseable row keeps its instruction. That rule is already
  how the parser and the importer behave and this follows it.
- **Slugs are permanent.** They are foreign keys in saved patterns, projects and achievement
  tallies. Labels and summaries can be edited freely; ids cannot. Same rule as `PatternCategory`.
- **`techniquesAdded`** in the achievements tally starts counting techniques *learnt* rather than
  records created, since creating one is no longer a thing you do.
