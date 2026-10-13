-- The basics the catalogue never had, and a link to the stitches that chart them.
--
-- Three things are wrong with the catalogue as it stands.
--
-- First, it is missing the basics. A knitter can look up German short rows and shadow wraps but
-- not the knit stitch or the purl stitch; a crocheter can look up waistcoat stitch and corner-to-
-- corner but not single crochet, double crochet, or the chain they turn with. The catalogue was
-- written outwards from the interesting techniques and never filled in the middle.
--
-- Second, crochet is missing two whole families. Knitting has seven ways to bind off and six ways
-- to increase; crochet had none of either — no fasten off at all, which is how every crochet
-- project in the world ends. One decrease against knitting's six. The library groups by family,
-- so those were empty shelves.
--
-- Third, there are two catalogues of the same ideas with nothing joining them. `STITCHES` in
-- src/constants/catalogs.ts is the chartable vocabulary the counter and the parser read; this
-- table is the library a knitter learns from. Seven concepts already live in both — k2tog, ssk,
-- p2tog, yo, kfb, M1L, M1R — each with its own copy of an abbreviation, agreeing today because
-- somebody typed them the same way twice. `stitch_key` makes the link explicit, and
-- catalogs.test.ts fails if the two ever disagree.
--
-- Tunisian crochet is here too. It is a sub-craft with its own hook, its own fabric and its own
-- stitch names, and the catalogue did not acknowledge it existed.
--
-- Garment and sock construction — heel flaps, gussets, yokes, set-in sleeves — is deliberately
-- NOT here. It is a different kind of thing from "k2tog" and roughly doubles the catalogue again.
--
-- Nothing is renamed or deleted. `id` is a foreign key in saved patterns, project sections and
-- achievement tallies, so the only safe edits are additions and in-place corrections.

-- ---------------------------------------------------------------------------
-- The link to the chartable stitches
-- ---------------------------------------------------------------------------

alter table public.technique_catalogue
  add column if not exists stitch_key text not null default '';

comment on column public.technique_catalogue.stitch_key is
  'The key in STITCHES (src/constants/catalogs.ts) this technique *is*, when it is one — "k2tog", '
  '"sc", "ch". Empty for techniques with no chartable stitch, which is most of them: blocking is '
  'not a stitch. Only concrete stitches are linked, never the generic cast-on/bind-off/marker '
  'actions, which stand for a whole family rather than one technique.';

-- ---------------------------------------------------------------------------
-- The basics, the two empty crochet families, and Tunisian
-- ---------------------------------------------------------------------------

insert into public.technique_catalogue (id, name, craft, family, abbr, stitch_key, summary, aliases) values

-- ---- Knitting: the stitches everything else is made of ----
('knit-stitch','Knit stitch','knit','texture','k','knit','The stitch. Needle through the front, yarn round, pull through. Every other knitting technique is this one bent out of shape.','{"knit","k","plain stitch"}'),
('purl-stitch','Purl stitch','knit','texture','p','purl','A knit stitch worked from the back, so the bump faces you. Knit and purl together make every fabric in the catalogue.','{"purl","p"}'),
('knit-through-back-loop','Knit through back loop','knit','texture','ktbl','ktbl','Into the back of the stitch instead of the front, which twists it closed. Tightens ribbing and firms up a loose stitch.','{"ktbl","k tbl","twisted knit"}'),
('slipping-stitches','Slipping stitches','knit','texture','sl','slip','Moving a stitch across without working it. The basis of mosaic knitting, heel flaps and most decreases that lean left.','{"slip","sl","sl st","slip stitch knitting"}'),

-- ---- Knitting: decreases the catalogue skipped ----
('skp','Slip, knit, pass over','knit','decrease','skp','','Slip one, knit one, lift the slipped stitch over. The older sibling of ssk and still what many patterns write.','{"skpo","sl1 k1 psso","s1 k1 psso"}'),
('k2tog-tbl','Knit two together through back loops','knit','decrease','k2tog tbl','','Two stitches knitted together through their back loops, which leans the decrease left and twists it.','{"k2tog tbl","ktog tbl"}'),
('p3tog','Purl three together','knit','decrease','p3tog','','Three purled as one. The purl-side partner to k3tog, usually on the wrong side of a lace row.','{"p3tog","purl 3 together"}'),

