# The Calculator, rebuilt as a set of calculators

**Status: phases 1 and 2 built; phases 3 and 4 outstanding.** Written against
`src/app/(tabs)/calculator.tsx` as it stood on `main` (bfe694a), with the screen measured in a
browser rather than read off the source. Everything below the fold describes **that** screen, in the
present tense, because the diagnosis is what the rest of the plan rests on — see Phasing at the
bottom for what has actually shipped since.

The tab is six cards on one route. Each card is well written — a question in the knitter's words, a
clear visual split between what you type and what it works out, and honest copy about what is an
estimate. The trouble is that all six are on top of each other, three of them are the same question
asked twice, two of the three gauges on screen are invented, and the one question a knitter asks
most often — *how much yarn do I need, and what will it cost me* — isn't there at all.

## What's on the screen today

| # | Card | Reads | Writes |
|---|---|---|---|
| 1 | Rescale a stitch count | both gauges, a count, a stitch multiple | `rescaleStitches` |
| 2 | Which needle or hook? | both gauges, craft, your needle | `needleForGauge` → `nearestToolSize` |
| 3 | What gauge on a different tool? | your gauge, craft, two needles | `gaugeAtNeedle` |
| 4 | How wide is this many stitches? | your gauge, one number | `stitchesToCm` / `rowsToCm` |
| 5 | How many stitches is this wide? | your gauge, a measurement | `stitchesPerCm` / `rowsPerCm` |
| 6 | Say a gauge another way | one gauge | `convertGauge` |

Measured in Chrome at 1453px wide: **3,683px of scroll and 21 input controls on one route.** On a
phone, where the paired fields in each `GaugeField` stack, it is closer to half again as long. Past
the first card you cannot see a card's inputs and its answer at the same time, which is the one
thing the card's whole layout was designed to give you.

### Seven gauge forms for two gauges

"The pattern's gauge" is asked three times (cards 1, 2, 6). "Your gauge" is asked five times
(1, 2, 3, 4, 5). Each `GaugeField` is a heading, an optional hint, three window chips and two
number fields — about 150px, and more on a phone. **Most of the tab's height is spent re-asking two
questions.** The file's header comment is candid about the trade:

> The two gauges are still shared state behind the scenes, so filling one in on the first card
> carries to the rest.

It carries to the arithmetic. It does not carry to the fields.

### The duplicates went stale (**fixed**, independently of this plan)

`GaugeField` seeded its three pieces of local string state from `value` **on mount only**:

```ts
const initial = value ? gaugeFields(value) : { stitches: '', rows: '', window: defaultWindow(preferred) };
const [stitches, setStitches] = useState(initial.stitches);
```

So when you change the pattern's gauge on card 1, cards 2 and 6 keep rendering the number you
replaced, while every answer on the screen recomputes from the new one. Reproduced in the browser:
with the pattern's stitch count changed from 22 to 18 on card 1, card 2's own *The pattern's gauge*
box still reads **22**, directly above an answer that says *"the pattern wants 18 × 30 sts/rows per
10cm"*.

An input that disagrees with the answer beneath it is worse than either a wrong input or a wrong
answer, because there is no way to tell from the screen which one the app believes. It is also the
exact failure the card grammar exists to prevent.

Fixed ahead of the restructure, since every card below depends on it. The control now keeps the
gauge its own keystrokes produced (`emitted`) beside the strings, and whenever `value` is not that
gauge — `sameGauge()` in `gauge.ts`, which compares the entry rather than the fabric — the fields
follow `value` and the draft steps aside. The half-typed `"21,"` the local strings existed for still
survives. `gauge-field.test.tsx` covers all three behaviours and fails without the fix.

### The defaults are nobody's knitting

```ts
const DEFAULT_PATTERN: Gauge = { stitches: 22, rows: 30, width: 10, height: 10, unit: 'cm' };
const DEFAULT_MINE: Gauge = { stitches: 20, rows: 28, width: 10, height: 10, unit: 'cm' };
```

Every card is answered on arrival, in filled-in fields that look exactly like typed ones, about a
swatch nobody knitted. The tab draws the input/output line with real care and then leaves the
*mine-or-invented* line undrawn — and that is the line that decides whether the 27 sts on screen is
something you cast on. `NeedsInput` exists, is well designed, and is never seen.

