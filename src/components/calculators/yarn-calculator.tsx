import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Answer, Aside, CalcScreen, Caution, Inputs, NeedsInput, Working } from '@/components/calc-screen';
import { FormField, SelectField } from '@/components/knitwit-ui';
import { materialLabel } from '@/components/stash-picker';
import { ThemedText } from '@/components/themed-text';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  SIZE_OPTIONS,
  YARN_WEIGHTS,
  yarnWeightLabel,
} from '@/constants/catalogs';
import { Spacing } from '@/constants/theme';
import { round } from '@/lib/numbers';
import {
  ballsFor,
  CATEGORY_METRES,
  estimateFromSwatch,
  estimateFromType,
  SIZED_CATEGORIES,
} from '@/lib/yarn-estimate';
import { useKnitwitStore } from '@/store/useKnitwitStore';
import type { PatternCategory, TechniqueCraft } from '@/types/knitwit';

// How much yarn, and what it will cost.
//
// The question asked before the money is spent, and the one nothing else in the app answers. It is
// two calculators wearing one screen on purpose: "how much wool" and "how much will that come to"
// are one errand, and splitting them would mean entering the same ball band twice.
//
// Two ways to ask, named for how far they can be trusted. From a swatch is near enough arithmetic;
// from a project type reads a table of averages. The screen says which one it is answering from and
// never blends the two.

type Mode = 'swatch' | 'type';

const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: 'swatch', label: 'From a swatch I have knitted' },
  { value: 'type', label: 'From what I am making' },
];

const CRAFT_OPTIONS: { value: TechniqueCraft; label: string }[] = [
  { value: 'knit', label: 'Knitting' },
  { value: 'crochet', label: 'Crochet' },
];

// Only the categories the table can actually answer for. "Other" and "Queue" describe no particular
// object, so they are not offered rather than offered and refused.
const CATEGORY_OPTIONS: { value: PatternCategory; label: string }[] = CATEGORY_ORDER.filter(
  (c) => CATEGORY_METRES[c] !== null,
).map((c) => ({ value: c, label: CATEGORY_LABELS[c] }));

const SIZE_OPTIONS_LIST = SIZE_OPTIONS.map((s) => ({ value: s, label: s }));
const WEIGHT_OPTIONS = YARN_WEIGHTS.map((w) => ({ value: w.code, label: yarnWeightLabel(w.code) }));

