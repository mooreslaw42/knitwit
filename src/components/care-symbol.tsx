import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { Colors } from '@/constants/theme';

// One textile care symbol, drawn rather than typed.
//
// These have no Unicode characters and no font the app already ships, and a photo of a ball band
// is not searchable — so they are drawn, the same way the crochet chart draws its stitches. Every
// symbol lives in the same 24×24 box and is built from the same five shapes a care label is built
// from: a tub, a triangle, a square, an iron and a circle. The "do not" versions are the plain
// symbol with a cross laid over it, which is exactly how the standard defines them, so nothing here
// is drawn twice.

const BOX = 24;

const STROKE = 1.6;
// The cross is drawn inside the shape's corners rather than across the whole box. Full-width and
// heavier — which is how it looks on a printed label an inch across — swallowed the symbol
// underneath it at the size these are actually shown, leaving five tiles that all read as "no".
const CROSS_INSET = 4.5;

type Shape = 'tub' | 'triangle' | 'square' | 'iron' | 'circle';

// What each symbol is made of: its base shape, anything drawn inside it, and whether it is crossed
// out. Written as data so a new symbol is a line here rather than another branch.
const SYMBOLS: Record<
  string,
  {
    shape: Shape;
    text?: string;
    // A line inside a drying square: flat for dry flat, upright for line dry.
    inner?: 'flat' | 'line';
    dots?: number;
    bars?: number;
    hand?: boolean;
    crossed?: boolean;
  }
> = {
  'wash-hand': { shape: 'tub', hand: true },
  'wash-30': { shape: 'tub', text: '30' },
  'wash-40': { shape: 'tub', text: '40' },
  'wash-gentle': { shape: 'tub', text: '30', bars: 2 },
  'wash-no': { shape: 'tub', crossed: true },
  'bleach-no': { shape: 'triangle', crossed: true },
  'dry-flat': { shape: 'square', inner: 'flat' },
  'dry-line': { shape: 'square', inner: 'line' },
  'tumble-low': { shape: 'square', dots: 1 },
  'tumble-no': { shape: 'square', dots: 0, crossed: true },
  'iron-low': { shape: 'iron', dots: 1 },
  'iron-medium': { shape: 'iron', dots: 2 },
  'iron-no': { shape: 'iron', crossed: true },
  dryclean: { shape: 'circle', text: 'P' },
  'dryclean-no': { shape: 'circle', crossed: true },
};

// Whether a symbol in the catalogue has a drawing here. The two lists are in separate files — one
// is the vocabulary, one is the ink — and a catalogue entry with nothing to draw is a tile with a
// label and a hole where the symbol should be, which a test can catch and a knitter shouldn't have
// to.
export const careSymbolIsDrawn = (id: string): boolean => id in SYMBOLS;

// The tub: a wavy waterline across the top, straight sides tapering in to the base.
const TUB =
  'M2.5 8.5 C4 6.6 5.6 10.4 7.2 8.5 C8.8 6.6 10.4 10.4 12 8.5 C13.6 6.6 15.2 10.4 16.8 8.5 ' +
  'C18.4 6.6 20 10.4 21.5 8.5 L19.6 19 L4.4 19 Z';

// The iron: pointed at the left, plate along the bottom, rounded back.
const IRON = 'M4 17 L7.6 11.4 C8.2 10.4 9.2 9.8 10.4 9.8 L16.4 9.8 C19 9.8 20.6 12 20.6 14.4 L20.6 17 Z';

