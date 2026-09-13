# Knitwit — Everything a pattern holds, in a project without one

**Status: proposed, not built.** Written 2026-09-13.

A project improvised without a pattern should be able to hold everything a pattern holds. Today it
can't: the model is missing fields, and the fields it does have are missing an editor.

## Where the two stand

### A section

| `PatternSection` | `ProjectSection` | State |
|---|---|---|
| `name` | `name` | fine |
| `totalRows` (per size) | `totalRows` (resolved) | fine — a project is one size |
| `castOn` (per size) | `castOn` (resolved) | **present, not editable** |
| `materials[]` | `materialIds[]` | done |
| `tools[]` | `toolIds[]` | done |
| `techniques[]` | `techniqueIds[]` | done |
| `notes` | `notes` | fine (added from the counter) |
| `markers` | `markers` | **present, not editable** |
| `rows[]` | `rows[]` | **present, no editor reachable** |
| `description` | — | **missing** |
| `stitchMultiple` | — | **missing** |

### A pattern

| `Pattern` | `Project` | State |
|---|---|---|
| `name` `craft` `photo` | same | fine |
| `accentColor` | `color` | fine |
| `gauge` / `swatchGauge` | `gauge.pattern` / `gauge.mine` | fine |
| `sizes` | `sizeIndex` | fine — a project is knitted in one size |
| `sections` | `sections` | fine |
| `materials` `tools` `techniques` (generic slots) | resolved against the stash | fine, by design |
| `needleSize` | — | missing |
| `sourceName` / `sourceText` | — | missing |
| `category` | — | missing |
| `level` | — | missing |
| `video` | — | missing |
| `favorited` | — | not wanted; a project isn't a library card |
| `weight` | — | legacy, dead on new patterns |

The section row is the real gap and the one that was noticed: **you cannot write down what you
knitted, and you cannot chart it.**

## The work

### P1 — Extract the stitch editor

`src/app/pattern/[id]/section/[index].tsx` is 802 lines and does all of it: the description box,
the deterministic parse, the AI read, cast-on, row CRUD, the chart, the running stitch counts and
the re-gauge panel. None of it is really pattern-specific — it takes `{description, castOn, rows}`
and hands the same three back.

Pull it into `<SectionStitchEditor>` taking one size's worth of numbers, with the pattern screen
supplying its size-preview chips and `SizedNumber` on top. The pattern screen becomes a thin
wrapper; the project screen is a second thin wrapper. One editor, so the two can't drift.

This is the biggest single piece and the one that carries risk: it's a working screen that took
several passes to get right. It gets done first and separately, with the pattern side verified
unchanged before anything is built on it.

### P2 — The two missing section fields

`description: string` and `stitchMultiple: StitchMultiple | null` on `ProjectSection`. Repaired on
hydration in `merge`, keyed off the shape — the same place and for the same reason as the kit
lists.

### P3 — A stitch screen for a project section

`/project/[key]/section/[index]/stitches`, the extracted editor, a `setSectionStitches` store
action. Marker editing comes along here too, since it's already in the editor.

### P4 — Pattern metadata on a project

Full parity, decided 2026-09-13: `needleSize`, `sourceName`, `sourceText`, `category`, `level` and
`video` all move onto `Project`. The conversion form is then pre-filled from real values rather
than defaulted — `categoryFromName` becomes the seed for a *new* project's category rather than a
guess made at conversion time.

### P5 — Conversion carries the real values

`projectToPattern` currently falls back to the source pattern for `description` and
`stitchMultiple`, because a project had nowhere to keep its own. Once it does, the project's own
values win and the fallback only covers what the project never touched. Whatever P4 adds
pre-fills the conversion form instead of being defaulted or guessed from the name.

## Decisions

Asked and answered 2026-09-13:

- **Any project section's chart can be edited**, pattern-linked or not. Divergence from the source
  pattern is the point rather than a hazard — it's what makes "Save my version as a new pattern"
  worth having. The source pattern is never written to.
- **Full metadata parity** (see P4).
- **The AI read is offered on a project section too**, same seam and same cost as a pattern. An
  improvised section's notes are exactly the loose prose it handles best.

## Assumptions (not asked, but stated)

- **A project stays one size.** It is one physical thing on one set of needles. Per-size numbers
  resolve at creation and a converted pattern is a one-size pattern. Nothing here changes that.
- **`favorited` and `weight` don't cross.** The first is a library affordance, the second is dead.
- **The re-gauge panel comes with the editor** rather than being cut out of it, so a project can
  re-gauge its own chart the way a pattern can.
