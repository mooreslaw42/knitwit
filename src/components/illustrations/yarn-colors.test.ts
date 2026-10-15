import { yarnSwatchColor } from '@/components/illustrations/yarn-colors';

// The swatch is the yarn's real colour; the name is a guess of last resort. Worth pinning, because
// the guess is convincing enough on screen to hide the fact that it is guessing.

describe('yarnSwatchColor', () => {
  it('uses the real colour when the yarn has one', () => {
    expect(yarnSwatchColor('Dusty Rose', '#123456')).toBe('#123456');
  });

  it('falls back to the name for a stash that predates the field', () => {
    expect(yarnSwatchColor('Sage Mist')).toBe(yarnSwatchColor('Sage Mist', null));
    expect(yarnSwatchColor('Sage Mist')).toMatch(/^#/);
  });

  it('shows why a guess is not a match: three different pinks, one colour', () => {
    const guessed = ['Dusty Rose', 'Rose Quartz', 'Blush Pink'].map((n) => yarnSwatchColor(n));
    expect(new Set(guessed).size).toBe(1);
  });

  it('still answers for a name it knows nothing about', () => {
    expect(yarnSwatchColor('Kettle No. 7')).toMatch(/^#/);
  });
});
