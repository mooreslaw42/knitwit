import { TOOL_TYPE_LABELS } from '@/constants/catalogs';
import { stitchGroupLabel } from '@/lib/stitch-group-label';
import type { Pattern, PatternSection, SizedNumber } from '@/types/knitwit';

// A pattern as a printable document.
//
// Pure on purpose: pattern in, HTML out, no file system and no network. Everything that makes the
// result *nice* is a decision about type and page breaks rather than about plumbing, and decisions
// like that are worth being able to test and to read.
//
// ## Why HTML rather than drawing a PDF
//
// A PDF built by hand means owning pagination — measuring text, deciding where a section splits,
// re-measuring when a translation runs 30% longer than the English. Browsers and iOS both already
// do that, well, and produce real vector text: selectable, searchable, and sharp when a knitter
// zooms in on a chart at the yarn shop. Rasterising a screenshot into a PDF would lose all of it.
//
// So the platform paginates and this decides what the pages contain. `print-pattern.ts` is the
// seam that hands this to whichever engine is available.
//
// ## What the document is for
//
// Somebody knitting from paper, at a table, with the screen away. That shapes it more than any
// style choice: instructions are set large enough to read at arm's length, rows never split across
// a page, and every section starts on a fresh page so the knitter is never turning back and forth
// mid-sleeve. The cover exists because a printed pattern gets put in a folder with others.

// Everything on the page that is not the knitter's own words.
//
// Gathered into one object so the document can be produced in another language without a second
// copy of the markup — the translator fills this in alongside the pattern's own text.
export type PatternStrings = {
  by: string;
  materials: string;
  tools: string;
  techniques: string;
  gauge: string;
  needles: string;
  sizes: string;
  level: string;
  notes: string;
  sections: string;
  row: string;
  rows: string;
  castOn: string;
  instructions: string;
  noInstructions: string;
  madeWith: string;
};

export const EN: PatternStrings = {
  by: 'A knitting pattern',
  materials: 'Yarn',
  tools: 'Needles and hooks',
  techniques: 'Techniques',
  gauge: 'Gauge',
  needles: 'Needle size',
  sizes: 'Sizes',
  level: 'Level',
  notes: 'Notes',
  sections: 'Sections',
  row: 'Row',
  rows: 'rows',
  castOn: 'Cast on',
  instructions: 'Instructions',
  noInstructions: 'No instructions written for this section yet.',
  madeWith: 'Made with Knitwit',
};

