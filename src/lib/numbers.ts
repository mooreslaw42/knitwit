// A number as the calculators show it: rounded to `places`, with any trailing zeros dropped.
//
// Shared because the four calculators all print worked-out numbers and three copies of this had
// already appeared — one in the calculator tab, one in the regauge panel, one in gauge.ts. "33.3"
// rather than "33.30", and "33" rather than "33.00": a trailing zero on a stitch count claims a
// precision that rounding has just thrown away.
export function round(n: number, places = 2): string {
  const f = 10 ** places;
  return String(Math.round(n * f) / f);
}
