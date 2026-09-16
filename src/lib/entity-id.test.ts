import { entityId, newPatternSection, newProjectSection, seedSectionId } from '@/lib/entity-id';

// Identity is what makes a section reconcilable between two devices. Everything here is about the
// two ways that goes wrong: two different sections sharing an id, or one section changing its id.

describe('making an id', () => {
  it('prefixes so an id says what it belongs to', () => {
    expect(entityId('psec')).toMatch(/^psec_/);
    expect(entityId('sec')).toMatch(/^sec_/);
  });

  // The failure this prevents is silent: two devices offline both making a third section, both
  // calling it the same thing, and one sleeve quietly overwriting another on the next sync.
  it('does not collide across many ids', () => {
    const ids = new Set(Array.from({ length: 20_000 }, () => entityId('psec')));
    expect(ids.size).toBe(20_000);
  });

  it('carries enough randomness to stay that way', () => {
    // 4 chunks of up to ~6 base36 chars, so comfortably long. A short id is a colliding id.
    expect(entityId('psec').length).toBeGreaterThan(12);
  });
});

describe('building a section', () => {
  it('always has an identity and a timestamp', () => {
    const section = newProjectSection({
      name: 'Sleeve',
      totalRows: 60,
      row: 0,
      complete: false,
      seconds: 0,
      rowNotes: [],
      notes: '',
      materialIds: [],
      toolIds: [],
      techniqueIds: [],
      description: '',
      stitchMultiple: null,
      markers: [],
      castOn: 0,
      rows: [],
    });
    expect(section.id).toMatch(/^psec_/);
    expect(section.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('gives two sections made the same way different identities', () => {
    const make = () =>
      newPatternSection({
        name: 'Body',
        totalRows: 40,
        castOn: 0,
        materials: [],
        tools: [],
        techniques: [],
        description: '',
        rows: [],
        rowNotes: [],
        notes: '',
        markers: [],
        stitchMultiple: null,
      });
    expect(make().id).not.toBe(make().id);
  });

  // Restoring a backup, or re-saving an edited section, must not mint a new identity — that would
  // read as a delete and an unrelated create on the other device.
  it('keeps an id it was given', () => {
    const section = newPatternSection({
      id: 'sec_kept',
      updatedAt: '2026-01-01T00:00:00.000Z',
      name: 'Body',
      totalRows: 40,
      castOn: 0,
      materials: [],
      tools: [],
      techniques: [],
      description: '',
      rows: [],
      rowNotes: [],
      notes: '',
      markers: [],
      stitchMultiple: null,
    });
    expect(section.id).toBe('sec_kept');
    expect(section.updatedAt).toBe('2026-01-01T00:00:00.000Z');
  });
});

// The demo data ships identically to everyone, so two devices that both seed before ever syncing
// have to agree on what the demo cardigan's sleeve is rather than each inventing one.
describe('seeded sections', () => {
  it('derives the same id from the same position every time', () => {
    expect(seedSectionId('meadow', 1)).toBe(seedSectionId('meadow', 1));
    expect(seedSectionId('meadow', 1)).not.toBe(seedSectionId('meadow', 0));
    expect(seedSectionId('meadow', 0)).not.toBe(seedSectionId('rowan', 0));
  });
});