// Untrusted by default. Every string here is either the knitter's own typing or a model's output,
// and both end up inside a document that gets shared — so nothing reaches the markup unescaped.
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Free text the knitter typed, where the line breaks they made are part of what they meant.
function paragraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${esc(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

// Patterns state counts per size — "cast on 96 (104) 112". One number stays one number.
function sized(value: SizedNumber): string {
  return Array.isArray(value) ? value.join(' · ') : String(value);
}

function firstSize(value: SizedNumber): number | null {
  const n = Array.isArray(value) ? value[0] : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

// What a row says, preferring the knitter's own words.
//
// `instruction` is what they wrote; the stitch groups are the structured version the counter reads.
// Where both exist the written line is the one that belongs in a printed pattern — it is how
// knitters write to each other. The groups are the fallback for rows that were only ever charted.
function rowText(row: Pattern['sections'][number]['rows'][number]): string {
  if (row.instruction.trim()) return row.instruction.trim();
  return row.stitches
    .map((group) =>
      stitchGroupLabel({
        type: group.type,
        span: group.span,
        count: firstSize(group.count ?? 0),
      }),
    )
    .filter(Boolean)
    .join(', ');
}

function sectionHtml(section: PatternSection, s: PatternStrings): string {
  const total = sized(section.totalRows);
  const castOn = sized(section.castOn);
  const meta = [
    total && total !== '0' ? `${total} ${esc(s.rows)}` : '',
    castOn && castOn !== '0' ? `${esc(s.castOn)} ${castOn}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const written = section.description.trim() ? paragraphs(section.description) : '';
  const rows = section.rows.filter((row) => rowText(row));

  const rowList = rows.length
    ? `<table class="rows">${rows
        .map(
          (row) =>
            `<tr><th scope="row">${esc(row.label || s.row)}</th><td>${esc(rowText(row))}</td></tr>`,
        )
        .join('')}</table>`
    : '';

  const notes = section.notes.trim()
    ? `<div class="note"><h3>${esc(s.notes)}</h3>${paragraphs(section.notes)}</div>`
    : '';

  const body = written || rowList ? `${written}${rowList}` : `<p class="empty">${esc(s.noInstructions)}</p>`;

  return `<section class="part">
  <h2>${esc(section.name)}</h2>
  ${meta ? `<p class="meta">${meta}</p>` : ''}
  ${body}
  ${notes}
</section>`;
}

function listHtml(title: string, items: string[]): string {
  if (items.length === 0) return '';
  return `<div class="kit"><h3>${esc(title)}</h3><ul>${items
    .map((item) => `<li>${esc(item)}</li>`)
    .join('')}</ul></div>`;
}

export type PatternDocument = {
  pattern: Pattern;
  // The cover image, already resolved to a data URL — this function does no I/O. Null prints a
  // cover in the pattern's own accent colour instead, which is still a cover.
  photo: string | null;
  strings?: PatternStrings;
};

export function patternHtml({ pattern, photo, strings = EN }: PatternDocument): string {
  const s = strings;
  const accent = /^#[0-9a-f]{3,8}$/i.test(pattern.accentColor) ? pattern.accentColor : '#E58AA0';

  const facts = [
    pattern.sizes.length ? [s.sizes, pattern.sizes.join(' · ')] : null,
    pattern.needleSize ? [s.needles, pattern.needleSize] : null,
    pattern.level ? [s.level, pattern.level] : null,
    pattern.gauge
      ? [
          s.gauge,
          `${pattern.gauge.stitches} st × ${pattern.gauge.rows} r / ${pattern.gauge.width}×${pattern.gauge.height}${pattern.gauge.unit === 'cm' ? 'cm' : '"'}`,
        ]
      : null,
  ].filter(Boolean) as [string, string][];

  // A slot's own words where it has them, and what it is where it does not — a needle slot carries
  // a type and a thickness rather than a name, and "4.5mm circular" is what a knitter would write.
  const materialNames = pattern.materials
    .map((m) => [m.label, m.short && m.label !== m.short ? `(${m.short})` : ''].filter(Boolean).join(' '))
    .filter(Boolean);
  const toolNames = pattern.tools
    .map((t) => [t.thickness, TOOL_TYPE_LABELS[t.type] ?? t.type, t.note].filter(Boolean).join(' '))
    .filter((line) => line.trim());
  const techniqueNames = pattern.techniques
    .map((t) => [t.name, t.note].filter(Boolean).join(' — '))
    .filter(Boolean);

  const cover = `<header class="cover">
  ${
    photo
      ? `<div class="shot"><img src="${esc(photo)}" alt=""></div>`
      : `<div class="shot blank" style="background:${esc(accent)}"></div>`
  }
  <h1>${esc(pattern.name)}</h1>
  <p class="tagline">${esc(s.by)}</p>
  ${
    facts.length
      ? `<dl class="facts">${facts
          .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`)
          .join('')}</dl>`
      : ''
  }
</header>`;

  const kit = [
    listHtml(s.materials, materialNames),
    listHtml(s.tools, toolNames),
    listHtml(s.techniques, techniqueNames),
  ]
    .filter(Boolean)
    .join('');

  const intro =
    kit || pattern.notes.trim()
      ? `<section class="part intro">
  ${kit ? `<div class="kits">${kit}</div>` : ''}
  ${pattern.notes.trim() ? `<div class="note"><h3>${esc(s.notes)}</h3>${paragraphs(pattern.notes)}</div>` : ''}
</section>`
      : '';

  const body = pattern.sections.map((section) => sectionHtml(section, s)).join('');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(pattern.name)}</title>
<style>${css(accent)}</style>
</head>
<body>
${cover}
${intro}
${body}
<footer class="made">${esc(s.madeWith)}</footer>
</body>
</html>`;
}

// Print CSS, which is nearly all of what makes this pleasant to hold.
//
// Sizes are in points and millimetres rather than pixels: this is going onto paper, where a pixel
// means nothing. System fonts only — a downloaded face would have to be fetched at print time, and
// a pattern that prints differently depending on the network is worse than one in Georgia.
function css(accent: string): string {
  return `
@page { size: A4; margin: 18mm 16mm; }

* { box-sizing: border-box; }
body {
  margin: 0;
  color: #3A2E2C;
  background: #fff;
  font: 11.5pt/1.55 Georgia, 'Iowan Old Style', 'Times New Roman', serif;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

h1, h2, h3, .meta, .tagline, dt, .made {
  font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
}

/* The cover. It gets the whole first sheet — a printed pattern ends up in a folder with others,
   and the point of a cover is to be found by flicking through the edges. */
.cover { page-break-after: always; text-align: center; }
.shot {
  width: 100%;
  height: 150mm;
  overflow: hidden;
  border-radius: 4mm;
  background: #F7EBDD;
  display: flex;
  align-items: center;
  justify-content: center;
}
.shot img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cover h1 {
  font-size: 30pt;
  line-height: 1.15;
  margin: 12mm 0 2mm;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.tagline { margin: 0; color: #8A7873; font-size: 10pt; letter-spacing: 0.08em; text-transform: uppercase; }

.facts {
  margin: 10mm auto 0;
  display: grid;
  grid-template-columns: auto auto;
  gap: 1.5mm 6mm;
  justify-content: center;
  text-align: left;
  font-size: 10pt;
}
.facts dt { color: #8A7873; text-align: right; }
.facts dd { margin: 0; font-weight: 600; }

/* Every section starts on its own sheet. A knitter working a sleeve should never be turning a page
   back and forth to see the end of the row they are on. */
.part { page-break-before: always; }
.part.intro { page-break-before: avoid; }

h2 {
  font-size: 17pt;
  margin: 0 0 1mm;
  padding-bottom: 2mm;
  border-bottom: 2pt solid ${accent};
}
.meta { margin: 0 0 6mm; color: #8A7873; font-size: 9.5pt; letter-spacing: 0.04em; text-transform: uppercase; }
p { margin: 0 0 4mm; }
.empty { color: #8A7873; font-style: italic; }

/* Rows are a table so the numbers line up down the left edge, which is how the eye finds its place
   again after looking at the knitting. */
.rows { width: 100%; border-collapse: collapse; margin: 4mm 0; }
.rows tr { page-break-inside: avoid; }
.rows th {
  text-align: left;
  vertical-align: top;
  white-space: nowrap;
  width: 22mm;
  padding: 1.8mm 4mm 1.8mm 0;
  font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
  font-size: 10pt;
  color: ${accent};
  font-weight: 700;
  border-top: 0.5pt solid #EFE6DC;
}
.rows td { padding: 1.8mm 0; border-top: 0.5pt solid #EFE6DC; }

.kits { display: flex; flex-wrap: wrap; gap: 8mm; margin-bottom: 6mm; }
.kit { min-width: 55mm; flex: 1; }
h3 { font-size: 10pt; text-transform: uppercase; letter-spacing: 0.08em; color: #8A7873; margin: 0 0 2mm; }
.kit ul { margin: 0; padding-left: 5mm; }
.kit li { margin-bottom: 1mm; }

.note {
  margin-top: 6mm;
  padding: 4mm 5mm;
  background: #FDF6EF;
  border-left: 2pt solid ${accent};
  page-break-inside: avoid;
}
.note p:last-child { margin-bottom: 0; }

.made { margin-top: 10mm; text-align: center; color: #A89B96; font-size: 8.5pt; letter-spacing: 0.06em; }
`;
}
