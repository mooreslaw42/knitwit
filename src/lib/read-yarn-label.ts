import { invokeEdgeFunction } from '@/lib/edge-function';
import type { Gauge, Material } from '@/types/knitwit';

// Reading a yarn's ball band from a photograph.
//
// Almost everything Knitwit keeps about a yarn is printed on the band, so a picture of it is a
// faster and more accurate way in than fourteen fields typed by hand. The model only ever reports
// what it can see; whatever it returns is a draft the knitter edits, never a saved fact.
//
// Price, link and strands are deliberately absent: they are not on a band. They keep whatever the
// form already had.

// Generous. A photo goes up as well as the answer coming back, and a knitter on a phone in a yarn
// shop is not on good wifi.
const LABEL_TIMEOUT_MS = 60_000;

type LabelResponse = {
  material?: Record<string, unknown>;
};

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

// Digits only, whatever the model sent. The schema asks for a bare number and the prompt says so
// twice, but a stray "mm" reaching a numeric form field is worse than a blank one.
const digits = (value: unknown): string => {
  const match = str(value).match(/\d+(?:[.,]\d+)?/);
  return match ? match[0].replace(',', '.') : '';
};

const num = (value: unknown): number => Number(digits(value)) || 0;

// A gauge is only worth keeping if it actually says something. A band that prints no tension
// square should leave the field alone rather than filling it with zeroes.
function gaugeFrom(read: Record<string, unknown>): Gauge | null {
  const stitches = num(read.gaugeStitches);
  const rows = num(read.gaugeRows);
  if (!stitches && !rows) return null;
  const size = num(read.gaugeSize) || 10;
  return { stitches, rows, width: size, height: size, unit: 'cm' };
}

export type YarnLabelReading = {
  // Only the fields the band actually gave up. Spread over the form so anything the knitter has
  // already typed for a field the band is silent about survives.
  values: Partial<Material>;
  // The model's own view of whether the photo was readable. False is a prompt to retake it, not a
  // reason to discard what it managed to read.
  confident: boolean;
  // Which fields came back filled, so the screen can say what it found rather than claiming more.
  filled: (keyof Material)[];
};

export async function readYarnLabel(
  photo: string,
  options: { signal?: AbortSignal } = {},
): Promise<YarnLabelReading> {
  const data = (await invokeEdgeFunction(
    'parse-pattern',
    { task: 'material', image: photo },
    {
      timeoutMs: LABEL_TIMEOUT_MS,
      signal: options.signal,
      timeoutMessage: "That took too long. Try again, or type the yarn in — it's quicker than it looks.",
    },
  )) as LabelResponse;

  const read = data?.material ?? {};
  const values: Partial<Material> = {};

  for (const [key, value] of [
    ['brand', str(read.brand)],
    ['colorName', str(read.colorName)],
    ['colorLot', str(read.colorLot)],
    ['composition', str(read.composition)],
    ['weight', str(read.weight)],
    ['washing', str(read.washing)],
    ['grams', digits(read.grams)],
    ['meters', digits(read.meters)],
    ['thickness', digits(read.thickness)],
  ] as const) {
    if (value) values[key] = value;
  }

  const gauge = gaugeFrom(read);
  if (gauge) values.gauge = gauge;

  return {
    values,
    confident: read.confident === true,
    filled: Object.keys(values) as (keyof Material)[],
  };
}

// ---------------------------------------------------------------------------
// Looking up what the band did not say.
//
// Only ever fills blanks. The band is evidence and a search result is hearsay: a page about "DROPS
// Baby Merino" describes a Baby Merino, not necessarily the skein in the knitter's hand, so it may
// add to what was photographed but never argue with it.
//
// Price and dye lot are not on the list and cannot be. A dye lot belongs to one physical batch and
// a price to one shop on one day; the server refuses to return either.

// Everything a search is allowed to fill, in the order the form asks for it.
const ENRICHABLE = [
  'weight',
  'grams',
  'meters',
  'composition',
  'thickness',
  'washing',
  'link',
] as const;

// Which of those a given form is still missing. Gauge is one field to the knitter and three to the
// model, so it is asked for as its parts and reassembled on the way back.
export function missingFields(form: Pick<Material, (typeof ENRICHABLE)[number] | 'gauge'>): string[] {
  const missing = ENRICHABLE.filter((key) => !String(form[key] ?? '').trim());
  const gauge = form.gauge;
  const needsGauge = !gauge || (!gauge.stitches && !gauge.rows);
  return needsGauge
    ? [...missing, 'gaugeStitches', 'gaugeRows', 'gaugeSize']
    : [...missing];
}

// How many blanks a knitter would recognise, for the button's label. The three gauge keys are one
// missing thing, not three.
export function missingCount(fields: string[]): number {
  return fields.filter((f) => !f.startsWith('gauge')).length + (fields.some((f) => f.startsWith('gauge')) ? 1 : 0);
}

export type YarnLookup = {
  values: Partial<Material>;
  // False when nothing matched — an unknown yarn, or a name too vague to identify one. The server
  // makes the model name what it matched and checks it, so this is a verdict rather than a hope.
  found: boolean;
  // The yarn the sources actually described, to show alongside what was filled in.
  matchedName: string;
  filled: (keyof Material)[];
};

export async function lookUpYarn(
  brand: string,
  colorName: string,
  missing: string[],
  options: { signal?: AbortSignal } = {},
): Promise<YarnLookup> {
  const data = (await invokeEdgeFunction(
    'parse-pattern',
    { task: 'enrich', brand, colorName, missing },
    {
      timeoutMs: LABEL_TIMEOUT_MS,
      signal: options.signal,
      timeoutMessage: 'Looking that yarn up took too long. Try again, or fill the rest in yourself.',
    },
  )) as { material?: Record<string, unknown>; found?: unknown; matchedName?: unknown };

  const read = data?.material ?? {};
  const values: Partial<Material> = {};

  for (const [key, value] of [
    ['composition', str(read.composition)],
    ['weight', str(read.weight)],
    ['washing', str(read.washing)],
    ['link', str(read.link)],
    ['grams', digits(read.grams)],
    ['meters', digits(read.meters)],
    ['thickness', digits(read.thickness)],
  ] as const) {
    if (value) values[key] = value;
  }

  const gauge = gaugeFrom(read);
  if (gauge) values.gauge = gauge;

  return {
    values,
    found: data?.found === true,
    matchedName: str(data?.matchedName),
    filled: Object.keys(values) as (keyof Material)[],
  };
}
