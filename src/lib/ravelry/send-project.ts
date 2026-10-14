import { invokeEdgeFunction } from '@/lib/edge-function';
import { stamp } from '@/lib/entity-id';
import { useKnitwitStore } from '@/store/useKnitwitStore';

import { knitwitProjectToRavelry } from './export-project';

// Sending one project to Ravelry.
//
// The other direction from run-import.ts, and much smaller on purpose. It creates — never updates,
// never deletes — and only for a project Ravelry has not seen, so the worst it can do to a knitter's
// notebook is add something to it.
//
// On success the project is stamped with where it now lives. That does two jobs: the screen stops
// offering to send it again, and the next import reconciles onto this row instead of bringing the
// same project back as a second copy.

export type SentProject = { id: string; url: string };

export async function sendProjectToRavelry(projectKey: string): Promise<SentProject> {
  const before = useKnitwitStore.getState();
  const project = before.projects[projectKey];
  if (!project) throw new Error('That project is no longer here.');
  if (project.ravelrySource) throw new Error('This project is already on Ravelry.');
  if (!project.name.trim()) throw new Error('Give the project a name first.');

  // A linked pattern only lends its Ravelry id if it came from Ravelry; one the knitter wrote has
  // no counterpart there. Its size name is free text on both sides, so that travels either way.
  const pattern = project.patternId ? before.patterns[project.patternId] : undefined;
  const ravelryPatternId = Number(pattern?.ravelrySource?.id);

  const draft = knitwitProjectToRavelry(project, {
    ravelryPatternId: Number.isFinite(ravelryPatternId) && ravelryPatternId > 0 ? ravelryPatternId : null,
    sizeName: pattern?.sizes?.[project.sizeIndex] ?? null,
  });

  const result = (await invokeEdgeFunction(
    'ravelry-import',
    { task: 'create-project', draft },
    {
      timeoutMs: 30_000,
      timeoutMessage: 'Ravelry took too long to answer. Check your notebook before sending again.',
      failureMessage: "Couldn't reach Ravelry. Nothing was sent.",
    },
  )) as { id?: number; url?: string };

  const id = result.id;
  if (!id) throw new Error('Ravelry did not say where the project went.');

  // Read the project fresh: the knitter may have carried on editing while this was in flight, and
  // their work must not be rolled back by a stamp.
  const after = useKnitwitStore.getState();
  const current = after.projects[projectKey];
  if (current) {
    after.saveProject(projectKey, {
      ...current,
      ravelrySource: {
        id: String(id),
        kind: 'project',
        url: result.url ?? '',
        importedAt: stamp(),
      },
    });
  }

  return { id: String(id), url: result.url ?? '' };
}
