# Knitwit — Awards & streaks

Rewarding the knitting, not the app usage. Streaks for showing up, milestones for volume, and
badges for the range of things you've made.

> Plans used to live in `~/.claude/plans/`, which is a hidden folder you can't easily find. This
> one is in the repo. The earlier ones (the stitch engine, pattern import, gauge) are still there
> and can be moved here on request.

## Decisions (settled 2026-09-13)

| # | Decision | Choice |
|---|---|---|
| 1 | What gets recorded | **One entry per active day**, plus lifetime totals that only go up |
| 2 | Streak rule | **Any row counted.** One tap keeps it — a streak is about showing up |
| 3 | Frogging | **A project status.** Frogged leaves your WIP but stays in history |
| 4 | Stitches | **Exact where charted, estimated elsewhere**, and honest about which |
| 5 | Level | **Points from awards, weighted by difficulty**, with each level costing more than the last |

## The problem to solve first

**Nothing in Knitwit is dated.** `Project.started` is free text ("Started Jun 14"), and the only
timestamp in the whole app is the stopwatch's transient `timerStartedAt`. Everything else is
current state: this project is on row 43, that section took 900 seconds.

Current state can't answer "how many days in a row", and it goes *backwards* — delete a project and
a derived "10 projects finished" becomes nine. An award you can lose by tidying up is worse than no
award. So the first phase is a record that only ever grows.

## The shape

```ts
// One per day the knitter actually knitted. Keyed by local date, because a streak is about their
// days, not UTC's — knitting at 11pm and again at 1am is two days; at 11pm and 00:30 is not.
type ActivityDay = {
  date: string;      // YYYY-MM-DD, local
  rows: number;
  stitches: number;
  seconds: number;
};

type Achievements = {
  // Monotonic. Deleting a project never takes back what was knitted.
  totals: {
    rows: number;
    stitches: number;
    seconds: number;
    projectsFinished: number;
    projectsFrogged: number;
    patternsCreated: number;
    techniquesAdded: number;
  };
  finishedByCategory: Record<PatternCategory, number>;  // for the "one of each" badges
  finishedByPattern: Record<string, number>;            // for "made this three times"
  days: ActivityDay[];
  earned: Record<string, string>;                       // award id → date earned
};
```

Two numbers per concept — a lifetime total *and* a per-day log — is deliberate. The totals answer
"have I hit 10,000 stitches" in one read and can never regress. The days answer "am I on a streak"
and nothing else needs them. Roughly 40 bytes a day: a decade of daily knitting is under 150KB.

**Cap the log at two years**, trimming oldest first. Totals are separate, so trimming loses only
the ability to recompute a very old streak.

## Where the numbers come from

| Recorded when | Feeds |
|---|---|
| `changeRow` with a positive delta | today's rows + stitches, lifetime rows + stitches |
| the stopwatch stops | today's seconds, lifetime seconds |
| a project's last row is counted | `projectsFinished`, `finishedByCategory`, `finishedByPattern` |
| a project is marked frogged | `projectsFrogged` |
| `savePattern` with no id | `patternsCreated` |
| `saveTechnique` with no id | `techniquesAdded` |

**Only forward counts.** Tapping back a row doesn't subtract — you knitted it. It doesn't add
either. Tapping +1/−1 repeatedly would inflate the total, which is accepted: this is a personal
tracker, and the alternative (a per-section high-water mark) is more state for a problem nobody
has.

### Stitches

Per row, the stitches worked are the live stitch count entering that row:

- **Charted section** — exact, from `sectionRowCounts`, which already exists and is what the
  chart and counter both read.
- **Uncharted section with a cast-on** — the cast-on, as a flat estimate.
- **Neither** — the row counts, the stitches don't.

That last case is most improvised projects today, so the awards screen should say the stitch total
is a lower bound rather than implying precision it doesn't have.

## Project status

New: `Project.status: 'active' | 'finished' | 'frogged'`, defaulting to `'active'`.

