# Knitwit — Crochet mode

**Status: the reader is built (2026-09-14). The chart is not.**

## Built

The reading path is craft-aware end to end. `STITCHES` carries crochet entries alongside the
knitting ones with a `craft` tag; `stitchOrderFor(craft)` decides what the editor offers;
`parseSectionText(text, craft)` reads crochet shorthand; the model prompt carries both stitch
tables and the user turn says which applies; and the craft flows from the pattern or project into
all of it. The running-count maths was not touched — it reads `takes` and `delta` and never knew
which craft it was doing, which is why this was vocabulary rather than a second engine.

US stitch names. UK crochet uses the same words one rung down (`CROCHET_UK_TO_US`), and the model
is told to convert as it reads and to refuse rather than guess when it can't tell which convention
a pattern uses — reading UK as US yields a chart that is wrong rather than one that fails.

The chart is built too (2026-09-14), as a real crochet diagram rather than a re-skinned grid.
`crochet-chart.tsx` draws each stitch as a symbol at its own height in `react-native-svg` — a
double crochet stands three times a single because it does in the fabric — and reverses
wrong-side rows, because the work is turned. `StitchChart` dispatches on craft; the knitting grid
is untouched.

## Still not built

- **Rounds, drawn as rounds.** The diagram is linear: rows stacked bottom-up. A motif worked in
  the round is drawn radially, from the centre out, and most amigurumi is worked that way. The
  symbols and heights carry over unchanged; the layout does not. This is the remaining big piece.
- **Craft-aware wording.** Needle, not hook. Rows, not rounds. Cast on, not foundation chain.
- **Stitches worked into a space** rather than a stitch — granny clusters, picots, post stitches
  (fpdc/bpdc), anything into a ch-space. Both the parser and the model refuse these rather than
  substituting something with the wrong `takes`.
- **Dutch, and other languages.** The parser's vocabulary is English regexes. A Dutch pattern —
  `haakpatroon`, `vasten`, `stokjes`, `lossen`, or on the knitting side `breipatroon`, `recht`,
  `averecht`, `omslag` — parses to nothing. The model may cope; the deterministic parser will not.
  This is the same shape of gap as crochet was, and the same seam fixes it: a vocabulary table.

## Original note, kept for the record

**A reminder, not a plan.** `Pattern.craft` exists and records knit / crochet / both, but
it is only a label today — it drives the awards and the library filter and nothing else. Everything
underneath the label is knitting-shaped.

Written down at the point the label was added (2026-09-13), so the gap is on record rather than
discovered later by a crocheter.

## What is currently wrong for a crochet pattern

- **The stitch catalogue is knitting.** `STITCHES` in `src/constants/catalogs.ts` is `k`, `p`,
  `k2tog`, `ssk`, `yo`, `m1l`… A crochet pattern charted with these is nonsense. Crochet needs its
  own vocabulary — `ch`, `sl st`, `sc`, `hdc`, `dc`, `tr`, and the increases and decreases that go
  with them — with their own `takes` and `delta`, since a treble consumes one stitch and makes one
  but a `dc2tog` consumes two.
- **The chart symbols are knitting symbols.** Crochet charts are a different visual language
  altogether: symbols arranged radially for a motif worked in the round, not a grid of cells.
  This is the biggest single piece.
- **The parser reads knitting shorthand.** `parse-pattern-text.ts` knows "k2tog" and "knit to last
  2 sts"; it has never seen "dc in next 3 ch" or "*2dc in next st, ch 1; rep from *".
- **The words are wrong.** Needle, not hook. Rows, not rounds. Cast on, not foundation chain.
- **Gauge in crochet is often per motif**, not per 10cm of fabric — "one square measures 8cm". The
  `Gauge` type already allows this (the window is stored, not assumed), but nothing offers it.
- **The Edge Function prompts describe knitting** and would need a crochet counterpart, or a
  craft-aware branch.

## Rough shape when it happens

1. A second stitch catalogue keyed by craft, so `STITCHES` becomes `STITCHES[craft]` and the
   running-count maths — which is craft-agnostic, since it only reads `takes` and `delta` — keeps
   working untouched.
2. Craft-aware wording, driven off `Pattern.craft`.
3. Crochet shorthand in the parser, and a crochet section in the model prompt.
4. Crochet chart symbols. Worth treating as its own decision: a linear grid is defensible for rows
   worked flat, and genuinely wrong for motifs worked in the round.

Steps 1–3 are comparable in size to the original stitch engine. Step 4 may be larger.

## Why it was deferred

Adding the label was one field and unblocked the awards. Doing the rest properly is a phase, and
doing it badly — crochet patterns silently charted with knitting symbols — would be worse than the
honest gap that exists now.
