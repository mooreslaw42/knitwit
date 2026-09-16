import type { PatternSection, ProjectSection } from '@/types/knitwit';

// Stable identity for the things that sync.
//
// Sections were addressed by their position in an array — `project.sections[2]`. That is fine while
// there is one device and fatal once there are two: reorder or delete a section on a phone and
// every index the laptop holds points at the wrong piece of knitting. Nothing about a section's
// position identifies it, so it needs something that does.
//
// Ids must be unique across devices without asking a server, because a knitter makes sections on a
// train. So: random, not sequential. A counter would collide the moment two devices both created a
// "section 3" offline, and the collision would be silent — two different sleeves with one identity.
//
// Not a UUID, because `crypto.randomUUID` needs a secure context and Hermes does not have it. 96
// random bits in base36 is roughly a UUID's collision resistance for this purpose, and works
// everywhere the app runs.
export function entityId(prefix: string): string {
  let random = '';
  // 4 chunks of ~26 bits. Math.random is not a cryptographic source and does not need to be — this
  // is a name, not a secret, and ids are never guessed against to gain access. Ownership comes from
  // the row's user_id, not from the id being hard to type.
  for (let i = 0; i < 4; i++) random += Math.floor(Math.random() * 0x40000000).toString(36);
  return `${prefix}_${random}`;
}

// When something last changed, as the device saw it.
//
// Provisional on purpose. Once rows live in Postgres this is set by a database trigger and the
// client's value is ignored, because a device with a wrong clock that can stamp its own timestamps
// wins every conflict it should lose — and the symptom is a knitter's work quietly reverting. Until
// then it is the best available answer and it is already in the right shape.
export function stamp(): string {
  return new Date().toISOString();
}

// Factories for the two things that now carry identity.
//
// Construction sites were literals scattered across the store, the importer, the converter and the
// seed. Going through a factory means a new one cannot be added without an id, which is the whole
// point — a section without one is invisible to sync and impossible to reconcile.


export function newProjectSection(
  over: Omit<ProjectSection, 'id' | 'updatedAt'> & Partial<Pick<ProjectSection, 'id' | 'updatedAt'>>,
): ProjectSection {
  return { id: entityId('psec'), updatedAt: stamp(), ...over };
}

export function newPatternSection(
  over: Omit<PatternSection, 'id' | 'updatedAt'> & Partial<Pick<PatternSection, 'id' | 'updatedAt'>>,
): PatternSection {
  return { id: entityId('sec'), updatedAt: stamp(), ...over };
}

// The seed is the same on every device, so its sections get ids derived from where they sit rather
// than random ones. Two devices that both seed before ever syncing then agree on what the demo
// cardigan's sleeve is, instead of each inventing a different sleeve and both uploading it.
export function seedSectionId(ownerKey: string, index: number): string {
  return `seed_${ownerKey}_s${index}`;
}

// A fixed, early timestamp for seeded rows: they are older than anything a knitter does, so any
// real edit wins the comparison without a special case.
export const SEED_STAMP = '2020-01-01T00:00:00.000Z';