-- ---- Knitting: increases the catalogue skipped ----
('pfb','Purl front and back','knit','increase','pfb','','Purl into the front and then the back of one stitch. The purl-side kfb, bar and all.','{"pfb","purl front and back"}'),
('backward-loop-increase','Backward-loop increase','knit','increase','','','A twist of yarn straight onto the needle mid-row. The quickest increase there is, and the loosest.','{"e-wrap increase","m1 backward loop","single increase"}'),

-- ---- Knitting: the rest ----
('japanese-short-rows','Japanese short rows','knit','shaping','','','Short rows held with a removable marker on the working yarn rather than a wrap. Fiddlier to set up, tidiest to look at.','{"japanese short row","pin short rows"}'),
('double-knitting','Double knitting','knit','texture','','','Two fabrics at once on one pair of needles, joined at the edges. Reversible, twice as thick, and the colourwork comes out mirrored on the back.','{"double knit","dk fabric","reversible knitting"}'),
('entrelac','Entrelac','knit','texture','','','Blocks worked one at a time off the edges of the last row, so the fabric looks woven out of strips.','{"entrelac knitting","basketweave knitting"}'),
('knitting-backwards','Knitting backwards','knit','texture','','','Working left to right without turning. Saves turning on short rows and entrelac blocks.','{"backwards knitting","reverse knitting"}'),
('cable-without-needle','Cabling without a cable needle','knit','texture','','','Slipping the stitches off, holding them, and putting them back in the new order. Faster once trusted, and nothing to drop down the sofa.','{"cable without cable needle","no cable needle"}'),
('lifelines','Lifelines','knit','other','','','Threading waste yarn through a whole row so there is somewhere safe to rip back to. Lace without one is a gamble.','{"lifeline","life line"}'),
('tink','Tink','knit','other','','','Un-knitting one stitch at a time, backwards. "Knit" spelled the way you are going.','{"tinking","un-knitting","unknit"}'),
('dropped-stitch','Picking up a dropped stitch','knit','other','','','Working a runaway stitch back up its ladder with a hook. The rescue every knitter needs before they need it.','{"dropped stitch","picking up dropped stitch","ladder"}'),
('felting','Felting','knit','finishing','','','Shrinking wool on purpose with heat and agitation until the stitches disappear into cloth.','{"fulling","wet felting"}'),

