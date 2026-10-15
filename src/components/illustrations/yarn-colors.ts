import { Colors } from '@/constants/theme';

// Materials have a colour *name* ("Dusty Rose", "Sage Mist") but no hex, so pick a plausible
// swatch for the placeholder skein from the words in the name. Order matters: first match wins.
const WORDS: [RegExp, string][] = [
  [/\b(charcoal|graphite|slate|grey|gray|ash)\b/i, '#8E8A8C'],
  [/\b(black|ink|night|raven)\b/i, '#4A4447'],
  [/\b(white|snow|ivory|natural|ecru)\b/i, '#F3ECE2'],
  [/\b(cream|oat|beige|sand|linen)\b/i, '#E9D9C1'],
  [/\b(teal|petrol|ocean|sea)\b/i, '#3F8F8C'],
  [/\b(navy|indigo|denim|blue|sky|cornflower)\b/i, '#6E93C9'],
  [/\b(sage|mint|green|olive|moss|fern|leaf|pistachio)\b/i, Colors.sageDeep],
  [/\b(lilac|lavender|violet|purple|plum|mauve|heather)\b/i, Colors.lavenderDeep],
  [/\b(butter|yellow|mustard|sun|lemon|gold)\b/i, Colors.butterDeep],
  [/\b(coral|peach|apricot|orange|rust|terracotta|pumpkin)\b/i, Colors.coralDeep],
  [/\b(rose|blush|pink|blossom|candy|bubblegum|salmon)\b/i, Colors.blushDeep],
  [/\b(red|cherry|berry|ruby|wine|burgundy)\b/i, '#C2505E'],
  [/\b(brown|chocolate|coffee|caramel|camel|chestnut|walnut)\b/i, '#9A6B50'],
];
const FALLBACK = [Colors.blushDeep, Colors.sageDeep, Colors.lavenderDeep, Colors.coralDeep, Colors.butterDeep];

// `swatch` is the yarn's real colour, set by the knitter or taken off its photo. Guessing from the
// name is the fallback for a stash that predates the field — it is a decent placeholder and a poor
// match, since "Dusty Rose", "Rose Quartz" and "Blush" all land on the same pink and anything
// unrecognised gets an arbitrary colour from the hash below.
export function yarnSwatchColor(colorName: string, swatch?: string | null): string {
  if (swatch) return swatch;
  for (const [pattern, hex] of WORDS) if (pattern.test(colorName)) return hex;
  let h = 0;
  for (let i = 0; i < colorName.length; i++) h = (h * 31 + colorName.charCodeAt(i)) | 0;
  return FALLBACK[Math.abs(h) % FALLBACK.length];
}
