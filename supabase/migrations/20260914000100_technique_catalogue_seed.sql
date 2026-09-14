-- The starting catalogue. Separate from the table definition so the data can be re-run, extended
-- and corrected without touching the schema.
--
-- `on conflict do update` rather than `do nothing`: re-running this is how a summary gets fixed.
-- It deliberately does not touch rows that aren't listed here, so anything added through the
-- dashboard survives.

insert into public.technique_catalogue (id, name, craft, family, summary, aliases) values

-- ---- Knitting: cast-ons ----
('long-tail-cast-on','Long-tail cast-on','knit','cast-on','The everyday cast-on: stretchy, tidy, and it counts as a row. Leave a tail about three times the width you need.','{"long tail","long-tail","LT cast on"}'),
('knitted-cast-on','Knitted cast-on','knit','cast-on','Cast on by knitting into the last stitch and putting the new loop back. Easy to add stitches mid-row.','{"knit-on cast on","knitted on"}'),
('cable-cast-on','Cable cast-on','knit','cast-on','Worked between the last two stitches. Firmer than knitted-on, good for buttonhole edges.','{"cable cast on"}'),
('backward-loop-cast-on','Backward-loop cast-on','knit','cast-on','A twist of yarn over the needle. Quickest way to add a few stitches, loose on its own.','{"backwards loop","e-wrap","single cast on"}'),
('german-twisted-cast-on','German twisted cast-on','knit','cast-on','A long-tail variant with an extra twist. Noticeably stretchier — sock cuffs and ribbed hems.','{"old norwegian cast on","twisted german"}'),
('tubular-cast-on','Tubular cast-on','knit','cast-on','Gives ribbing a rounded, professional edge that looks like the fabric folded over.','{"invisible cast on","italian cast on"}'),
('provisional-cast-on','Provisional cast-on','knit','cast-on','Cast on over waste yarn so the stitches can be picked up live later.','{"crochet provisional","waste yarn cast on"}'),
('judys-magic-cast-on','Judy''s magic cast-on','knit','cast-on','Casts on two sets of live stitches at once. The standard start for toe-up socks.','{"magic cast on","judys magic"}'),
('turkish-cast-on','Turkish cast-on','knit','cast-on','Wraps the yarn round two needles to start a seamless closed tube.','{"turkish"}'),
('i-cord-cast-on','I-cord cast-on','knit','cast-on','Starts the piece with a rolled i-cord edge already attached.','{"icord cast on"}'),

-- ---- Knitting: bind-offs ----
('standard-bind-off','Standard bind-off','knit','bind-off','Knit two, pass the first over. The default, and firmer than most fabric wants.','{"basic bind off","cast off","chain bind off"}'),
('stretchy-bind-off','Stretchy bind-off','knit','bind-off','Adds a yarn over before each stitch so the edge gives. For sock cuffs and top-down necklines.','{"jenys surprisingly stretchy","jssbo","surprisingly stretchy"}'),
('sewn-bind-off','Sewn bind-off','knit','bind-off','Sewn with a tapestry needle. Very elastic, matches a long-tail cast-on.','{"elizabeth zimmermann sewn","ez sewn bind off"}'),
('tubular-bind-off','Tubular bind-off','knit','bind-off','The mirror of a tubular cast-on — a rounded edge on ribbing.','{"kitchener bind off","italian bind off"}'),
('three-needle-bind-off','Three-needle bind-off','knit','bind-off','Binds off two sets of live stitches together, joining and finishing in one pass. Shoulders.','{"3 needle bind off"}'),
('i-cord-bind-off','I-cord bind-off','knit','bind-off','Works a small i-cord along the edge as it binds off. Neat, firm, decorative.','{"icord bind off"}'),
('picot-bind-off','Picot bind-off','knit','bind-off','Casts on and binds off in turn to leave a row of little points.','{"picot edge"}'),

