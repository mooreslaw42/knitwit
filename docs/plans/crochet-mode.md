# Knitwit — Crochet mode (not built)

**Status: a reminder, not a plan.** `Pattern.craft` exists and records knit / crochet / both, but
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
