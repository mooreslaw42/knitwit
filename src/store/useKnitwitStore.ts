import { create } from 'zustand';

import { SEED_MATERIALS, SEED_PATTERNS, SEED_PROJECTS, SEED_TOOLS } from '@/data/seed';
import { currentSectionIndexOf } from '@/lib/knitwit-helpers';
import type { Material, Pattern, Project, Tool } from '@/types/knitwit';

type KnitwitState = {
  materials: Record<string, Material>;
  tools: Record<string, Tool>;
  patterns: Record<string, Pattern>;
  projects: Record<string, Project>;

  activeProjectKey: string;
  activeSectionIndex: number;

  timerKey: string | null; // `${projectKey}|${sectionIndex}`
  timerStartedAt: number | null;

  dismissedMarkerRow: number | null;
  castOffDismissed: boolean;
  noteFormOpen: boolean;
  noteSeq: number;
  materialSeq: number;
  toolSeq: number;

  saveMaterial: (id: string | null, data: Material) => string;
  deleteMaterial: (id: string) => void;
  saveTool: (id: string | null, data: Tool) => string;
  deleteTool: (id: string) => void;

  setActiveSection: (projectKey: string, sectionIndex: number) => void;
  changeRow: (delta: number) => void;
  toggleTimer: () => void;
  ensureTimerRunning: () => void;
  stopTimer: () => void;
  confirmMarker: () => void;
  dismissMarker: () => void;
  dismissCastOff: () => void;
  confirmCastOff: () => void;
  openNoteForm: () => void;
  closeNoteForm: () => void;
  saveNote: (row: number, text: string) => void;
  toggleFavorite: (patternId: string) => void;
};

function clampSectionIndex(projects: Record<string, Project>, projectKey: string, index: number) {
  const n = projects[projectKey]?.sections.length ?? 0;
  if (!n) return 0;
  if (index < 0 || index >= n) return 0;
  return index;
}

