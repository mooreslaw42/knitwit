import {
  CALCULATOR_GROUPS,
  CALCULATORS,
  calculatorById,
  calculatorsInGroup,
} from '@/lib/calculators';
import { calculatorHref } from '@/components/calculators/calculator-link';
import { KNIT_ICONS } from '@/components/icons/knit-icon-data';

describe('the calculator registry', () => {
  // The registry is what decides what `/calculator/<id>` resolves to, so a duplicate id would make
  // one of the two unreachable.
  it('gives every calculator a unique id', () => {
    const ids = CALCULATORS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // An id is an address — it appears in URLs a knitter can bookmark and in links from project
  // screens. Keeping them URL-safe is the whole reason they are not derived from the title.
  it('keeps ids url-safe', () => {
    CALCULATORS.forEach((c) => expect(c.id).toMatch(/^[a-z][a-z0-9-]*$/));
  });

  it('names an icon that exists', () => {
    CALCULATORS.forEach((c) => expect(KNIT_ICONS).toHaveProperty(c.icon));
  });

  // The hub renders group by group; a calculator in a group it doesn't know about would simply
  // never be listed.
  it('puts every calculator in a known group', () => {
    const groups = CALCULATOR_GROUPS.map((g) => g.id);
    CALCULATORS.forEach((c) => expect(groups).toContain(c.group));
  });

  it('accounts for every calculator across the groups', () => {
    const listed = CALCULATOR_GROUPS.flatMap((g) => calculatorsInGroup(g.id));
    expect(listed).toHaveLength(CALCULATORS.length);
  });

  // The question is what the hub leads with and what somebody chooses between, so an empty one
  // would leave a row saying only "Which needle or hook?".
  it('asks a real question for each', () => {
    CALCULATORS.forEach((c) => {
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.question.length).toBeGreaterThan(10);
    });
  });

  it('resolves an id, and refuses one it does not know', () => {
    expect(calculatorById('rescale')?.title).toBe('Rescale a stitch count');
    expect(calculatorById('nonsense')).toBeNull();
    expect(calculatorById(undefined)).toBeNull();
  });
});

describe('calculatorHref', () => {
  it('addresses a calculator with no context at all', () => {
    expect(calculatorHref('rescale')).toBe('/calculator/rescale');
    expect(calculatorHref('needle', {})).toBe('/calculator/needle');
  });

  it('carries the context it is given, and only that', () => {
    expect(calculatorHref('rescale', { pattern: 'yoke' })).toBe('/calculator/rescale?pattern=yoke');
    expect(calculatorHref('rescale', { project: 'hazel', pattern: undefined })).toBe(
      '/calculator/rescale?project=hazel',
    );
  });

  // Project keys and entity ids are generated, but a yarn imported from Ravelry can arrive with
  // anything in its id, and an unescaped & would silently truncate the query.
  it('escapes what it puts in the query string', () => {
    expect(calculatorHref('measure', { material: 'a&b c' })).toBe(
      '/calculator/measure?material=a%26b%20c',
    );
  });
});
