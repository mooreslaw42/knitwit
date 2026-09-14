import { matchTechnique, resolveTechnique } from '@/lib/technique-catalogue';
import type { CatalogueTechnique } from '@/types/knitwit';

const entry = (over: Partial<CatalogueTechnique> & { id: string; name: string }): CatalogueTechnique => ({
  craft: 'knit',
  family: 'other',
  summary: '',
  aliases: [],
  video: '',
  link: '',
  ...over,
});

const catalogue: CatalogueTechnique[] = [
  entry({ id: 'german-short-rows', name: 'German short rows', family: 'shaping', aliases: ['GSR', 'double stitch'] }),
  entry({ id: 'kitchener-stitch', name: 'Kitchener stitch', family: 'joining', aliases: ['grafting', 'graft'] }),
  entry({ id: 'magic-ring', name: 'Magic ring', craft: 'crochet', aliases: ['magic circle', 'MR'] }),
  entry({ id: 'wrap-and-turn', name: 'Wrap and turn short rows', family: 'shaping', aliases: ['w&t'] }),
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