export const useKnitwitStore = create<KnitwitState>((set, get) => ({
  materials: SEED_MATERIALS,
  tools: SEED_TOOLS,
  patterns: SEED_PATTERNS,
  projects: SEED_PROJECTS,

  activeProjectKey: 'meadow',
  activeSectionIndex: currentSectionIndexOf(SEED_PROJECTS.meadow),

  timerKey: null,
  timerStartedAt: null,

  dismissedMarkerRow: null,
  castOffDismissed: false,
  noteFormOpen: false,
  noteSeq: 4,
  materialSeq: 4,
  toolSeq: 4,

  saveMaterial: (id, data) => {
    const { materials, materialSeq } = get();
    const resolvedId = id ?? `m${materialSeq}`;
    set({
      materials: { ...materials, [resolvedId]: data },
      materialSeq: id ? materialSeq : materialSeq + 1,
    });
    return resolvedId;
  },

  deleteMaterial: (id) => {
    const { materials, projects } = get();
    const nextMaterials = { ...materials };
    delete nextMaterials[id];
    const nextProjects = Object.fromEntries(
      Object.entries(projects).map(([key, p]) => [
        key,
        {
          ...p,
          sections: p.sections.map((s) =>
            s.materialId === id ? { ...s, materialId: null } : s,
          ),
        },
      ]),
    );
    set({ materials: nextMaterials, projects: nextProjects });
  },

  saveTool: (id, data) => {
    const { tools, toolSeq } = get();
    const resolvedId = id ?? `t${toolSeq}`;
    set({
      tools: { ...tools, [resolvedId]: data },
      toolSeq: id ? toolSeq : toolSeq + 1,
    });
    return resolvedId;
  },

  deleteTool: (id) => {
    const { tools, projects } = get();
    const nextTools = { ...tools };
    delete nextTools[id];
    const nextProjects = Object.fromEntries(
      Object.entries(projects).map(([key, p]) => [
        key,
        {
          ...p,
          sections: p.sections.map((s) => (s.toolId === id ? { ...s, toolId: null } : s)),
        },
      ]),
    );
    set({ tools: nextTools, projects: nextProjects });
  },

  setActiveSection: (projectKey, sectionIndex) => {
    const { projects } = get();
    set({
      activeProjectKey: projectKey,
      activeSectionIndex: clampSectionIndex(projects, projectKey, sectionIndex),
      dismissedMarkerRow: null,
      castOffDismissed: false,
      noteFormOpen: false,
    });
  },

  changeRow: (delta) => {
    const { projects, activeProjectKey, activeSectionIndex, dismissedMarkerRow } = get();
    const section = projects[activeProjectKey].sections[activeSectionIndex];
    const nextRow = Math.min(section.totalRows, Math.max(0, section.row + delta));
    set({
      projects: {
        ...projects,
        [activeProjectKey]: {
          ...projects[activeProjectKey],
          sections: projects[activeProjectKey].sections.map((s, i) =>
            i === activeSectionIndex ? { ...s, row: nextRow } : s,
          ),
        },
      },
      dismissedMarkerRow: nextRow === dismissedMarkerRow ? dismissedMarkerRow : null,
    });
    get().ensureTimerRunning();
  },

  toggleTimer: () => {
    const { timerKey, activeProjectKey, activeSectionIndex } = get();
    const key = `${activeProjectKey}|${activeSectionIndex}`;
    if (timerKey === key) {
      get().stopTimer();
    } else {
      get().stopTimer();
      set({ timerKey: key, timerStartedAt: Date.now() });
    }
  },

  ensureTimerRunning: () => {
    const { timerKey, activeProjectKey, activeSectionIndex } = get();
    const key = `${activeProjectKey}|${activeSectionIndex}`;
    if (timerKey !== key) {
      set({ timerKey: key, timerStartedAt: Date.now() });
    }
  },

  stopTimer: () => {
    const { timerKey, timerStartedAt, projects } = get();
    if (!timerKey || !timerStartedAt) {
      set({ timerKey: null, timerStartedAt: null });
      return;
    }
    const [projectKey, indexStr] = timerKey.split('|');
    const index = Number(indexStr);
    const elapsed = Math.round((Date.now() - timerStartedAt) / 1000);
    set({
      projects: {
        ...projects,
        [projectKey]: {
          ...projects[projectKey],
          sections: projects[projectKey].sections.map((s, i) =>
            i === index ? { ...s, seconds: (s.seconds || 0) + elapsed } : s,
          ),
        },
      },
      timerKey: null,
      timerStartedAt: null,
    });
  },

  confirmMarker: () => {
    const { projects, activeProjectKey, activeSectionIndex } = get();
    const section = projects[activeProjectKey].sections[activeSectionIndex];
    set({ dismissedMarkerRow: section.row });
    get().ensureTimerRunning();
  },

  dismissMarker: () => {
    const { projects, activeProjectKey, activeSectionIndex } = get();
    set({ dismissedMarkerRow: projects[activeProjectKey].sections[activeSectionIndex].row });
  },

  dismissCastOff: () => set({ castOffDismissed: true }),

  confirmCastOff: () => {
    const { projects, activeProjectKey, activeSectionIndex } = get();
    set({
      projects: {
        ...projects,
        [activeProjectKey]: {
          ...projects[activeProjectKey],
          sections: projects[activeProjectKey].sections.map((s, i) =>
            i === activeSectionIndex ? { ...s, complete: true } : s,
          ),
        },
      },
    });
    get().stopTimer();
  },

  openNoteForm: () => set({ noteFormOpen: true }),
  closeNoteForm: () => set({ noteFormOpen: false }),

  saveNote: (row, text) => {
    if (!text.trim()) return;
    const { projects, activeProjectKey, activeSectionIndex, noteSeq } = get();
    set({
      projects: {
        ...projects,
        [activeProjectKey]: {
          ...projects[activeProjectKey],
          sections: projects[activeProjectKey].sections.map((s, i) =>
            i === activeSectionIndex
              ? { ...s, notes: [...s.notes, { id: noteSeq, row, text }] }
              : s,
          ),
        },
      },
      noteSeq: noteSeq + 1,
      noteFormOpen: false,
    });
  },

  toggleFavorite: (patternId) => {
    const { patterns } = get();
    set({
      patterns: {
        ...patterns,
        [patternId]: { ...patterns[patternId], favorited: !patterns[patternId].favorited },
      },
    });
  },
}));
