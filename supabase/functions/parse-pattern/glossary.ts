// Craft vocabulary, per language.
//
// A general-purpose model translates fluent prose well and craft notation badly. Asked for Dutch it
// returned "Garn" for yarn — German, or Swedish, but not Dutch, where it is *garen* — and wrote
// "2 m, 2 h" where a Dutch pattern says "2 r, 2 av". Both are the same mistake: knitting has its own
// register in every language, it is not derivable from the ordinary word, and a model that has read
// little of it guesses from the neighbours.
//
// A glossary fixes exactly that and nothing else. It is cheaper than a larger model and more
// targeted: the failure is vocabulary, not fluency.
//
// One term per entry, never a choice of two. Offering alternatives got them copied through verbatim
// — "Wolle/Garn" arrived as a heading in the document.
//
// ## Why some languages are missing
//
// Only languages whose knitting terms are actually known are listed. A wrong glossary is worse than
// none — it overrides the model's own judgement with a confident error, and a knitter reading it has
// no way to tell. For anything not here the model is asked for standard published notation and left
// to it, which is where it was already.

const GLOSSARIES: Record<string, string> = {
  Dutch: `yarn=garen; needles=breinaalden; crochet hook=haaknaald; gauge=stekenverhouding;
cast on=opzetten; bind off=afkanten; knit=recht (r); purl=averecht (av);
stitch=steek (st); row=naald; round=toer; increase=meerderen; decrease=minderen;
repeat=herhaal; right side=goede kant; wrong side=verkeerde kant; yarn over=omslag (oms);
k2tog=2 steken samen recht breien; ssk=overhalen; size=maat; notes=notities`,

  German: `yarn=Wolle; needles=Nadeln; crochet hook=Häkelnadel; gauge=Maschenprobe;
cast on=anschlagen; bind off=abketten; knit=rechts (re); purl=links (li);
stitch=Masche (M); row=Reihe (R); round=Runde (Rd); increase=zunehmen; decrease=abnehmen;
repeat=wiederholen; right side=Hinreihe; wrong side=Rückreihe; yarn over=Umschlag (U);
k2tog=2 M rechts zusammenstricken; size=Größe; notes=Notizen`,

  French: `yarn=laine; needles=aiguilles; crochet hook=crochet; gauge=échantillon;
cast on=monter les mailles; bind off=rabattre; knit=maille endroit (end);
purl=maille envers (env); stitch=maille (m); row=rang; round=tour; increase=augmenter;
decrease=diminuer; repeat=répéter; right side=endroit; wrong side=envers; yarn over=jeté;
size=taille; notes=notes`,

  Spanish: `yarn=lana; needles=agujas; crochet hook=ganchillo; gauge=muestra;
cast on=montar; bind off=cerrar; knit=punto derecho (d); purl=punto del revés (r);
stitch=punto (p); row=hilera; round=vuelta; increase=aumentar; decrease=disminuir;
repeat=repetir; right side=derecho; wrong side=revés; yarn over=lazada; size=talla; notes=notas`,

  Italian: `yarn=filato; needles=ferri; crochet hook=uncinetto; gauge=campione;
cast on=avviare; bind off=chiudere; knit=diritto (dir); purl=rovescio (rov);
stitch=maglia (m); row=ferro; round=giro; increase=aumentare; decrease=diminuire;
repeat=ripetere; right side=diritto; wrong side=rovescio; yarn over=gettato; size=taglia;
notes=note`,

  Swedish: `yarn=garn; needles=stickor; crochet hook=virknål; gauge=stickfasthet;
cast on=lägg upp; bind off=maska av; knit=rät (r); purl=avig (a); stitch=maska (m);
row=varv; round=varv; increase=öka; decrease=minska; repeat=upprepa; right side=rätsidan;
wrong side=avigsidan; yarn over=omslag; size=storlek; notes=anteckningar`,

  Danish: `yarn=garn; needles=pinde; crochet hook=hæklenål; gauge=strikkefasthed;
cast on=slå op; bind off=luk af; knit=ret (r); purl=vrang (vr); stitch=maske (m);
row=pind; round=omgang; increase=tag ud; decrease=tag ind; repeat=gentag; right side=retsiden;
wrong side=vrangsiden; yarn over=omslag; size=størrelse; notes=noter`,

  Norwegian: `yarn=garn; needles=pinner; crochet hook=heklenål; gauge=strikkefasthet;
cast on=legg opp; bind off=fell av; knit=rett (r); purl=vrang (vr); stitch=maske (m);
row=pinne; round=omgang; increase=øk; decrease=fell; repeat=gjenta; right side=retsiden;
wrong side=vrangsiden; yarn over=kast; size=størrelse; notes=notater`,
};

// The glossary for one language, as a prompt fragment, or '' where there is none.
export function glossaryFor(language: string): string {
  const terms = GLOSSARIES[language.trim()];
  if (!terms) return '';
  return `\n\nPublished ${language} craft vocabulary. It overrides your own preference, and where a
term offers no alternative you use that term and not a synonym.

The bracketed abbreviations are not optional. A row instruction written in English abbreviations is
not translated until they are gone: "Row 1: k2, p2 to end" must come back with the row word, both
stitch abbreviations and the word for "end" all in ${language} — never "k2" or "p2".

Write the count before the stitch, the way every published pattern does: "2 r", not "r 2"; "2 M
rechts", not "rechts 2". Use the short abbreviation in row instructions and save the full word for
the legend and for prose.

${terms}`;
}

// Tests only.
export const GLOSSARY_LANGUAGES = Object.keys(GLOSSARIES);