Precedence: a stored status wins; an `'active'` project still counts as finished when every row is
counted. That keeps today's derived behaviour and adds two things it couldn't express — declaring
something done before the last row, and frogging.

Frogged projects leave Home and the WIP count, stay on the Projects tab under their own filter, and
count once toward the frogging award. **Frogging is not undoable in the awards** — the count is
lifetime, so unfrogging a project doesn't take the badge back.

## The awards

Each is a metric, a threshold and a group. Progress is `min(metric / goal, 1)`, and *"next award"*
is the unearned one closest to done.

| Group | Awards |
|---|---|
| **Streak** | 3 days · 7 · 30 · 100 |
| **Volume** | 1,000 stitches · 10,000 · 100,000 · 1,000,000 |
| **Time** | 1 hour · 10 · 100 |
| **Finishing** | first finish · 5 · 25 |
| **Range** | finish a sweater · a hat · a scarf · socks · a blanket · and one of every category |
| **Devotion** | make the same pattern twice · three times · five |
| **Making** | first pattern created · 5 · 25 · first technique noted · 10 |
| **Frogging** | first frogging ("rip it, rip it") · 5 |

Names and copy are a pass of their own — the mechanics come first.

## Level

A single number that goes up as awards unlock, so there's a sense of progress between milestones
that might be months apart.

Each award carries **points by how hard it is** — 5 for a first step, 10 for a habit, 25 for real
persistence, 50 for the long hauls. Flat points would make "note your first technique" worth as
much as a hundred-day streak, which would make the level meaningless as a summary.

**Each level costs 10 points more than the one before it**: level 2 at 10 points, 3 at 30, 4 at 60,
5 at 100, 6 at 150. Early levels come quickly, which is the point — the first hour with the app
should show movement — and later ones take the kind of sustained knitting they're meant to
represent. The formula is `5n(n-1)` for the nth level, so it never needs a hand-maintained table.

The level is **derived, never stored**: it's a function of which awards are earned, so it can't
drift from them and needs no migration when the catalogue changes. Adding an award later can move
someone up a level retroactively, which is the right way round.

## Home

The three counters (Active / Saved patterns / Done) become:

- **WIP** — projects on the needles, already computed
- **Streak** — days, with today's status ("2 days · knit today to keep it")
- **Next award** — the closest unearned one, as name + `N of M`

Tapping the third goes to the awards list.

## Where awards live

A screen reached from Account and from the Home stat, rather than a seventh menu item — the menu
was just trimmed from seven to six by moving Materials into Library, and this doesn't warrant
undoing that.

## Open question: craft type

Two of the awards you listed — "crochet scarf" as distinct from a knitted one — can't be answered
today. `Material` has `craftType` and `Technique` has `craft`, but **`Pattern` has only a category**,
so nothing knows whether a scarf was knitted or crocheted.

Options, in rough order of effort: infer it from the tools a pattern uses (a crochet hook implies
crochet — cheap, mostly right, silently wrong when tools are unset); add `craft` to `Pattern`, ask
for it in the wizard, and let the importer fill it (correct, and useful well beyond awards);
or drop the craft distinction and award by category alone.

Worth deciding before the Range group is built, not before the rest.

## Phases

- **A1 — Recording.** `Achievements` in the store, the hooks above, `Project.status`, migration.
  No UI. Pure additions; nothing existing changes behaviour.
- **A2 — Awards.** The catalogue, progress and streak computation. Pure and unit-tested — a streak
  that miscounts across a month boundary or a daylight-saving shift is the obvious failure.
- **A3 — Screens.** The Home stats, the awards list, the frogged filter on Projects.
- **A4 — The earning moment.** Something happens when you cross one, rather than finding out later.
  Deliberately last: it's the part that's worthless if the numbers underneath are wrong.

## Non-negotiables

- **Totals never decrease.** Deleting, frogging and tidying up cost you nothing.
- **The streak reflects knitting**, not app usage. Editing a pattern is not a knitting day.
- **Estimated numbers say they're estimated.** A stitch count that quietly guesses is worse than
  one that admits it's a floor.