-- ---- Crochet: the stitches everything else is made of ----
('single-crochet','Single crochet','crochet','texture','sc','sc','Hook through, yarn over, pull through, yarn over, through both. The short dense stitch amigurumi is built from. UK calls it double crochet.','{"sc","single crochet","UK double crochet"}'),
('half-double-crochet','Half double crochet','crochet','texture','hdc','hdc','Yarn over first, then through — and off in one go at the end. Between single and double in height and in drape.','{"hdc","half double","UK half treble"}'),
('double-crochet','Double crochet','crochet','texture','dc','dc','Yarn over, through, then off in two pairs. The workhorse of blankets and garments. UK calls it treble.','{"dc","double crochet","UK treble"}'),
('treble-crochet','Treble crochet','crochet','texture','tr','tr','Two yarn overs to start and off in three pairs. Tall, open and quick to cover ground.','{"tr","treble","triple crochet","UK double treble"}'),
('slip-stitch-crochet','Slip stitch','crochet','texture','sl st','slst','Through, yarn over, straight back out. Adds no height — it travels, joins and finishes rather than building fabric.','{"sl st","ss","slip stitch crochet"}'),
('turning-chain','Turning chain','crochet','texture','tch','','The chains at the start of a row that stand in for its first stitch''s height. One for single crochet, three for double. Whether it counts as a stitch is the single commonest way a pattern goes wrong.','{"tch","turning ch","starting chain"}'),
('skip-stitch','Skipping a stitch','crochet','texture','sk','skip','Passing over a stitch of the row below without working into it. The row comes out one shorter, which is what makes lace and shells sit flat.','{"sk","skip","miss a stitch","UK miss"}'),
('back-bump-chain','Working into the back bump','crochet','texture','','','Into the ridge behind the chain rather than its top. Leaves a clean edge that matches the other side.','{"back bump","back ridge","third loop of chain"}'),
('yarn-over-yarn-under','Yarn over vs yarn under','crochet','texture','','','Which way the yarn wraps the hook. Yarn under makes tighter, straighter amigurumi stitches and leans the fabric if used unevenly.','{"yarn under","yarn over amigurumi","yu"}'),
('popcorn-stitch','Popcorn stitch','crochet','texture','PC','','Several tall stitches in one place, the first and last joined so the group pops forward. Rounder and firmer than a bobble.','{"popcorn","PC","pop st"}'),
('filet-crochet','Filet crochet','crochet','texture','','','A grid of filled and empty squares that draws a picture. Chains and doubles, nothing else.','{"filet","filet mesh"}'),
('broomstick-lace','Broomstick lace','crochet','texture','','','Loops drawn up over something very fat — a broomstick, or a huge needle — then worked off in groups into fans.','{"broomstick","jiffy lace","peacock eye"}'),
('hairpin-lace','Hairpin lace','crochet','texture','','','Strips made on a pair of prongs, then joined. Mostly loop, very little stitch.','{"hairpin","hairpin crochet"}'),

-- ---- Crochet: the bind-off family, which did not exist ----
('fasten-off','Fasten off','crochet','bind-off','FO','','Cut the yarn, pull the tail through the last loop, done. How every crochet project ends, and the catalogue did not have it.','{"FO","fasten off","finish off"}'),
('invisible-fasten-off','Invisible fasten off','crochet','bind-off','','','Finishing a round by sewing the tail through the first stitch so the join disappears instead of stepping.','{"invisible finish","invisible fasten off"}'),

-- ---- Crochet: the increase family, which did not exist ----
('single-crochet-increase','Single crochet increase','crochet','increase','sc inc','scinc','Two single crochets into one stitch of the row below. One stitch becomes two.','{"sc inc","2 sc in next st","inc"}'),
('double-crochet-increase','Double crochet increase','crochet','increase','dc inc','dcinc','Two doubles into one stitch. The same idea as a single crochet increase, a row taller.','{"dc inc","2 dc in next st"}'),

-- ---- Crochet: decreases, which had one ----
('sc2tog','Single crochet two together','crochet','decrease','sc2tog','sc2tog','Two stitches worked off together as one. Visible as a small lump — see invisible decrease for amigurumi.','{"sc2tog","single crochet decrease","sc dec"}'),
('dc2tog','Double crochet two together','crochet','decrease','dc2tog','dc2tog','Two doubles joined at the top. The usual decrease in garments and blankets.','{"dc2tog","double crochet decrease","dc dec"}'),

-- ---- Crochet: starting ----
('chainless-starting-double-crochet','Chainless starting double crochet','crochet','cast-on','','','A first stitch built to its own height instead of a turning chain, so the edge has no gap and no stub.','{"chainless starting dc","standing double crochet","alternative turning chain"}'),

