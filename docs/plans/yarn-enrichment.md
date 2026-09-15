# Filling the gaps a ball band leaves

**Status: proposed, not built.** Written from measurements against the live GreenPT API on
2026-09-15, not from the documentation — the web-search endpoint's price is the one number that is
still a guess, and it is flagged as such.

The photo reader works. This is about the fields it cannot fill, because they are not printed on a
band at all or because the photo only caught one side of it.

## What is actually missing

Measured on a real read: thirteen fields come back from a clean band photo. What does not:

| Field | Why | Findable on the web? |
|---|---|---|
| `price` | Shop-specific, currency-specific, changes | Yes, but wrong as often as right |
| `link` | Not printed | Yes, reliably |
| `strands` | Rarely printed | Sometimes |
| anything the photo missed | Glare, curl of the ball, one side only | Yes — this is the real case |

That last row is the point. A band photographed at an angle loses its tension square; a ball whose
label is half torn off loses its dye lot. Enrichment earns its place by filling *blanks*, not by
second-guessing what the band plainly said.

## What the search actually returns

Measured, `POST /v1/tools/websearch` with `{query, count: 5, language: 'en'}`:

- **2.4 seconds**, 2,257 characters, five results of `{title, link, snippet}`.
- For "DROPS Baby Merino yarn weight yardage meters gram needle size gauge composition", the top hit
  was the Ravelry yarn library page, and the snippets alone carried composition, ball weight and
  weight class.
- The response led with: *"These search snippets already contain the relevant information. Do not
  fetch additional URLs unless absolutely necessary."* So `force_fetch` stays off, which is what
  keeps this cheap — a scraped page would be five to ten times the tokens.

No usage or cost field comes back in the response.

## Cost per read, measured where it can be

| Step | Tokens | Cost |
|---|---|---|
| Photo read (built) | 735 in / 143 out | **€0.0002** |
| Enrichment call over search results | ~1,400 in / ~150 out | **€0.00034** |
| The search itself | — | **unknown** |

Both LLM figures are on `mistral-small-3.2-24b` at €0.20/€0.40 per million.

So the part that can be measured comes to **€0.00054 per yarn** — roughly two and a half times
today's cost, and still a twentieth of a cent.

**The search fee is the dominant unknown.** It is not on GreenPT's pricing page, and the endpoint
does not report it. For scale, commercial search APIs sit between €0.001 and €0.008 per query. If
GreenPT is in that band, the fee is five to twenty times everything else put together — call it
**€0.0015–0.0085 per enriched yarn**, still under a cent, but no longer a rounding error at volume.

Resolve it by running a handful of enrichments and reading the GreenPT account usage page, or by
asking them. Worth knowing before this runs automatically; not worth blocking a prototype over.

## The alternative worth weighing: Ravelry

Ravelry keeps a curated yarn database with exactly these fields — brand, yardage, grams, fibre,
knit and crochet gauge, ply, wpi, texture, photo — searchable by name, with free read-only access
through a developer app and basic auth.

It is better data than a web search: structured, already normalised, no model needed to read it.
The search probe above found Ravelry as its top hit anyway, so this is a question of going to the
source rather than reading somebody's description of it.

Against it: a developer account has to be registered and its credentials kept as a Supabase secret;
the terms need reading before shipping it in an app other people use; and it only knows yarns that
are in its database, which is excellent for commercial yarn and empty for an indie dyer.

## Proposal

**M1 — an enrichment task, blanks only.** A second Edge Function task that takes the brand and
colour the photo already read, searches, and returns the same `MATERIAL_SCHEMA` fields. Two rules
in the prompt and enforced in the client:

- It may only fill fields that are **empty**. What the band said wins; the band is evidence and the
  web is hearsay. A search result that contradicts a photographed tension square is wrong.
- Every field it fills is **marked as coming from the web**, so the knitter knows which values to
  check rather than being handed a form that looks uniformly authoritative.

**M2 — the knitter asks for it.** Not automatic. A "Look up the rest" action on the review step,
shown only when fields are actually blank, with the count in the label ("Look up 4 missing
fields"). Cost is then paid only when it buys something, and nobody is charged for a scan that
already worked.

**M3 — price and link.** `link` is worth taking from search: one URL, verifiable, useful. `price`
is not — it varies by shop, currency and week, and a wrong price in a stash is worse than a blank
one. Offer the link and leave the price to the knitter.

**M4 — Ravelry, if search accuracy disappoints.** Try M1 first, since it costs nothing to set up
and reuses everything. If the misread rate is bad on real yarns, go to the source.

## What would make this a bad idea

Worth stating plainly, because the feature is attractive and the failure is quiet. A search result
for "DROPS Baby Merino" describes *a* DROPS Baby Merino — not necessarily the dye lot in the
knitter's hand, and not necessarily the same colourway's yardage. Filling blanks is safe because a
blank field carries no claim. Overwriting is not. If this ever starts overwriting, it stops being
an assistant and starts being a source of quiet errors in somebody's stash.
