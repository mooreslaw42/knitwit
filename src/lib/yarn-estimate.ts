import type { PatternCategory, TechniqueCraft } from '@/types/knitwit';

// How much yarn a make will take.
//
// The question a knitter asks before the money is spent, and the one Knitwit is best placed to
// answer because it is the only tool of its kind that knows what is already in the cupboard.
//
// Two ways to ask it, and they are not equally good. `estimateFromSwatch` weighs real fabric and is
// as close to arithmetic as this gets; `estimateFromType` reads a table of averages and is a
// starting point. Both say so where they are shown. Nothing here is a substitute for buying a
// spare ball of the same dye lot.

const CM_PER_INCH = 2.54;

// ---- From a swatch: the honest one ----

// Grams per square centimetre, from fabric the knitter actually made. This is the whole method —
// everything else is multiplying it by an area.
//
// It needs kitchen scales, which is the only reason this isn't the only mode offered. In exchange
// it knows the yarn, the stitch pattern and how tightly this particular knitter holds the yarn,
// none of which a table of averages can.
export type SwatchInput = {
  width: number;
  height: number;
  grams: number;
  // What is being made, as a flat area. Two 25×60cm sleeves is `pieces: 2`.
  pieceWidth: number;
  pieceHeight: number;
  pieces?: number;
  // Per cent. A make that runs out two rows from the end is a make ruined.
  margin?: number;
  // Optional, and only used to turn grams into metres for the shopping list.
  metresPerBall?: number;
  gramsPerBall?: number;
};

export type SwatchEstimate = {
  gramsPerSquareCm: number;
  area: number;
  grams: number;
  metres: number | null;
};

export function estimateFromSwatch(input: SwatchInput): SwatchEstimate | null {
  const { width, height, grams, pieceWidth, pieceHeight } = input;
  if (width <= 0 || height <= 0 || grams <= 0 || pieceWidth <= 0 || pieceHeight <= 0) return null;

  const gramsPerSquareCm = grams / (width * height);
  const pieces = Math.max(1, Math.round(input.pieces ?? 1));
  const area = pieceWidth * pieceHeight * pieces;
  const needed = gramsPerSquareCm * area * (1 + clampMargin(input.margin) / 100);

  // Metres only when the band says how many it has. Deriving them from grams is exact — it is the
  // same ball — so this is the one place where a conversion adds no guesswork at all.
  const { metresPerBall, gramsPerBall } = input;
  const metres =
    metresPerBall && gramsPerBall && gramsPerBall > 0
      ? (needed / gramsPerBall) * metresPerBall
      : null;

  return {
    gramsPerSquareCm,
    area,
    grams: ceilExact(needed),
    metres: metres === null ? null : roundUpTo(metres, 10),
  };
}

// ---- From a project type: the rough one ----

// A base metreage per kind of make, in the weight the table is calibrated for (DK/light, factor 1),
// at an average adult size.
//
// Seeded from the figures behind hennetie.nl's wolcalculator, keyed to Knitwit's own categories
// rather than its Dutch list. Where a category has no counterpart there — dresses, slippers,
// dishcloths, swatches — the number is extrapolated from its neighbours and is a guess wearing a
// number's clothes. Every one of them is an average over fit, ease, length and stitch pattern, any
// of which moves it further than the corrections below ever will.
//
// `null` means Knitwit will not pretend: "other" and "queue" describe no particular object, so
// there is no sensible metreage to give and the calculator says so instead of inventing one.
export const CATEGORY_METRES: Record<PatternCategory, number | null> = {
  sweaters: 1450,
  cardigans: 1600,
  tops: 1050,
  dresses: 1900,
  accessories: 300,
  hats: 220,
  scarves: 650,
  shawls: 850,
  mittens: 300,
  socks: 380,
  slippers: 250,
  bags: 650,
  blankets: 2200,
  cushions: 700,
  dishcloths: 90,
  home: 700,
  toys: 300,
  baby: 520,
  swatches: 30,
  other: null,
  queue: null,
};

// Which makes are graded. A hat is a hat; a cardigan in a 4XL eats half as much again as an XS, and
// applying a size factor to a blanket would be answering a question nobody asked.
export const SIZED_CATEGORIES: PatternCategory[] = [
  'sweaters',
  'cardigans',
  'tops',
  'dresses',
  'baby',
];

// Keyed to SIZE_OPTIONS. XS–XXL are the measured ones; the baby sizes and the top of the run are
// extrapolated, monotonic, and no better than the base metreage they multiply.
export const SIZE_FACTORS: Record<string, number> = {
  'One size': 1,
  Newborn: 0.35,
  Baby: 0.5,
  XS: 0.82,
  S: 0.92,
  M: 1,
  L: 1.12,
  XL: 1.25,
  '2XL': 1.4,
  '3XL': 1.55,
  '4XL': 1.7,
};

// What each yarn weight does to the metreage, and the needle and gauge it is normally worked at.
//
// A finer yarn takes *more* metres for the same garment, which is why the factors run downwards as
// the yarn gets thicker. The needle and gauge ranges are the standard ones for each weight class,
// and they are only used as the midpoint a knitter's own numbers are compared against.
export type WeightProfile = {
  factor: number;
  needle: [number, number];
  // Stitches per 10cm.
  gauge: [number, number];
};

export const WEIGHT_PROFILES: Record<string, WeightProfile> = {
  '0': { factor: 1.25, needle: [2, 3], gauge: [33, 40] },
  '1': { factor: 1.15, needle: [2.25, 3.25], gauge: [27, 32] },
  '2': { factor: 1.08, needle: [3, 3.75], gauge: [23, 26] },
  '3': { factor: 1.0, needle: [3.75, 4.5], gauge: [21, 24] },
  '4': { factor: 0.92, needle: [4.5, 5.5], gauge: [16, 20] },
  '5': { factor: 0.72, needle: [5.5, 8], gauge: [12, 15] },
  '6': { factor: 0.58, needle: [8, 12], gauge: [7, 11] },
  '7': { factor: 0.48, needle: [12, 25], gauge: [4, 6] },
};