-- ---- Knitting: increases ----
('m1l','Make one left','knit','increase','Lifts the bar between stitches and knits it through the back. Leans left.','{"m1l","make 1 left","M1"}'),
('m1r','Make one right','knit','increase','The mirror of M1L, lifted the other way. Leans right.','{"m1r","make 1 right"}'),
('kfb','Knit front and back','knit','increase','Two stitches out of one. Quick, leaves a small bar you can see.','{"kfb","bar increase","knit into front and back"}'),
('yarn-over','Yarn over','knit','increase','Wraps the yarn to add a stitch and leave a deliberate hole. The basis of lace.','{"yo","yfwd","yon","yrn"}'),
('lifted-increase','Lifted increase','knit','increase','Knits into the stitch below. Nearly invisible, and flatter than M1.','{"raised increase","RLI","LLI"}'),
('m1p','Make one purl','knit','increase','A make-one worked purlwise, for increasing on the wrong side or in ribbing.','{"m1p"}'),

-- ---- Knitting: decreases ----
('k2tog','Knit two together','knit','decrease','The basic right-leaning decrease.','{"k2tog"}'),
('ssk','Slip slip knit','knit','decrease','The left-leaning partner to k2tog.','{"ssk","skpo","sl1 k1 psso"}'),
('p2tog','Purl two together','knit','decrease','A decrease worked on the wrong side.','{"p2tog"}'),
('ssp','Slip slip purl','knit','decrease','The purl-side mirror of ssk.','{"ssp"}'),
('cdd','Centred double decrease','knit','decrease','Takes three stitches to one with the centre stitch sitting on top. Symmetrical.','{"cdd","s2kp","central double decrease"}'),
('k3tog','Knit three together','knit','decrease','A right-leaning double decrease.','{"k3tog"}'),

-- ---- Knitting: shaping ----
('german-short-rows','German short rows','knit','shaping','Turns mid-row and pulls the stitch into a double, no wraps to pick up. The tidiest short row.','{"german short row","GSR","double stitch"}'),
('wrap-and-turn','Wrap and turn short rows','knit','shaping','The classic short row: wrap the next stitch, turn, and pick the wrap up later.','{"w&t","wrap and turn","short rows"}'),
('shadow-wraps','Shadow wrap short rows','knit','shaping','Makes a twin of the stitch to work later. Nearly invisible in stocking stitch.','{"japanese short rows","shadow wrap"}'),
('raglan-shaping','Raglan shaping','knit','shaping','Increases or decreases on four lines from the neck to the underarm.','{"raglan"}'),
('short-row-shoulders','Short-row shoulder shaping','knit','shaping','Steps the shoulder with short rows instead of binding off, for a smooth seam.','{"shaped shoulders"}'),

-- ---- Knitting: texture ----
('cables','Cables','knit','texture','Crossing stitches over each other with a cable needle to make a rope.','{"cable cross","c4f","c4b","cabling"}'),
('brioche','Brioche','knit','texture','Deeply ribbed, squashy, reversible fabric worked with slipped stitches and yarn overs.','{"brioche stitch","brk","brp"}'),
('bobbles','Bobbles','knit','texture','Several stitches made and decreased in one place to raise a lump.','{"bobble","MB","make bobble"}'),
('lace-knitting','Lace knitting','knit','texture','Paired yarn overs and decreases arranged into a pattern of holes.','{"lace"}'),
('twisted-stitches','Twisted stitches','knit','texture','Knitting through the back loop to make a crisper, tighter column.','{"ktbl","twisted rib"}'),
('seed-stitch','Seed stitch','knit','texture','Alternating knit and purl in both directions. Flat, bumpy, no curl.','{"moss stitch","gerstekorrel"}'),
('ribbing','Ribbing','knit','texture','Columns of knit and purl. Stretches sideways — cuffs, hems, necklines.','{"rib","k1p1","k2p2"}'),
('stocking-stitch','Stocking stitch','knit','texture','Knit on the right side, purl on the wrong. The plain smooth fabric, and it curls.','{"stockinette","tricotsteek"}'),
('garter-stitch','Garter stitch','knit','texture','Knit every row. Lies flat, stretches lengthways.','{"garter","ribbelsteek"}'),

-- ---- Knitting: colourwork ----
('stranded-colourwork','Stranded colourwork','knit','colourwork','Two colours a row, the unused one carried behind. Fair Isle and its relatives.','{"fair isle","stranded knitting","two colour knitting"}'),
('intarsia','Intarsia','knit','colourwork','Separate blocks of colour with their own yarn, twisted at each join. No strands behind.','{"intarsia knitting"}'),
('mosaic-knitting','Mosaic knitting','knit','colourwork','Colourwork made only with slipped stitches — one colour per row, and much easier than it looks.','{"slip stitch colourwork","mosaic"}'),
('duplicate-stitch','Duplicate stitch','knit','colourwork','Embroidering over finished stitches to add colour afterwards.','{"swiss darning","duplicate st"}'),
('jogless-stripes','Jogless stripes','knit','colourwork','A trick at the colour change that hides the step where a round begins.','{"jogless join","jogless"}'),

