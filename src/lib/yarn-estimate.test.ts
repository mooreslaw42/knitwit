import { CATEGORY_ORDER, SIZE_OPTIONS, YARN_WEIGHTS } from '@/constants/catalogs';
import {
  ballsFor,
  CATEGORY_METRES,
  estimateFromSwatch,
  estimateFromType,
  SIZE_FACTORS,
  SIZED_CATEGORIES,
  WEIGHT_PROFILES,
} from '@/lib/yarn-estimate';

describe('the tables', () => {
  // These are keyed to catalogs that only ever gain entries. A category added without a metreage
  // would reach estimateFromType as `undefined` and quietly return null forever.
  it('has a metreage, or an explicit refusal, for every category', () => {
    CATEGORY_ORDER.forEach((category) => {
      expect(CATEGORY_METRES).toHaveProperty(category);
    });
  });

  it('has a factor for every size the app offers', () => {
    SIZE_OPTIONS.forEach((size) => expect(SIZE_FACTORS[size]).toBeGreaterThan(0));
  });

  it('has a profile for every yarn weight', () => {
    YARN_WEIGHTS.forEach((w) => expect(WEIGHT_PROFILES[w.code]).toBeTruthy());
  });

  // Finer yarn takes more metres for the same garment, so the factors must fall as the yarn gets
  // thicker. A table that broke this would still produce numbers, just nonsensical ones.
  it('falls monotonically from lace to jumbo', () => {
    const factors = YARN_WEIGHTS.map((w) => WEIGHT_PROFILES[w.code].factor);
    factors.forEach((f, i) => {
      if (i > 0) expect(f).toBeLessThan(factors[i - 1]);
    });
  });

  it('grows monotonically from newborn to 4XL', () => {
    const run = ['Newborn', 'Baby', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
    run.forEach((size, i) => {
      if (i > 0) expect(SIZE_FACTORS[size]).toBeGreaterThan(SIZE_FACTORS[run[i - 1]]);
    });
  });

  it('only grades what is actually graded', () => {
    SIZED_CATEGORIES.forEach((c) => expect(CATEGORY_ORDER).toContain(c));
    expect(SIZED_CATEGORIES).not.toContain('blankets');
    expect(SIZED_CATEGORIES).not.toContain('hats');
  });
});

describe('estimateFromType', () => {
  const base = { category: 'sweaters' as const, size: 'M', craft: 'knit' as const, weight: '3' };

  it('is the table figure at the calibration point', () => {
    // DK, size M, knitting, no needle or gauge given, no reserve: every factor is 1.
    expect(estimateFromType(base)?.metres).toBe(1450);
  });

  it('refuses a category that describes no particular object', () => {
    expect(estimateFromType({ ...base, category: 'other' })).toBeNull();
    expect(estimateFromType({ ...base, category: 'queue' })).toBeNull();
  });

  it('refuses a yarn weight it has no profile for', () => {
    expect(estimateFromType({ ...base, weight: '99' })).toBeNull();
  });

  it('grades a sweater and leaves a blanket alone', () => {
    const xs = estimateFromType({ ...base, size: 'XS' })?.metres ?? 0;
    const xxl = estimateFromType({ ...base, size: '2XL' })?.metres ?? 0;
    expect(xs).toBeLessThan(1450);
    expect(xxl).toBeGreaterThan(1450);

    const blanket = { ...base, category: 'blankets' as const };
    expect(estimateFromType({ ...blanket, size: 'XS' })?.metres).toBe(
      estimateFromType({ ...blanket, size: '4XL' })?.metres,
    );
  });

  it('asks for a quarter more to crochet it', () => {
    const knit = estimateFromType(base)?.metres ?? 0;
    const crochet = estimateFromType({ ...base, craft: 'crochet' })?.metres ?? 0;
    expect(crochet / knit).toBeCloseTo(1.25, 1);
  });

  it('adds the reserve, and will not add more than 30%', () => {
    expect(estimateFromType({ ...base, margin: 10 })?.metres).toBe(1600);
    expect(estimateFromType({ ...base, margin: 500 })?.margin).toBe(30);
    expect(estimateFromType({ ...base, margin: -20 })?.margin).toBe(0);
  });

  // The corrections are adjustments to an average, not a second opinion about it. A knitter who
  // types a gauge from a different stitch pattern must not be able to drag the answer anywhere it
  // can't defend.
  it('clamps the needle and gauge corrections', () => {
    // Jumbo sits at a 18.5mm midpoint, so a 1mm needle is far enough off to hit the ceiling; lace
    // sits at 2.5mm, so a 10mm one hits the floor. Within a weight's own range the correction is
    // small, which is the point of it.
    expect(estimateFromType({ ...base, weight: '7', needle: 1 })?.needleFactor).toBeCloseTo(1.14, 5);
    expect(estimateFromType({ ...base, weight: '0', needle: 10 })?.needleFactor).toBeCloseTo(
      0.88,
      5,
    );

    expect(estimateFromType({ ...base, stitches: 60 })?.gaugeFactor).toBeCloseTo(1.22, 5);
    expect(estimateFromType({ ...base, stitches: 4 })?.gaugeFactor).toBeCloseTo(0.82, 5);
  });

  // Inside the weight's own needle range the correction stays small, so a knitter going up half a
  // size does not see the estimate lurch.
  it('nudges rather than lurches within a weight’s own needle range', () => {
    const atMid = estimateFromType({ ...base, needle: 4.125 })?.needleFactor ?? 0;
    const halfUp = estimateFromType({ ...base, needle: 4.5 })?.needleFactor ?? 0;
    expect(atMid).toBeCloseTo(1, 10);
    expect(Math.abs(halfUp - 1)).toBeLessThan(0.02);
  });

  it('wants more yarn for a finer fabric than the weight suggests', () => {
    const loose = estimateFromType({ ...base, stitches: 20 })?.metres ?? 0;
    const tight = estimateFromType({ ...base, stitches: 26 })?.metres ?? 0;
    expect(tight).toBeGreaterThan(loose);
  });

  it('rounds up to the ten, because yarn is not sold by the metre', () => {
    const metres = estimateFromType({ ...base, category: 'hats', margin: 7 })?.metres ?? 0;
    expect(metres % 10).toBe(0);
  });
});

describe('estimateFromSwatch', () => {
  // 10×10cm weighing 5g is 0.05 g/cm². A 50×160cm scarf is 8,000cm², so 400g.
  const swatch = { width: 10, height: 10, grams: 5, pieceWidth: 50, pieceHeight: 160 };

  it('weighs the fabric and multiplies by the area', () => {
    const result = estimateFromSwatch(swatch);
    expect(result?.gramsPerSquareCm).toBeCloseTo(0.05, 10);
    expect(result?.area).toBe(8000);
    expect(result?.grams).toBe(400);
  });

  it('counts the pieces', () => {
    expect(estimateFromSwatch({ ...swatch, pieces: 2 })?.grams).toBe(800);
  });

  it('adds the reserve', () => {
    expect(estimateFromSwatch({ ...swatch, margin: 10 })?.grams).toBe(440);
  });

  // Grams to metres is the same ball either way, so this conversion is exact — the only one here
  // that adds no guesswork at all.
  it('turns grams into metres when the band says how many', () => {
    const result = estimateFromSwatch({ ...swatch, metresPerBall: 100, gramsPerBall: 50 });
    expect(result?.metres).toBe(800);
  });

  it('says nothing about metres when the band does not', () => {
    expect(estimateFromSwatch(swatch)?.metres).toBeNull();
  });

  it('refuses a swatch that was never measured or weighed', () => {
    expect(estimateFromSwatch({ ...swatch, grams: 0 })).toBeNull();
    expect(estimateFromSwatch({ ...swatch, width: 0 })).toBeNull();
    expect(estimateFromSwatch({ ...swatch, pieceHeight: 0 })).toBeNull();
  });
});

describe('ballsFor', () => {
  it('always rounds a ball up', () => {
    expect(ballsFor({ metres: 1450, metresPerBall: 175 })?.balls).toBe(9);
    expect(ballsFor({ metres: 350, metresPerBall: 175 })?.balls).toBe(2);
    expect(ballsFor({ metres: 351, metresPerBall: 175 })?.balls).toBe(3);
  });

  it('works out the weight and the money when it is told the price', () => {
    const result = ballsFor({
      metres: 1450,
      metresPerBall: 175,
      gramsPerBall: 50,
      pricePerBall: 3.95,
    });
    expect(result?.grams).toBe(450);
    expect(result?.cost).toBeCloseTo(35.55, 10);
  });

  // The thing the stash is for, and the one number in the model that nothing else uses to answer a
  // question.
  it('subtracts what is already in the cupboard', () => {
    const result = ballsFor({ metres: 1450, metresPerBall: 175, pricePerBall: 4, owned: 5 });
    expect(result?.balls).toBe(9);
    expect(result?.toBuy).toBe(4);
    expect(result?.toBuyCost).toBe(16);
  });

  it('does not offer a refund for owning more than enough', () => {
    const result = ballsFor({ metres: 350, metresPerBall: 175, pricePerBall: 4, owned: 10 });
    expect(result?.toBuy).toBe(0);
    expect(result?.toBuyCost).toBe(0);
  });

  // Half a ball left is a real answer in a stash, but it is not half a ball you can rely on.
  it('counts a part-used ball as not there', () => {
    expect(ballsFor({ metres: 1450, metresPerBall: 175, owned: 4.8 })?.toBuy).toBe(5);
  });

  it('says nothing without a ball length to divide by', () => {
    expect(ballsFor({ metres: 1450, metresPerBall: 0 })).toBeNull();
    expect(ballsFor({ metres: 0, metresPerBall: 175 })).toBeNull();
  });

  it('leaves the money alone when no price is known', () => {
    const result = ballsFor({ metres: 1450, metresPerBall: 175 });
    expect(result?.cost).toBeNull();
    expect(result?.toBuyCost).toBeNull();
  });
});