### It asks for everything it already knows

Knitwit holds the pattern's gauge (`Pattern.gauge`), the knitter's measured swatch for that pattern
(`Pattern.swatchGauge`), the pair snapshotted when a project was cast on (`Project.gauge`), each
yarn's gauge and its per-craft gauge (`Material.gauge`, `Material.crafts[craft].gauge`), which
needles and hooks they own (`Tool`), and the metreage, ball weight, price and quantity of every
yarn in the stash. The Calculator asks for all of it by hand. `RegaugePanel` already does card 1's
job against real pattern data, on the pattern screen, with the same `src/lib/gauge.ts` underneath.

### Smaller things

- **Hidden coupling.** `sizeCraft`, `myNeedle` and `tryNeedle` are shared by cards 2 and 3.
  Changing *You swatched on* in card 2 silently changes card 3's answer, off-screen.
- **Cards 4 and 5 are one question in two directions**, and card 4 conflates two of its own: *How
  many stitches / rows?* takes one number and answers both the width of that many stitches and the
  length of that many rows. A knitter has one of the two, not a number that is both.
- **Card 3 is the reverse reading of card 2.** Both run the same 1/size model off the same two
  pickers.
- **Nothing is addressable.** There is no way to link to, or return to, "the needle one".
- **Nothing is keepable.** *"Nothing here is saved"* is offered as reassurance, and for a scratch
  conversion it is. For the cast-on you just worked out for the cardigan you are about to start, it
  is a loss.

## Do these six make sense?

Five of the six are real questions. Ranked by how often a knitter actually asks them:

- **Rescale a stitch count** — the central one. Keep, and let it read a real pattern or project.
- **Stitches ↔ measurement** (4 and 5) — asked constantly, in both directions. **Merge into one
  two-way converter**, with a stitches field and a measurement field, and separate rows/length
  fields instead of one number pretending to be both.