-- ---- Knitting: joining and finishing ----
('kitchener-stitch','Kitchener stitch','knit','joining','Grafts two sets of live stitches with a tapestry needle, invisibly. Sock toes.','{"grafting","kitchener","graft"}'),
('mattress-stitch','Mattress stitch','knit','joining','Seams two pieces from the right side, following the bars between stitches. Nearly invisible.','{"mattress seam","invisible seam"}'),
('picking-up-stitches','Picking up stitches','knit','joining','Pulling new loops through a finished edge to knit a band or sleeve from it.','{"pick up and knit","pick up stitches"}'),
('joining-in-the-round','Joining in the round','knit','joining','Closing a cast-on into a circle without twisting it.','{"join in the round","join to work in the round"}'),
('magic-loop','Magic loop','knit','joining','Working a small circumference on one long circular needle by pulling a loop of cable through.','{"magic loop","one circular"}'),
('steeking','Steeking','knit','finishing','Reinforcing and then cutting knitted fabric open. How stranded jumpers get their armholes.','{"steek"}'),
('blocking','Blocking','both','finishing','Wetting or steaming a finished piece and pinning it to shape. It is not optional for lace.','{"wet blocking","steam blocking","block"}'),
('weaving-in-ends','Weaving in ends','both','finishing','Working loose tails back into the fabric so they hold and don''t show.','{"weave in ends","darning in ends","sew in ends"}'),
('buttonholes','Buttonholes','knit','finishing','Making a hole that survives being used. Usually a bind-off and cast-on in one row.','{"buttonhole","one row buttonhole"}'),
('i-cord','I-cord','knit','finishing','A narrow tube knitted on two double-pointed needles. Ties, edgings, handles.','{"icord","idiot cord"}'),

-- ---- Crochet: foundations ----
('magic-ring','Magic ring','crochet','cast-on','An adjustable loop to start in the round that cinches shut, leaving no hole. Amigurumi starts here.','{"magic circle","magic loop crochet","adjustable ring","MR"}'),
('foundation-chain','Foundation chain','crochet','cast-on','The row of chains most crochet starts from.','{"chain","starting chain","ch","lossen"}'),
('foundation-single-crochet','Foundation single crochet','crochet','cast-on','Makes the chain and the first row at once. Stretchier than working into a chain.','{"fsc","chainless foundation"}'),
('foundation-double-crochet','Foundation double crochet','crochet','cast-on','The same trick for a first row of doubles.','{"fdc"}'),
('standing-stitch','Standing stitch','crochet','cast-on','Starting a new colour with a stitch rather than a chain, so there is no bump at the join.','{"standing single crochet","standing dc"}'),

-- ---- Crochet: shaping and stitches ----
('invisible-decrease','Invisible decrease','crochet','decrease','Works into the front loops only of two stitches. Far tidier than sc2tog on amigurumi.','{"invdec","invisible dec"}'),
('back-loop-only','Back loop only','crochet','texture','Working under the back loop alone, leaving a ridge. Makes fabric stretchier and stripier.','{"BLO","back loops only"}'),
('front-loop-only','Front loop only','crochet','texture','The other half of the same idea, with the ridge on the other face.','{"FLO","front loops only"}'),
('post-stitches','Post stitches','crochet','texture','Working around the post of the stitch below rather than into its top. Front post and back post.','{"fpdc","bpdc","front post","back post","raised stitches"}'),
('working-in-spiral','Working in a spiral','crochet','shaping','Rounds worked continuously without joining. Standard for amigurumi, and you must mark the start.','{"continuous rounds","spiral rounds"}'),
('working-in-joined-rounds','Working in joined rounds','crochet','shaping','Each round closed with a slip stitch and started with a turning chain.','{"joined rounds","closed rounds"}'),
('amigurumi-shaping','Amigurumi shaping','crochet','shaping','Even increases and decreases spaced round a spiral to make a sphere or cone.','{"amigurumi","increase round","decrease round"}'),

