-- Abbreviations for the technique catalogue.
--
-- A pattern almost never writes "slip slip knit"; it writes "ssk". The same goes for M1L, w&t,
-- St st and two dozen others, and a knitter reading a chart or an imported row meets the short
-- form first. Holding it as a column rather than as another alias is the point: an alias exists to
-- be matched against, an abbreviation exists to be shown — beside the name in the library, on the
-- pills that say what a section is worked with, and as a tag on the technique's own page.
--
-- Empty where there genuinely is no standard short form. Nobody abbreviates "Blocking", and
-- inventing one would put words in patterns' mouths — a wrong abbreviation is worse than none,
-- because a knitter would go looking for it in a pattern that never uses it.

alter table public.technique_catalogue
  add column if not exists abbr text not null default '';

comment on column public.technique_catalogue.abbr is
  'What a pattern writes instead of the name — "ssk", "M1L", "w&t". Empty when there is no standard short form.';

-- Only the abbreviation is touched, so a name or summary corrected in the dashboard since the seed
-- ran is left exactly as it is.
update public.technique_catalogue as t
set abbr = v.abbr, updated_at = now()
from (values
  -- ---- Knitting: cast-ons ----
  ('long-tail-cast-on', 'LTCO'),
  ('knitted-cast-on', 'KCO'),
  ('cable-cast-on', 'CCO'),
  ('backward-loop-cast-on', 'BLCO'),
  ('german-twisted-cast-on', 'GTCO'),
  ('tubular-cast-on', 'TCO'),
  ('provisional-cast-on', 'PCO'),
  ('judys-magic-cast-on', 'JMCO'),
  ('turkish-cast-on', ''),
  ('i-cord-cast-on', ''),

  -- ---- Knitting: bind-offs ----
  ('standard-bind-off', 'BO'),
  ('stretchy-bind-off', 'JSSBO'),
  ('sewn-bind-off', ''),
  ('tubular-bind-off', ''),
  ('three-needle-bind-off', '3-needle BO'),
  ('i-cord-bind-off', ''),
  ('picot-bind-off', ''),

  -- ---- Knitting: increases ----
  ('m1l', 'M1L'),
  ('m1r', 'M1R'),
  ('kfb', 'kfb'),
  ('yarn-over', 'yo'),
  ('lifted-increase', 'RLI / LLI'),
  ('m1p', 'M1P'),

  -- ---- Knitting: decreases ----
  ('k2tog', 'k2tog'),
  ('ssk', 'ssk'),
  ('p2tog', 'p2tog'),
  ('ssp', 'ssp'),
  ('cdd', 'cdd'),
  ('k3tog', 'k3tog'),

  -- ---- Knitting: shaping ----
  ('german-short-rows', 'GSR'),
  ('wrap-and-turn', 'w&t'),
  ('shadow-wraps', ''),
  ('raglan-shaping', ''),
  ('short-row-shoulders', ''),

  -- ---- Knitting: texture ----
  ('cables', ''),
  ('brioche', 'brk / brp'),
  ('bobbles', 'MB'),
  ('lace-knitting', ''),
  ('twisted-stitches', 'tbl'),
  ('seed-stitch', 'seed st'),
  ('ribbing', 'rib'),
  ('stocking-stitch', 'St st'),
  ('garter-stitch', 'g st'),

  -- ---- Knitting: colourwork ----
  ('stranded-colourwork', ''),
  ('intarsia', ''),
  ('mosaic-knitting', ''),
  ('duplicate-stitch', ''),
  ('jogless-stripes', ''),

  -- ---- Knitting: joining & finishing ----
  ('kitchener-stitch', ''),
  ('mattress-stitch', ''),
  ('picking-up-stitches', 'PU'),
  ('joining-in-the-round', ''),
  ('magic-loop', ''),
  ('steeking', ''),
  ('blocking', ''),
  ('weaving-in-ends', ''),
  ('buttonholes', ''),
  ('i-cord', ''),

  -- ---- Crochet ----
  ('magic-ring', 'MR'),
  ('foundation-chain', 'ch'),
  ('foundation-single-crochet', 'FSC'),
  ('foundation-double-crochet', 'FDC'),
  ('standing-stitch', ''),
  ('invisible-decrease', 'inv dec'),
  ('back-loop-only', 'BLO'),
  ('front-loop-only', 'FLO'),
  ('post-stitches', 'FPdc / BPdc'),
  ('working-in-spiral', ''),
  ('working-in-joined-rounds', ''),
  ('amigurumi-shaping', ''),
  ('granny-square', ''),
  ('bobble-stitch', 'MB'),
  ('puff-stitch', ''),
  ('cluster-stitch', 'CL'),
  ('shell-stitch', ''),
  ('picot', ''),
  ('waistcoat-stitch', ''),
  ('linen-stitch', ''),
  ('corner-to-corner', 'C2C'),
  ('mosaic-crochet', ''),
  ('tapestry-crochet', ''),
  ('invisible-join', ''),
  ('join-as-you-go', 'JAYG'),
  ('whip-stitch-seam', ''),
  ('slip-stitch-join', 'sl st'),
  ('reverse-single-crochet', 'rev sc'),
  ('surface-crochet', ''),

  -- ---- Either craft ----
  ('gauge-swatch', ''),
  ('joining-new-yarn', ''),
  ('russian-join', ''),
  ('magic-knot', ''),
  ('stitch-markers', 'pm'),
  ('reading-charts', ''),
  ('frogging', '')
) as v(id, abbr)
where t.id = v.id;