export type TypeInput = {
  category: PatternCategory;
  size: string;
  craft: TechniqueCraft;
  weight: string;
  // Millimetres. Optional — without it the weight's own midpoint is assumed.
  needle?: number;
  // Stitches and rows per 10cm, from a swatch if there is one.
  stitches?: number;
  rows?: number;
  margin?: number;
};

export type TypeEstimate = {
  metres: number;
  // Every multiplier that was applied, so the screen can show its working rather than produce a
  // number from nowhere.
  base: number;
  sizeFactor: number;
  weightFactor: number;
  craftFactor: number;
  needleFactor: number;
  gaugeFactor: number;
  margin: number;
};

export function estimateFromType(input: TypeInput): TypeEstimate | null {
  const base = CATEGORY_METRES[input.category];
  const profile = WEIGHT_PROFILES[String(input.weight)];
  if (base === null || base === undefined || !profile) return null;

  const sized = SIZED_CATEGORIES.includes(input.category);
  const sizeFactor = sized ? (SIZE_FACTORS[input.size] ?? 1) : 1;
  const weightFactor = profile.factor;
  // Crochet eats about a quarter more than knitting for the same fabric — the loops are taller and
  // the yarn takes a longer path through each one.
  const craftFactor = input.craft === 'crochet' ? 1.25 : 1;

  // Each correction is clamped, and deliberately. These are small adjustments to an average, and a
  // knitter who types an unusual needle or a gauge from a different stitch pattern should not be
  // able to drag the answer somewhere it cannot defend.
  const midNeedle = (profile.needle[0] + profile.needle[1]) / 2;
  const needle = input.needle && input.needle > 0 ? input.needle : midNeedle;
  const needleFactor = clamp(1 + (midNeedle - needle) * 0.04, 0.88, 1.14);

  const midGauge = (profile.gauge[0] + profile.gauge[1]) / 2;
  const stitches = input.stitches && input.stitches > 0 ? input.stitches : 0;
  const gaugeFactor = stitches > 0 ? clamp(stitches / midGauge, 0.82, 1.22) : 1;

  // Row gauge barely moves the total, and is allowed to move it barely: a fabric that is unusually
  // tall for its width uses a little more yarn per stitch.
  const rows = input.rows && input.rows > 0 ? input.rows : 0;
  const rowFactor =
    rows > 0 ? clamp(rows / ((stitches > 0 ? stitches : midGauge) * 1.35), 0.94, 1.06) : 1;

  const margin = clampMargin(input.margin);
  const metres =
    base *
    sizeFactor *
    weightFactor *
    craftFactor *
    needleFactor *
    gaugeFactor *
    rowFactor *
    (1 + margin / 100);

  return {
    metres: roundUpTo(metres, 10),
    base,
    sizeFactor,
    weightFactor,
    craftFactor,
    needleFactor,
    gaugeFactor: gaugeFactor * rowFactor,
    margin,
  };
}

// ---- Balls, money, and what is already in the cupboard ----

// The part no other calculator can do: what this comes to in whole balls, and how many of them the
// knitter does not already own.
//
// Balls always round up. Half a ball short is the same as a ball short.
export type BallsInput = {
  metres: number;
  metresPerBall: number;
  gramsPerBall?: number;
  pricePerBall?: number;
  owned?: number;
};

export type BallsEstimate = {
  balls: number;
  grams: number | null;
  cost: number | null;
  owned: number;
  toBuy: number;
  toBuyCost: number | null;
};

export function ballsFor(input: BallsInput): BallsEstimate | null {
  const { metres, metresPerBall } = input;
  if (metres <= 0 || metresPerBall <= 0) return null;

  const balls = Math.ceil(metres / metresPerBall);
  // Floored, because a part-used ball is not a ball you can count on having enough of.
  const owned = Math.max(0, Math.floor(input.owned ?? 0));
  const price = input.pricePerBall && input.pricePerBall > 0 ? input.pricePerBall : null;
  const toBuy = Math.max(0, balls - owned);

  return {
    balls,
    grams: input.gramsPerBall && input.gramsPerBall > 0 ? balls * input.gramsPerBall : null,
    cost: price === null ? null : balls * price,
    owned,
    toBuy,
    toBuyCost: price === null ? null : toBuy * price,
  };
}

// ---- Shared ----

export function inchesToCm(inches: number): number {
  return inches * CM_PER_INCH;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// A reserve of more than a third says the estimate is not trusted at all, in which case the answer
// is a better estimate rather than a bigger multiplier.
function clampMargin(margin: number | undefined): number {
  if (!Number.isFinite(margin ?? NaN)) return 0;
  return clamp(margin as number, 0, 30);
}

// Yarn is not sold by the metre, and quoting "1,437m" implies a precision the table underneath
// cannot support.
function roundUpTo(value: number, step: number): number {
  return ceilExact(value / step) * step;
}

// Ceiling, after the floating-point dust is swept up.
//
// A swatch of 0.05 g/cm² over 8,000cm² with a tenth added comes to 440.0000000000001 in binary
// floating point, and a plain Math.ceil turns that into 441 — a whole extra gram, and on the metres
// a whole extra ten, conjured out of a rounding error. Twelve places is far beyond any precision
// these numbers claim and well inside what a double can represent exactly.
function ceilExact(value: number): number {
  return Math.ceil(Number(value.toPrecision(12)));
}
