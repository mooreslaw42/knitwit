// Applying a pull from Ravelry to the store.
//
// The keystone of the import: it runs the four mappers, reconciles each result against what is
// already there (so a second import updates rather than duplicates), and stitches the links a
// project carries — to its pattern, and to the yarns it was worked in — now that those exist as
// Knitwit entities. See docs/plans/ravelry-import.md.
//
// It talks to the store through a small interface rather than importing it, so the whole thing is
// pure and testable with a fake target. The real caller builds a target from useKnitwitStore.

import type { Material, Pattern, Project, Tool } from '@/types/knitwit';

import { ravelryNeedlesToTools } from './needles';
import { ravelryPatternToPattern } from './patterns';
import { ravelryProjectToProject } from './projects';
import { ravelryStashToMaterial } from './stash';
import type {
  RavelryNeedleRecord,
  RavelryPattern,
  RavelryProject,
  RavelryStash,
} from './types';

export type RavelryImportData = {
  stash: RavelryStash[];
  needles: RavelryNeedleRecord[];
  patterns: RavelryPattern[];
  projects: RavelryProject[];
};

// What the import needs from the store: read the current collections (to reconcile), and upsert.
// `save*(id, …)` with an existing key updates; with null it creates and returns the new key — the
// shape the store's own actions already have.
export interface ImportTarget {
  getMaterials(): Record<string, Material>;
  getTools(): Record<string, Tool>;
  getPatterns(): Record<string, Pattern>;
  getProjects(): Record<string, Project>;
  saveMaterial(id: string | null, data: Material): string;
  saveTool(id: string | null, data: Tool): string;
  savePattern(id: string | null, data: Pattern): string;
  saveProject(id: string | null, data: Project): string;
}

export type ImportSummary = {
  materials: number;
  tools: number;
  patterns: number;
  projects: number;
};

type Stamped = { ravelrySource?: { id: string } };

// The Knitwit key of an already-imported entity that came from this same Ravelry thing, so the
// re-import lands on it. Null when it is new.
function existingKey(record: Record<string, Stamped>, ravelryId: string): string | null {
  for (const [key, value] of Object.entries(record)) {
    if (value.ravelrySource?.id === ravelryId) return key;
  }
  return null;
}

export function applyRavelryImport(
  data: RavelryImportData,
  target: ImportTarget,
  importedAt: string,
): ImportSummary {
  // Stash, needles and patterns first — a project's links are resolved by finding them in the store
  // after they have been saved.
  for (const stash of data.stash) {
    const key = existingKey(target.getMaterials(), String(stash.id));
    target.saveMaterial(key, ravelryStashToMaterial(stash, importedAt));
  }

  const tools = ravelryNeedlesToTools(data.needles, importedAt);
  for (const tool of tools) {
    const ravelryId = tool.ravelrySource?.id;
    target.saveTool(ravelryId ? existingKey(target.getTools(), ravelryId) : null, tool);
  }

  for (const pattern of data.patterns) {
    const key = existingKey(target.getPatterns(), String(pattern.id));
    target.savePattern(key, ravelryPatternToPattern(pattern, importedAt));
  }

  for (const rawProject of data.projects) {
    const { project, ravelryPatternId, yarns } = ravelryProjectToProject(rawProject, importedAt);

    // Link to the pattern card, if one was imported from the same Ravelry pattern.
    if (ravelryPatternId != null) {
      project.patternId = existingKey(target.getPatterns(), String(ravelryPatternId));
    }

    // How many skeins of each imported yarn the project used, keyed by the stash Material it
    // resolved to. Only yarns the knitter had linked to a stash entry can be matched.
    const skeins: Record<string, number> = {};
    for (const yarn of yarns) {
      if (yarn.stashId == null) continue;
      const materialKey = existingKey(target.getMaterials(), String(yarn.stashId));
      if (materialKey) skeins[materialKey] = yarn.skeins;
    }
    if (Object.keys(skeins).length > 0) project.materialSkeins = skeins;

    target.saveProject(existingKey(target.getProjects(), String(rawProject.id)), project);
  }

  return {
    materials: data.stash.length,
    tools: tools.length,
    patterns: data.patterns.length,
    projects: data.projects.length,
  };
}
