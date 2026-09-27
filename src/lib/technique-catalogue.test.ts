import { matchTechnique, resolveTechnique, techniqueLabel } from '@/lib/technique-catalogue';
import type { CatalogueTechnique } from '@/types/knitwit';

const entry = (over: Partial<CatalogueTechnique> & { id: string; name: string }): CatalogueTechnique => ({
  craft: 'knit',
  family: 'other',
  abbr: '',
  summary: '',
  aliases: [],
  video: '',
  link: '',
  ...over,
});

const catalogue: CatalogueTechnique[] = [
  entry({ id: 'german-short-rows', name: 'German short rows', family: 'shaping', abbr: 'GSR', aliases: ['double stitch'] }),
  entry({ id: 'kitchener-stitch', name: 'Kitchener stitch', family: 'joining', aliases: ['grafting', 'graft'] }),
  entry({ id: 'magic-ring', name: 'Magic ring', craft: 'crochet', aliases: ['magic circle', 'MR'] }),
  entry({ id: 'wrap-and-turn', name: 'Wrap and turn short rows', family: 'shaping', abbr: 'w&t' }),
  entry({ id: 'blocking', name: 'Blocking', craft: 'both' }),
];

describe('matchTechnique', () => {
  it('matches a name exactly, whatever the case and punctuation', () => {
    expect(matchTechnique('German Short Rows', catalogue)?.id).toBe('german-short-rows');
    expect(matchTechnique('german short rows', catalogue)?.id).toBe('german-short-rows');
  });

  // The point of aliases: patterns don't use the catalogue's wording.
  it('matches what a pattern actually calls it', () => {
    expect(matchTechnique('grafting', catalogue)?.id).toBe('kitchener-stitch');
    expect(matchTechnique('magic circle', catalogue)?.id).toBe('magic-ring');
    expect(matchTechnique('w&t', catalogue)?.id).toBe('wrap-and-turn');
  });

  it('finds a technique named inside a longer phrase', () => {
    expect(matchTechnique('German short rows (see page 4)', catalogue)?.id).toBe('german-short-rows');
    expect(matchTechnique('Use the magic ring method', catalogue)?.id).toBe('magic-ring');
  });

  // "Wrap and turn short rows" contains "short rows"; a shorter, more general entry must not win.
  it('prefers the longest match, so a variant beats the general case', () => {
    expect(matchTechnique('Wrap and turn short rows', catalogue)?.id).toBe('wrap-and-turn');
  });

  // A wrong match would tell a knitter they already know something they've never done, and hang
  // the wrong video off a pattern. Nothing is better.
  it('returns nothing rather than guessing', () => {
    expect(matchTechnique('Bavarian twisted travelling stitches', catalogue)).toBeNull();
    expect(matchTechnique('', catalogue)).toBeNull();
    expect(matchTechnique('   ', catalogue)).toBeNull();
  });

  it('does not match on a fragment too short to mean anything', () => {
    // 'MR' is a real alias but only two characters, so it is only ever an exact match.
    expect(matchTechnique('MR', catalogue)?.id).toBe('magic-ring');
    expect(matchTechnique('summary of my rows', catalogue)).toBeNull();
  });
});

describe('resolveTechnique', () => {
  const byId = Object.fromEntries(catalogue.map((t) => [t.id, t]));

  it('reads a catalogue entry', () => {
    const r = resolveTechnique('blocking', { status: 'known', notes: '', addedOn: '' }, byId);
    expect(r).toMatchObject({ name: 'Blocking', craft: 'both', isCustom: false });
  });

  it('reads one the knitter added themselves', () => {
    const r = resolveTechnique(
      'own-3',
      { status: 'want', notes: '', addedOn: '', custom: { name: 'Nan’s edging', craft: 'crochet' } },
      byId,
    );
    expect(r).toMatchObject({ name: 'Nan’s edging', craft: 'crochet', isCustom: true });
  });

  // Offline on a first run, or a row removed from the catalogue. A section that says it uses this
  // still says so, rather than the technique silently vanishing from the project.
  it('falls back to the slug rather than disappearing', () => {
    expect(resolveTechnique('tubular-cast-on', undefined, {}).name).toBe('tubular cast on');
  });
});

// A pattern writes "ssk" far more often than "slip slip knit", so the short form has to be a thing
// the app knows rather than something buried in the aliases.
describe('abbreviations', () => {
  it('finds a technique by what the pattern actually wrote', () => {
    expect(matchTechnique('w&t', catalogue)?.id).toBe('wrap-and-turn');
    expect(matchTechnique('GSR', catalogue)?.id).toBe('german-short-rows');
    // Punctuation and case are not the knitter's problem.
    expect(matchTechnique('W & T', catalogue)?.id).toBe('wrap-and-turn');
  });

  // An abbreviation is two or three characters; letting one match inside a sentence would hang the
  // wrong technique off half the rows in a pattern.
  it('only ever matches an abbreviation exactly', () => {
    expect(matchTechnique('knit to the end, then w&t the next stitch', catalogue)).toBeNull();
  });

  it('carries the short form through to the screens', () => {
    const byId = Object.fromEntries(catalogue.map((t) => [t.id, t]));
    expect(resolveTechnique('wrap-and-turn', undefined, byId).abbr).toBe('w&t');
    // A catalogue cached before this field existed, and an entry that has no short form.
    expect(resolveTechnique('blocking', undefined, byId).abbr).toBe('');
    expect(resolveTechnique('unknown-slug', undefined, {}).abbr).toBe('');
  });

  it("keeps a custom technique's own short form", () => {
    const r = resolveTechnique(
      'own-3',
      {
        status: 'want',
        notes: '',
        addedOn: '',
        custom: { name: 'Nan’s edging', craft: 'crochet', abbr: 'NE' },
      },
      {},
    );
    expect(r).toMatchObject({ name: 'Nan’s edging', abbr: 'NE', isCustom: true });
  });

  describe('techniqueLabel', () => {
    it('names it in full, with the short form after', () => {
      expect(techniqueLabel({ name: 'Slip slip knit', abbr: 'ssk' })).toBe('Slip slip knit (ssk)');
    });

    // Nobody abbreviates "Blocking", and an empty pair of brackets would say the app lost something.
    it('leaves the brackets off when there is no short form', () => {
      expect(techniqueLabel({ name: 'Blocking', abbr: '' })).toBe('Blocking');
      expect(techniqueLabel({ name: 'Blocking' })).toBe('Blocking');
      expect(techniqueLabel({ name: 'Blocking', abbr: '  ' })).toBe('Blocking');
    });
  });
});