-- ---- Tunisian crochet ----
('tunisian-crochet','Tunisian crochet','crochet','texture','','','Half crochet, half knitting: a long hook holds a whole row of live loops, picked up on the way out and worked off on the way back. Makes a dense fabric that curls until it is blocked.','{"tunisian","afghan crochet","afghan stitch"}'),
('tunisian-forward-return-pass','Forward and return pass','crochet','texture','','','The two halves of every Tunisian row — loops gathered onto the hook going right, then worked back off going left. Together they are one row.','{"forward pass","return pass","FwP","RetP"}'),
('tunisian-simple-stitch','Tunisian simple stitch','crochet','texture','Tss','','The default: the hook goes under the front vertical bar. Flat, grid-like, and the ground for Tunisian colourwork.','{"Tss","tss","tunisian simple"}'),
('tunisian-knit-stitch','Tunisian knit stitch','crochet','texture','Tks','','Hook through the middle of the stitch, between the bars, which makes a fabric almost indistinguishable from stocking stitch.','{"Tks","tks","tunisian knit"}'),
('tunisian-purl-stitch','Tunisian purl stitch','crochet','texture','Tps','','Yarn brought in front before picking up the bar. Bumpy, and it curls much less than simple stitch.','{"Tps","tps","tunisian purl"}'),
('tunisian-double-stitch','Tunisian double stitch','crochet','texture','Tds','','A yarn over added before the bar, making a taller, looser and far drapier Tunisian fabric.','{"Tds","tds","tunisian double"}'),
('tunisian-increase','Tunisian increase','crochet','increase','','','Picking up an extra loop between two bars on the forward pass.','{"tunisian inc"}'),
('tunisian-decrease','Tunisian decrease','crochet','decrease','','','Two bars picked up and worked off together on the return pass.','{"tunisian dec","Tss2tog"}'),
('tunisian-bind-off','Tunisian bind-off','crochet','bind-off','','','A row of slip stitches through the bars, which keeps the edge as firm as the fabric above it.','{"tunisian bind off","tunisian cast off"}')

on conflict (id) do update set
  name       = excluded.name,
  craft      = excluded.craft,
  family     = excluded.family,
  abbr       = excluded.abbr,
  stitch_key = excluded.stitch_key,
  summary    = excluded.summary,
  aliases    = excluded.aliases,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Linking the rows that were already here
-- ---------------------------------------------------------------------------
--
-- Only concrete stitches. The generic `co`, `bo` and `pm` in STITCHES stand for a whole family of
-- techniques rather than any one of them, so linking "Standard bind-off" to `bo` would claim that
-- one of seven bind-offs is *the* bind-off.

update public.technique_catalogue as t
set stitch_key = v.stitch_key, updated_at = now()
from (values
  ('k2tog', 'k2tog'),
  ('ssk', 'ssk'),
  ('p2tog', 'p2tog'),
  ('yarn-over', 'yo'),
  ('kfb', 'kfb'),
  ('m1l', 'm1l'),
  ('m1r', 'm1r'),
  ('foundation-chain', 'ch'),
  ('shell-stitch', 'shell')
) as v(id, stitch_key)
where t.id = v.id;

-- ---------------------------------------------------------------------------
-- Corrections
-- ---------------------------------------------------------------------------

-- "Stretchy bind-off" carried the abbreviation JSSBO, which is not a generic short form: it stands
-- for Jeny's Surprisingly Stretchy Bind-Off, one specific method. The summary describes that
-- method ("adds a yarn over before each stitch") and the aliases already list it, so the name was
-- the part that was wrong. Renaming is safe; the id is what patterns point at and it is untouched.
update public.technique_catalogue
set name = 'Jeny''s surprisingly stretchy bind-off', updated_at = now()
where id = 'stretchy-bind-off';

-- Shell stitch is written "shell" in patterns, and STITCHES already says so.
update public.technique_catalogue
set abbr = 'shell', updated_at = now()
where id = 'shell-stitch' and abbr = '';

-- Known and left alone: TCO is on Tubular cast-on, and patterns use it for Turkish cast-on about
-- as often. Both readings are real, so Turkish keeps no abbreviation rather than taking a
-- contested one — the rule from the abbreviations migration holds, that a wrong abbreviation is
-- worse than none because a knitter goes looking for it in patterns that never use it.
--
-- Also left alone: 'RLI / LLI', 'brk / brp' and 'FPdc / BPdc' each hold two short forms in one
-- row. That is the catalogue's own design — Post stitches covers front and back the same way, and
-- Lifted increase already lists RLI and LLI as aliases. Splitting them would mean new ids for
-- halves of a technique knitters look up as one.