const num = (value: string): number | null => {
  const n = parseFloat(value.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

function euros(amount: number): string {
  return `€${amount.toFixed(2)}`;
}

export function YarnCalculator() {
  const materials = useKnitwitStore((state) => state.materials);

  const [mode, setMode] = useState<Mode>('type');

  // What is being made.
  const [category, setCategory] = useState<PatternCategory>('sweaters');
  const [size, setSize] = useState<string>('M');
  const [craft, setCraft] = useState<TechniqueCraft>('knit');
  const [weight, setWeight] = useState('3');
  const [needle, setNeedle] = useState('');
  const [stitches, setStitches] = useState('');
  const [rows, setRows] = useState('');
  const [margin, setMargin] = useState('10');

  // The swatch, and the piece it is standing in for.
  const [swatchWidth, setSwatchWidth] = useState('10');
  const [swatchHeight, setSwatchHeight] = useState('10');
  const [swatchGrams, setSwatchGrams] = useState('');
  const [pieceWidth, setPieceWidth] = useState('');
  const [pieceHeight, setPieceHeight] = useState('');
  const [pieces, setPieces] = useState('1');

  // The ball band. Filled from the stash when a yarn is picked — the whole reason this is in
  // Knitwit rather than on a website.
  const [materialId, setMaterialId] = useState('');
  const [metresPerBall, setMetresPerBall] = useState('');
  const [gramsPerBall, setGramsPerBall] = useState('');
  const [price, setPrice] = useState('');
  const [owned, setOwned] = useState('');

  const stashOptions = [
    { value: '', label: 'Not from my stash' },
    ...Object.entries(materials).map(([id, m]) => ({ value: id, label: materialLabel(m) })),
  ];

  // Picking a yarn fills the band in; everything stays editable afterwards, because what a shop
  // charges today is not what the stash recorded last year.
  const pickMaterial = (id: string) => {
    setMaterialId(id);
    const m = materials[id];
    if (!m) return;
    setMetresPerBall(m.meters ?? '');
    setGramsPerBall(m.grams ?? '');
    setPrice(m.price ?? '');
    setOwned(m.skeins != null ? String(m.skeins) : '');
    if (m.weight) setWeight(String(m.weight));
    if (m.craftType) setCraft(m.craftType);
  };

  const bandMetres = num(metresPerBall);
  const bandGrams = num(gramsPerBall);

  const typeEstimate =
    mode === 'type'
      ? estimateFromType({
          category,
          size,
          craft,
          weight,
          needle: num(needle) ?? undefined,
          stitches: num(stitches) ?? undefined,
          rows: num(rows) ?? undefined,
          margin: num(margin) ?? 0,
        })
      : null;

  const swatchEstimate =
    mode === 'swatch'
      ? estimateFromSwatch({
          width: num(swatchWidth) ?? 0,
          height: num(swatchHeight) ?? 0,
          grams: num(swatchGrams) ?? 0,
          pieceWidth: num(pieceWidth) ?? 0,
          pieceHeight: num(pieceHeight) ?? 0,
          pieces: num(pieces) ?? 1,
          margin: num(margin) ?? 0,
          metresPerBall: bandMetres ?? undefined,
          gramsPerBall: bandGrams ?? undefined,
        })
      : null;

  const metres = mode === 'type' ? (typeEstimate?.metres ?? null) : (swatchEstimate?.metres ?? null);
  const balls =
    metres !== null && bandMetres
      ? ballsFor({
          metres,
          metresPerBall: bandMetres,
          gramsPerBall: bandGrams ?? undefined,
          pricePerBall: num(price) ?? undefined,
          owned: num(owned) ?? undefined,
        })
      : null;

  const sized = SIZED_CATEGORIES.includes(category);

  return (
    <CalcScreen
      title="How much yarn do I need?"
      question="Before you buy: how many balls a make will take, what that comes to, and how many of them you already have.">
      <Inputs label="How you want it worked out">
        <SelectField label="Work it out" options={MODE_OPTIONS} value={mode} onChange={setMode} />
        <ThemedText type="small" themeColor="inkSoft">
          {mode === 'swatch'
            ? 'The accurate way, and the only one that knows your yarn and your tension. Knit a swatch, measure it and weigh it on kitchen scales.'
            : 'A starting point from a table of averages. Fit, ease, length and stitch pattern all move it further than anything you can type here.'}
        </ThemedText>
      </Inputs>

      {mode === 'type' ? (
        <Inputs label="What you are making">
          <SelectField
            label="What are you making?"
            options={CATEGORY_OPTIONS}
            value={category}
            onChange={setCategory}
          />
          {sized ? (
            <SelectField label="Size" options={SIZE_OPTIONS_LIST} value={size} onChange={setSize} />
          ) : (
            <ThemedText type="small" themeColor="inkSoft">
              {CATEGORY_LABELS[category]} isn&apos;t graded by body size, so there is no size to
              pick.
            </ThemedText>
          )}
          <SelectField label="Craft" options={CRAFT_OPTIONS} value={craft} onChange={setCraft} />
          <SelectField
            label="Yarn weight"
            options={WEIGHT_OPTIONS}
            value={weight}
            onChange={setWeight}
          />
          <ThemedText type="small" themeColor="inkSoft">
            The rest is optional, and only nudges the answer. Leave it blank for the average for
            this weight.
          </ThemedText>
          <View style={styles.row}>
            <View style={styles.grow}>
              <FormField
                label="Needle / hook (mm)"
                value={needle}
                onChangeText={setNeedle}
                keyboardType="numeric"
                placeholder="e.g. 4"
              />
            </View>
            <View style={styles.grow}>
              <FormField
                label="Stitches per 10cm"
                value={stitches}
                onChangeText={setStitches}
                keyboardType="numeric"
                placeholder="e.g. 22"
              />
            </View>
            <View style={styles.grow}>
              <FormField
                label="Rows per 10cm"
                value={rows}
                onChangeText={setRows}
                keyboardType="numeric"
                placeholder="e.g. 30"
              />
            </View>
          </View>
        </Inputs>
      ) : null}

      {mode === 'swatch' ? (
        <Inputs label="The swatch you knitted and weighed">
          <View style={styles.row}>
            <View style={styles.grow}>
              <FormField
                label="Width (cm)"
                value={swatchWidth}
                onChangeText={setSwatchWidth}
                keyboardType="numeric"
                placeholder="e.g. 10"
              />
            </View>
            <View style={styles.grow}>
              <FormField
                label="Height (cm)"
                value={swatchHeight}
                onChangeText={setSwatchHeight}
                keyboardType="numeric"
                placeholder="e.g. 10"
              />
            </View>
            <View style={styles.grow}>
              <FormField
                label="Weight (g)"
                value={swatchGrams}
                onChangeText={setSwatchGrams}
                keyboardType="numeric"
                placeholder="e.g. 5"
              />
            </View>
          </View>
        </Inputs>
      ) : null}

      {mode === 'swatch' ? (
        <Inputs label="The piece you are making">
          <View style={styles.row}>
            <View style={styles.grow}>
              <FormField
                label="Width (cm)"
                value={pieceWidth}
                onChangeText={setPieceWidth}
                keyboardType="numeric"
                placeholder="e.g. 50"
              />
            </View>
            <View style={styles.grow}>
              <FormField
                label="Length (cm)"
                value={pieceHeight}
                onChangeText={setPieceHeight}
                keyboardType="numeric"
                placeholder="e.g. 160"
              />
            </View>
            <View style={styles.grow}>
              <FormField
                label="How many?"
                value={pieces}
                onChangeText={setPieces}
                keyboardType="numeric"
                placeholder="e.g. 1"
              />
            </View>
          </View>
          <ThemedText type="small" themeColor="inkSoft">
            Flat area, so a garment means adding its pieces up — a body and two sleeves is three
            rectangles, roughly. Rough is what this is.
          </ThemedText>
        </Inputs>
      ) : null}

      <Inputs label="How much to spare">
        <FormField
          label="Reserve to add (%)"
          value={margin}
          onChangeText={setMargin}
          keyboardType="numeric"
          placeholder="e.g. 10"
        />
        <ThemedText type="small" themeColor="inkSoft">
          A make that runs out two rows from the end is a make ruined, and the next dye lot will not
          match. Capped at 30% — beyond that the answer is a better estimate, not a bigger margin.
        </ThemedText>
      </Inputs>

      <Inputs label="The yarn, and what you already have">
        <SelectField
          label="From your stash"
          options={stashOptions}
          value={materialId}
          onChange={pickMaterial}
        />
        <View style={styles.row}>
          <View style={styles.grow}>
            <FormField
              label="Metres per ball"
              value={metresPerBall}
              onChangeText={setMetresPerBall}
              keyboardType="numeric"
              placeholder="e.g. 175"
            />
          </View>
          <View style={styles.grow}>
            <FormField
              label="Grams per ball"
              value={gramsPerBall}
              onChangeText={setGramsPerBall}
              keyboardType="numeric"
              placeholder="e.g. 50"
            />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.grow}>
            <FormField
              label="Price per ball (€)"
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
              placeholder="e.g. 3.95"
            />
          </View>
          <View style={styles.grow}>
            <FormField
              label="Balls you already have"
              value={owned}
              onChangeText={setOwned}
              keyboardType="numeric"
              placeholder="e.g. 0"
            />
          </View>
        </View>
      </Inputs>

      {metres === null ? (
        <NeedsInput>
          {mode === 'swatch'
            ? 'A swatch measured and weighed, and the size of the piece you are making.'
            : 'What you are making, and the weight of yarn.'}
        </NeedsInput>
      ) : (
        <Answer
          label={mode === 'swatch' ? 'From your swatch, you need about' : 'You need roughly'}
          value={
            balls
              ? `${balls.balls} ${balls.balls === 1 ? 'ball' : 'balls'}`
              : `${metres.toLocaleString()}m`
          }>
          {/* Only when it says something the headline didn't. With no ball band the headline is
              already the metreage, and repeating it underneath reads as a glitch. */}
          {balls || swatchEstimate ? (
            <Working>
              {metres.toLocaleString()}m
              {balls?.grams ? ` · ${balls.grams}g` : ''}
              {swatchEstimate ? ` · ${swatchEstimate.grams}g of yarn` : ''}
              {balls?.cost != null ? ` · ${euros(balls.cost)}` : ''}
            </Working>
          ) : null}
          {!balls ? (
            <Caution>Add the metres on the ball band to turn this into balls and a price.</Caution>
          ) : null}
          {swatchEstimate ? (
            <Working>
              Your fabric weighs {round(swatchEstimate.gramsPerSquareCm * 100, 2)}g per 100cm², over{' '}
              {swatchEstimate.area.toLocaleString()}cm² of it.
            </Working>
          ) : null}
          {typeEstimate ? (
            <Working>
              {typeEstimate.base.toLocaleString()}m for an average {CATEGORY_LABELS[category].toLowerCase()}
              {sized ? `, ×${round(typeEstimate.sizeFactor, 2)} for ${size}` : ''}, ×
              {round(typeEstimate.weightFactor, 2)} for the yarn weight
              {typeEstimate.craftFactor !== 1 ? ', ×1.25 to crochet it' : ''}
              {typeEstimate.needleFactor !== 1
                ? `, ×${round(typeEstimate.needleFactor, 2)} for the needle`
                : ''}
              {typeEstimate.gaugeFactor !== 1
                ? `, ×${round(typeEstimate.gaugeFactor, 2)} for your gauge`
                : ''}
              {typeEstimate.margin > 0 ? `, plus ${typeEstimate.margin}% reserve` : ''}.
            </Working>
          ) : null}
        </Answer>
      )}

      {balls ? (
        <Aside title="What to buy">
          {balls.toBuy === 0 ? (
            <Answer bare label="Already in the stash" value="Nothing to buy">
              <Working>
                {balls.owned} {balls.owned === 1 ? 'ball' : 'balls'} on hand against the{' '}
                {balls.balls} this needs.
              </Working>
            </Answer>
          ) : (
            <Answer
              bare
              label="Still to buy"
              value={`${balls.toBuy} ${balls.toBuy === 1 ? 'ball' : 'balls'}`}>
              <Working>
                {balls.owned > 0
                  ? `${balls.balls} needed, ${balls.owned} already in the stash.`
                  : `${balls.balls} needed, and none recorded in the stash.`}
                {balls.toBuyCost != null ? ` About ${euros(balls.toBuyCost)}.` : ''}
              </Working>
              <Caution>
                Buy them together — a second dye lot of the same colour is not the same colour.
              </Caution>
            </Answer>
          )}
        </Aside>
      ) : null}

      <ThemedText type="small" themeColor="inkSoft">
        An estimate either way. Stitch pattern, ease, how long you make it and how tightly you knit
        all move the real figure, and none of them is in this arithmetic.
      </ThemedText>
    </CalcScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  grow: { flex: 1, minWidth: 110 },
});