-- ---- Crochet: texture ----
('granny-square','Granny square','crochet','texture','Clusters of doubles separated by chain spaces, worked outward from the centre.','{"granny","granny squares"}'),
('bobble-stitch','Bobble stitch','crochet','texture','Several unfinished doubles closed together to push a bump out of the fabric.','{"bobble","popcorn"}'),
('puff-stitch','Puff stitch','crochet','texture','Loose loops drawn up and closed at once for a soft raised blob.','{"puff"}'),
('cluster-stitch','Cluster stitch','crochet','texture','Several stitches joined at the top, worked over one or more stitches.','{"cluster"}'),
('shell-stitch','Shell stitch','crochet','texture','Several stitches worked into one, fanning out. The basis of a lot of edgings.','{"shell","fan stitch"}'),
('picot','Picot','crochet','texture','A tiny chain loop closed on itself. Decorative points along an edge.','{"picot stitch"}'),
('waistcoat-stitch','Waistcoat stitch','crochet','texture','Single crochet worked between the legs of the stitch below. Looks knitted.','{"knit stitch crochet","split single crochet"}'),
('linen-stitch','Linen stitch','crochet','texture','Alternating single crochet and chain. Flat, dense, no curl.','{"moss stitch crochet","granite stitch","seed stitch crochet"}'),
('corner-to-corner','Corner to corner','crochet','texture','Worked diagonally in blocks. Easy to chart a picture onto.','{"c2c","corner-to-corner"}'),
('mosaic-crochet','Mosaic crochet','crochet','colourwork','Colourwork from one colour per row plus long stitches dropped down into rows below.','{"overlay mosaic","mosaic"}'),
('tapestry-crochet','Tapestry crochet','crochet','colourwork','Carrying the unused colour inside the stitches and swapping as you go.','{"tapestry","colourwork crochet"}'),

-- ---- Crochet: joining and finishing ----
('invisible-join','Invisible join','crochet','joining','Finishing a round with a needle so the join disappears into the stitch.','{"invisible finish","needle join"}'),
('join-as-you-go','Join as you go','crochet','joining','Attaching motifs to their neighbours on the final round instead of seaming afterwards.','{"jayg","join-as-you-go"}'),
('whip-stitch-seam','Whip stitch seam','crochet','joining','Sewing two edges together through the outer loops. Quick and flat enough for most things.','{"whip stitch","whipstitch"}'),
('slip-stitch-join','Slip stitch join','crochet','joining','Joining pieces or rounds with slip stitches. Firmer and more visible than sewing.','{"sl st join"}'),
('reverse-single-crochet','Reverse single crochet','crochet','finishing','Worked backwards along an edge for a twisted corded border.','{"crab stitch","reverse sc"}'),
('surface-crochet','Surface crochet','crochet','finishing','Slip stitching on top of finished fabric to draw lines on it.','{"surface slip stitch"}'),

-- ---- Either craft ----
('gauge-swatch','Gauge swatch','both','other','Knitting or crocheting a measured sample first. The only way to know your finished size.','{"tension square","swatch","gauge"}'),
('joining-new-yarn','Joining new yarn','both','joining','Starting a fresh ball so the join holds and doesn''t show.','{"join new yarn","attach new yarn"}'),
('russian-join','Russian join','both','joining','Threading each end back into itself so two yarns join with no knot and no tails.','{"russian join"}'),
('magic-knot','Magic knot','both','joining','A small firm knot that joins two yarns and can be trimmed close.','{"magic knot"}'),
('stitch-markers','Using stitch markers','both','other','Marking the start of a round, a repeat, or a shaping point so you don''t have to count.','{"stitch marker","place marker","pm"}'),
('reading-charts','Reading charts','both','other','Following a diagram instead of written rows — bottom-up, and the direction alternates.','{"chart reading","following a chart"}'),
('frogging','Frogging','both','other','Ripping back. Named for what it sounds like: rip it, rip it.','{"frog","rip back","tink"}')

on conflict (id) do update set
  name = excluded.name,
  craft = excluded.craft,
  family = excluded.family,
  summary = excluded.summary,
  aliases = excluded.aliases,
  updated_at = now();
