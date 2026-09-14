import { addLabel, cleanLabel, hasLabel, labelKey, labelsInUse, removeLabel } from '@/lib/labels';

describe('cleanLabel', () => {
  it('tidies whitespace without changing the words', () => {
    expect(cleanLabel('  Christmas   presents  2027 ')).toBe('Christmas presents 2027');
  });

  it('caps the length so a label stays a label', () => {
    expect(cleanLabel('x'.repeat(200)).length).toBe(60);
  });
});

describe('addLabel', () => {
  it('adds one', () => {
    expect(addLabel([], 'Christmas presents 2027')).toEqual(['Christmas presents 2027']);
  });

  // The whole reason the key exists: a stray capital or a double space must not split a group.
  it('treats a different spelling of the same group as the same group', () => {
    const one = ['Christmas presents 2027'];
    expect(addLabel(one, 'christmas presents 2027')).toBe(one);
    expect(addLabel(one, 'Christmas  Presents  2027')).toBe(one);
  });

  // The group already has a name by the time you type it again.
  it('keeps the spelling first used', () => {
    expect(addLabel(['For Mum'], 'for mum')).toEqual(['For Mum']);
  });

  it('ignores an empty one', () => {
    expect(addLabel(['a'], '   ')).toEqual(['a']);
    expect(addLabel([], '')).toEqual([]);
  });
});

describe('removeLabel and hasLabel', () => {
  it('removes whatever the spelling', () => {
    expect(removeLabel(['For Mum', 'Socks'], 'for mum')).toEqual(['Socks']);
  });

  it('finds one whatever the spelling', () => {
    expect(hasLabel(['For Mum'], 'FOR MUM')).toBe(true);
    expect(hasLabel(['For Mum'], 'for dad')).toBe(false);
  });
});

describe('labelsInUse', () => {
  it('collects every label across the projects, sorted', () => {
    expect(
      labelsInUse([{ labels: ['Socks'] }, { labels: ['Christmas'] }, { labels: ['Socks'] }]),
    ).toEqual(['Christmas', 'Socks']);
  });

  // A typo on one project shouldn't rename the group in the filter row.
  it('offers the spelling used most', () => {
    expect(
      labelsInUse([
        { labels: ['Christmas presents'] },
        { labels: ['Christmas presents'] },
        { labels: ['christmas PRESENTS'] },
      ]),
    ).toEqual(['Christmas presents']);
  });

  it('copes with projects that have none', () => {
    expect(labelsInUse([{}, { labels: [] }, { labels: ['A'] }])).toEqual(['A']);
    expect(labelsInUse([])).toEqual([]);
  });

  it('ignores a label that is only whitespace', () => {
    expect(labelsInUse([{ labels: ['  ', 'Real'] }])).toEqual(['Real']);
  });
});

describe('labelKey', () => {
  it('is the same for anything that reads the same', () => {
    expect(labelKey('  For   MUM ')).toBe(labelKey('for mum'));
  });

  it('is different for different groups', () => {
    expect(labelKey('For Mum')).not.toBe(labelKey('For Dad'));
  });
});
