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

import { mergeMaterial, mergePattern, mergeProject, mergeTool } from './merge-imported';
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

// Each kind applies on its own, so the import can land a page at a time instead of one whole
// notebook. Everything goes in through a merge rather than a replace: reconciling onto a row the
// knitter has since edited must refresh Ravelry's facts without destroying their work — see
// merge-imported.ts. Each returns how many it wrote, for the running total.

export function applyStash(
  items: RavelryStash[],
  target: ImportTarget,
  importedAt: string,
): number {
  for (const stash of items) {
    const key = existingKey(target.getMaterials(), String(stash.id));
    const incoming = ravelryStashToMaterial(stash, importedAt);
    const existing = key ? target.getMaterials()[key] : undefined;
    target.saveMaterial(key, existing ? mergeMaterial(existing, incoming) : incoming);
  }
  return items.length;
}

export function applyNeedles(
  records: RavelryNeedleRecord[],
  target: ImportTarget,
  importedAt: string,
): number {
  // Grouped first: Ravelry keeps one record per physical needle, Knitwit one tool with a quantity.
  const tools = ravelryNeedlesToTools(records, importedAt);
  for (const tool of tools) {
    const ravelryId = tool.ravelrySource?.id;
    const key = ravelryId ? existingKey(target.getTools(), ravelryId) : null;
    const existing = key ? target.getTools()[key] : undefined;
    target.saveTool(key, existing ? mergeTool(existing, tool) : tool);
  }
  return tools.length;
}

export function applyPatterns(
  items: RavelryPattern[],
  target: ImportTarget,
  importedAt: string,
): number {
  for (const pattern of items) {
    const key = existingKey(target.getPatterns(), String(pattern.id));
    const incoming = ravelryPatternToPattern(pattern, importedAt);
    const existing = key ? target.getPatterns()[key] : undefined;
    target.savePattern(key, existing ? mergePattern(existing, incoming) : incoming);
  }
  return items.length;
}

// Projects go last of any batch: their links are resolved by finding the pattern and the stash yarn
// already in the store, so those have to have been applied first.
export function applyProjects(
  items: RavelryProject[],
  target: ImportTarget,
  importedAt: string,
): number {
  for (const rawProject of items) {
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

    const key = existingKey(target.getProjects(), String(rawProject.id));
    const existing = key ? target.getProjects()[key] : undefined;
    target.saveProject(key, existing ? mergeProject(existing, project) : project);
  }
  return items.length;
}

// Which of these Ravelry patterns the store has never seen. The paged import asks the server only
// for the details it is missing, so a pattern shared by thirty projects is fetched once.
export function missingPatternIds(target: ImportTarget, ids: number[]): number[] {
  const patterns = target.getPatterns();
  return [...new Set(ids)].filter((id) => existingKey(patterns, String(id)) === null);
}

// The whole notebook in one go. Still used by the single-shot `pull`, and the shape the tests pin.
export function applyRavelryImport(
  data: RavelryImportData,
  target: ImportTarget,
  importedAt: string,
): ImportSummary {
  return {
    materials: applyStash(data.stash, target, importedAt),
    tools: applyNeedles(data.needles, target, importedAt),
    patterns: applyPatterns(data.patterns, target, importedAt),
    projects: applyProjects(data.projects, target, importedAt),
  };
}