- **Which needle or hook** — asked after every swatch that missed. Keep, and **fold card 3 into it**
  as the other reading of the same model: one needle picker, two answers ("to hit the pattern's
  gauge, try 4.5mm"; "on 4.5mm you'd expect 17.8 sts").
- **Say a gauge another way** — real, but it is a unit conversion, and `GaugeField`'s window chips
  already restate a gauge when you tap one. Its stated job ("if these don't match the pattern in
  your hands, none of the other cards can be trusted") is a sanity check, not a calculator. Keep the
  maths; show it as a line under a gauge rather than as a sixth card.

So **six cards become four calculators**, two of them merges, and the tab gets shorter before a
single new thing is added.

## What's missing

### A. How much yarn do I need? — the gap worth closing first

This is the question asked *before* the money is spent, and it is the one Knitwit is best placed to
answer, because it is the only one of these tools that knows what is already in the cupboard. The
reference the request names, [hennetie.nl/wolcalculator](https://hennetie.nl/wolcalculator/), takes
project type, size, technique, yarn group, needle, metres and grams per ball, price, balls already
owned and an optional gauge, and returns metres, balls, grams, cost and a shopping list. Its logic
(read from `handwerk-tools/assets/hennetie.js`) is a base metreage per garment type scaled by a
chain of factors:

```
metres = base[project]
       × size[xs .82 · s .92 · m 1 · l 1.12 · xl 1.25 · xxl 1.4]   (garments only)
       × yarnGroup[A 1.12 · B 1.00 · C .86 · D .70 · E .58 · F .48]
       × (crochet ? 1.25 : 1)
       × clamp(1 + (midNeedle − needle) × .04, .88, 1.14)
       × clamp(stitches / midGauge, .82, 1.22)                      (if gauge given)
       × clamp(rows / (stitches × 1.35), .94, 1.06)                 (if rows given)
       × (1 + margin/100)
→ rounded up to 10m; balls = ceil(metres / metresPerBall)
```

with bases such as women's sweater 1450m, men's 1650m, cardigan 1600m, blanket 2200m, shawl 850m,
socks 380m, hat 220m. The numbers are DROPS-flavoured but sane, and the shape is right: a table of
garment bases, a few honest multipliers, a reserve, and a clamp on every correction so no single
input can run away with the answer.

Knitwit should offer **two modes, named for how much they can be trusted**:

1. **From a swatch** — the accurate one, and the one nobody else does well. Knit a swatch, measure
   it, weigh it: grams ÷ area gives g/cm², and the garment's area gives the grams. Needs kitchen
   scales, which plenty of knitters have, and it is the only method that knows your yarn and your
   tension rather than a category average. Knitwit can supply the area itself from a project's own
   section measurements once the sections carry widths.
2. **From a project type** — the rough one, the formula above, as our own table in a pure, tested
   `src/lib/yarn-estimate.ts` alongside `gauge.ts`. Garment types should come from
   `PatternCategory` (which already has sweaters, cardigans, shawls, socks, hats, blankets…) rather
   than a second parallel list, and sizes from `SIZE_OPTIONS`.

And then the part that is Knitwit's and not hennetie's: **pick the yarn from the stash**. Selecting a
`Material` fills metres, grams and price per ball from the ball band you already photographed, and
`Material.skeins` — the one field in the model that records what you *own*, and which currently
answers no question anywhere in the app — subtracts to give *buy 4 more, €31.60*.

### B. What will this project cost?

`projectCost()` already exists and the project detail screen shows it. What is missing is the
*before you cast on* version: balls × price, plus `settings.hourlyFee` × an estimated time. It
belongs beside the yarn estimate, because "how much wool" and "how much money" are one errand. For
a project already on the needles, link to its own cost section rather than computing a second
answer from different assumptions.

### C. Increase or decrease evenly across a row

*"Increase 14 sts evenly across 86"* is in nearly every sweater pattern, the arithmetic is fiddly,
and getting it wrong is visible in the finished fabric. The answer wants to be printed the way a
pattern prints it — *k5, m1, [k6, m1] × 13, k5* — and the app already has the stitch vocabulary
(`STITCHES`) to word it.

### D. Shaping from one stitch count to another over a run of rows

Sleeve and waist shaping: 86 sts down to 62 over 72 rows → *"decrease 1 st each end every 7th row 3
times, then every 6th row 9 times"*. **This is nearly free.** `src/lib/regauge.ts` already has
`distributeShaping(rows, count)`, which returns the two intervals a pattern would print, and
`describeIntervals(intervals, delta)`, which words them. Both are pure and tested. The calculator is
a screen over functions that exist.

### E. Will this yarn substitute?

*"The pattern wants that yarn, I have this one."* The honest axis is metres per 100g plus gauge, and
`Material` carries both. Cheap, and asked constantly in yarn shops.

### F. How much is left on this ball?

Weigh the remnant: grams left × (metres per ball ÷ grams per ball) = metres left, and then "enough
for a hat?" against the estimate table from A. Small, and the kind of thing people keep an app for.

Deliberately **not** proposed: sleeve-cap shaping (too pattern-specific to answer honestly),
yardage by fibre content, circular-needle length.

## The shape to build

Exactly the two levels the request describes — pick the question, then answer it on a screen of its
own.

```
src/app/(tabs)/calculator.tsx   the hub: "What do you want to work out?"
src/app/calculator/[tool].tsx   one calculator, full screen, addressable
src/lib/calculators.ts          the registry: id, title, question, icon, group
src/components/calculators/*    one component per calculator
```

One route file rather than ten, driven by a registry that is also what the hub renders, so a
calculator is added in one place and appears in both. No calculator is named `new`, so the
`[id]`-catches-`new` trap in AGENTS.md doesn't apply here — but the registry should be the only
thing that decides what ids exist, so an unknown `[tool]` renders "no such calculator" and a link
back to the hub rather than a blank screen.

**The hub** is a grouped list of `CardLink` rows: a `KnitIcon`, the calculator's name, and the
question in the knitter's words — which is the best thing about the screen today and should be the
thing you choose between. Groups: **Gauge** (rescale, needle, stitches ↔ measurement), **Yarn &
money** (how much yarn, what it costs, substitute, what's left), **Shaping** (evenly across a row,
over a run of rows). Above them, when there is one, a line of real context: *"Hazel cardigan is on
the needles — use its gauge"*, so the calculators can open filled in from a project instead of from
`DEFAULT_PATTERN`.

**On each calculator screen**, what makes input and output unmistakable:

- **One question per screen**, so the inputs and the answer are visible together — which is what
  makes the existing white-input / tinted-well grammar actually work.
- **Each gauge asked once**, at the top, never mirrored. Plus the `GaugeField` fix above, so no
  field can disagree with the answer under it.
- **Empty by default.** Fields start blank with the current defaults demoted to placeholders;
  `NeedsInput` then does its job, and the first number you see in the tinted well is about your
  knitting.
- **Prefilled only from real data, and labelled with where it came from.** A number Knitwit knows is
  worth filling in; a number Knitwit invented is not. How that works is the next section.
- **The answer pinned** to the bottom of the screen on a phone while you type, which only becomes
  possible once a screen holds one question.
- **Keep the working.** Every card today shows what it rounded and why. That survives intact.

**Later, "use this".** A calculator opened from a project can write its answer back where it
belongs: the rescaled cast-on into the section, the yarn estimate into `materialSkeins`. That turns
the tab from a scratchpad into part of the job. It changes the promise from *nothing here is saved*
to *nothing here is saved unless you say so*, and the copy has to change with it.

## Context is a prefill, not a mode

**Decided.** Every calculator takes plain input, always. Arriving from a project, a pattern or a
stash yarn changes nothing about the screen except which fields start filled in.

A "from project" mode would mean two layouts, two empty states and two sets of validation per
calculator, with the project branch exercised only by knitters who have projects. It also takes
something away: a gauge snapshot can be months old, and a read-only project mode tells the knitter
the app knows better than they do. A prefill they can overtype does not.

So:

- **One screen and one code path per calculator.** Cold is the same screen with blank fields.
- **Context arrives as route params** — `/calculator/rescale?project=hazel&section=2` — and does
  exactly one thing: fills fields in and says where each value came from. Read once when the screen
  opens, never live.
- **Every prefilled field stays editable**, and editing one drops its provenance label.
- **Nothing is written back** without an explicit "use this", which is simply absent when nothing
  sent you there. Still not a mode — a button.

The whole mechanism is `{ value, from?: { label, href } }` plus a `PrefilledField` wrapper that
renders the label as a link and clears it on edit. Shared by every calculator, and generic over the
*source*: for the yarn calculators the useful context is a `Material` out of the stash, not a
project at all.

Word the label **"from Hazel cardigan"** — where the number came from — rather than "Hazel
cardigan's gauge", which claims to be what it currently is. The value is a copy taken at open; if
the project changes underneath, the first phrasing is still true, and the label being a link makes
checking one tap.

### Launch it onto the stack, not by switching tabs

A *Calculate the cast-on at my gauge* link on a section must **push** `/calculator/rescale`, so the
back chevron returns to the section it came from. Jumping to the Calculator tab would strand the
knitter with no way back to their row. This is why `calculator/[tool].tsx` sits outside the `(tabs)`
group: it is a pushed screen that wears `DETAIL_SCREEN` like every other detail route, and the hub
inside the tab links to the very same route. One route, two doors, back works from both.

### What each calculator can draw on

| Calculator | Context worth reading | Cold without it? |
|---|---|---|
| Rescale a stitch count | `Project.gauge.{pattern,mine}`, section `castOn`, `stitchMultiple` | yes |
| Which needle or hook | both gauges, section `toolIds` → `Tool.thickness`, craft | yes |
| Stitches ↔ measurement | your gauge | yes |
| Say a gauge another way | any gauge on screen | yes |
| How much yarn | category, size, craft, gauge; a `Material`'s metres/grams/price/`skeins` | **must be** |
| What will it cost | the lot — `projectCost` already has it | **barely** |
| Increase/decrease evenly | the section's live stitch count | yes |
| Shaping over rows | section `castOn`, `totalRows` | yes |
| Yarn substitution | two `Material`s | yes |
| What's left on the ball | one `Material` | yes |

Three break the symmetry and should be decided individually rather than by the blanket rule:

- **Rescale already has its project version, and it is shipped.** `RegaugePanel` renders inside
  `section-stitch-editor.tsx` on both `/pattern/[id]/section/[index]` and
  `/project/[key]/section/[index]/stitches`, with both gauges, the cast-on and the stitch multiple
  supplied. Do not build a second one. The panel does strictly more than the card does — it
  redistributes the whole chart's shaping, not just the cast-on — so it stays, and gains a link into
  the calculator for the knitter who wants to try other numbers.
- **What will it cost is close to meaningless cold**: you would type in everything it computes. Give
  it a project entry point only, and have the hub link to the project's existing cost section rather
  than compute a second answer from different assumptions.
- **How much yarn, project-type mode, must work stone cold.** Answering in a yarn shop before a
  project exists is the entire point. The stash is enrichment there, never a requirement.

## Phasing

1. **Restructure, no new maths. — done.** `src/lib/calculators.ts` as the registry, the hub on the
   tab, `calculator/[tool].tsx` as a pushed screen, six cards down to four, and the invented
   defaults gone. Context arrives as a prefill through `use-calculator-prefill.ts`.

   Two corrections to the plan as written, both found while building it:

   - **"Say a gauge another way" stayed a calculator** rather than being demoted to a line under a
     gauge field. A window chip shows one window at a time; what settles "are these the same
     fabric?" is seeing all three at once. It also makes the six-to-four arithmetic above correct,
     which it was not.
   - **The prefill read the wrong source.** It shipped reading `Project.gauge` alone — 0 of 3 seed
     projects carry one, against 7 of 7 patterns and 3 of 3 yarns — so the hub's project row never
     appeared and `?project=` had no reachable door. It now reads `?pattern=` and `?material=` as
     well, and there are links into it from a pattern, from either kind of section, and from a stash
     yarn.

2. **Yarn and money. — done.** `src/lib/yarn-estimate.ts` carries both modes and the ball/cost
   arithmetic; `yarn-calculator.tsx` is the screen, with the stash filling in metres, grams, price
   and `skeins`. Cost ended up inside it rather than in a calculator of its own, for the reason given
   above: it is one errand.

3. **Shaping and the rest. — not built.** Evenly-across-a-row; shaping over rows, which is nearly
   free over `distributeShaping` and `describeIntervals` in `regauge.ts`; substitution; what is left
   on the ball.

4. **Write-back. — not built.** "Use this" into a project or pattern.

## Still owed on what has shipped

- **None of it has been seen at phone width.** Every screenshot taken while building was desktop;
  `resize_window` had no effect in the browser used. The redesign leans on field borders, a dashed
  outline and three-across field rows that wrap at `minWidth: 110`, all of which want checking on a
  real device or a simulator.
- **The answer is not pinned** to the bottom of the screen on a phone while you type. One question
  per screen gets most of that benefit, which is why it was not in phase 1, but it is still the
  thing that would make a long form on a small screen read properly.

## What the presentation turned into

The plan said "inputs on the white card, the answer in a tinted well" and kept the existing grammar.
Built and looked at, that grammar turned out never to have rendered at all: a text input is `white`
and so is a `Card`, with no border between them, so a field was marked only by the text already in
it — a placeholder `22` was indistinguishable from a typed 22 — and the tinted well was `cream` on a
`cream` page, a 2% difference.

What it is now: fields have an edge (`InputStyle`, and both select controls to match, which fixes
every form in the app); placeholders say "e.g." and sit lighter than any value; each half of a
screen is announced rather than implied ("You fill in", "Knitwit works out"); and the answer is a
solid `sageDeep` block in white text, with its working at reduced opacity and caveats in butter. The
empty answer block is there before there is an answer, outlined in sage and naming what it still
needs.

## One thing found on the way in, unrelated to any of this (**fixed**)

`src/app/pattern/new.test.tsx` lived under the router root, and Expo Router's route context
(`node_modules/expo-router/_ctx.web.js`) only excludes `+api`, `+middleware`, `+html` and
`+native-intent` — **not `.test.tsx`**. So the test file was a route. Two consequences:

- **`npm run web` was broken outright.** The dev server renders every route's module to serve any
  page, the test file calls `jest.mock` at module scope, and so the whole server answered **HTTP
  500** with `ReferenceError: expect is not defined` — on every URL, not just that one.
- **`npx expo export --platform web` succeeded** — exit 0 — but emitted `/pattern/new.test` as a
  public page, so the deployed site carried a route built from a test file.

Note that `__tests__/` is no escape: the context is recursive and matches any `.tsx` beneath the
root. The file moved to `src/__tests__/app/pattern/new.test.tsx` — outside the router root,
mirroring the route path. Every page is back to 200 and the export's `pattern/` directory is down to
`index.html`, `new.html` and `[id].html`. `AGENTS.md` now carries the rule, since the next test of a
route screen would otherwise land in the same trap.