export function CareSymbol({
  id,
  size = 30,
  colour = Colors.ink,
}: {
  id: string;
  size?: number;
  colour?: string;
}) {
  const spec = SYMBOLS[id];
  // A symbol this version doesn't know — saved by a newer one, or by a hand-edited record. Drawing
  // nothing is right: the id is still on the material, so nothing is lost by not picturing it.
  if (!spec) return null;

  const line = {
    stroke: colour,
    strokeWidth: STROKE,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
    fill: 'none',
  };

  // The dots inside a tumble-dry square or on an iron, spread around the middle of the shape.
  const dots = (count: number, cy: number) => {
    const gap = 4.4;
    const start = 12 - ((count - 1) * gap) / 2;
    return Array.from({ length: count }, (_, i) => (
      <Circle key={i} cx={start + i * gap} cy={cy} r={1.2} fill={colour} />
    ));
  };

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${BOX} ${BOX}`}>
      {/* Bars sit under the tub, and at this size they merge with its base unless the tub gives
          them room — so a barred symbol draws the same tub a little smaller and higher. */}
      {spec.shape === 'tub' && (
        <G transform={spec.bars ? 'translate(1.7 -1.6) scale(0.86)' : undefined}>
          <Path d={TUB} {...line} />
        </G>
      )}
      {spec.shape === 'triangle' && <Path d="M12 3.5 L21 19.5 L3 19.5 Z" {...line} />}
      {spec.shape === 'square' && <Rect x={3.5} y={4} width={17} height={16} rx={1.5} {...line} />}
      {spec.shape === 'iron' && (
        <G>
          <Path d={IRON} {...line} />
          <Line x1={2.5} y1={19} x2={21.5} y2={19} {...line} />
        </G>
      )}
      {spec.shape === 'circle' && <Circle cx={12} cy={12} r={8.5} {...line} />}

      {/* The drum inside a drying square. Its dots say how hot, and no dots at all is the one that
          is always crossed out — a bare drum means nothing on a label. */}
      {spec.shape === 'square' && spec.dots !== undefined && (
        <G>
          <Circle cx={12} cy={12} r={5.5} {...line} />
          {dots(spec.dots, 12)}
        </G>
      )}
      {spec.shape === 'iron' && spec.dots ? dots(spec.dots, 14) : null}

      {/* How the piece is dried: laid flat, or hung on a line. Drawn rather than written, because
          the line's direction is the whole of the instruction. */}
      {spec.inner === 'flat' && <Line x1={7.5} y1={12} x2={16.5} y2={12} {...line} />}
      {spec.inner === 'line' && <Line x1={12} y1={7.5} x2={12} y2={16.5} {...line} />}

      {/* The hand in the tub. Filled rather than outlined: at the size a form field shows these, an
          outlined hand's own strokes close up and it reads as a blot. */}
      {spec.hand && (
        <G>
          {[10.4, 9.9, 10.4].map((top, i) => (
            <Rect
              key={i}
              x={9.5 + i * 1.6}
              y={top}
              width={1.2}
              height={14.4 - top}
              rx={0.6}
              fill={colour}
            />
          ))}
          {/* The thumb, which is the one thing that makes it a hand rather than a comb. */}
          <Rect x={7.6} y={12.8} width={1.7} height={3.4} rx={0.85} fill={colour} />
          <Rect x={9.2} y={12.6} width={5.2} height={4.6} rx={1.6} fill={colour} />
        </G>
      )}

      {/* Numerals and letters — the wash temperature, the dry-cleaning solvent, the bar or line that
          says how to dry flat. Centred in the shape rather than positioned per symbol. */}
      {spec.text && (
        <SvgText
          x={12}
          y={spec.shape === 'tub' ? (spec.bars ? 14.6 : 17) : 16}
          fontSize={spec.shape === 'tub' ? 8 : 10}
          fontWeight="600"
          fill={colour}
          textAnchor="middle">
          {spec.text}
        </SvgText>
      )}

      {/* Bars under a tub: one for a gentle wash, two for the wool programme. */}
      {spec.bars
        ? Array.from({ length: spec.bars }, (_, i) => (
            <Line key={i} x1={6.5} y1={17.6 + i * 3} x2={17.5} y2={17.6 + i * 3} {...line} />
          ))
        : null}

      {spec.crossed && (
        <G>
          <Line
            x1={CROSS_INSET}
            y1={CROSS_INSET}
            x2={BOX - CROSS_INSET}
            y2={BOX - CROSS_INSET}
            {...line}
          />
          <Line
            x1={BOX - CROSS_INSET}
            y1={CROSS_INSET}
            x2={CROSS_INSET}
            y2={BOX - CROSS_INSET}
            {...line}
          />
        </G>
      )}
    </Svg>
  );
}
