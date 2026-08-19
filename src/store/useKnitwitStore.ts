import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { SEED_MATERIALS, SEED_PATTERNS, SEED_PROJECTS, SEED_TOOLS } from '@/data/seed';
import { currentSectionIndexOf, deriveProjectColors } from '@/lib/knitwit-helpers';
import type { Material, Pattern, Project, Tool } from '@/types/knitwit';

type KnitwitState = {
  // False until the saved state has been read back off the device. The UI waits on this so it
  // never flashes seed data before the user's real projects load.
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;

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
  projectSeq: number;

  createProject: (draft: {
    name: string;
    started: string;
    patternId: string | null;
    totalRows: number;
  }) => string;
  updateProject: (
    key: string,
    patch: { name: string; started: string; patternId: string | null },
  ) => void;
  deleteProject: (key: string) => void;

  addSection: (projectKey: string, draft: { name: string; totalRows: number }) => void;
  updateSection: (
    projectKey: string,
    index: number,
    patch: { name: string; totalRows: number },
  ) => void;
  deleteSection: (projectKey: string, index: number) => void;

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

export const useKnitwitStore = create<KnitwitState>()(
  persist(
    (set, get) => ({
      hasHydrated: false,
      setHasHydrated: (value) => set({ hasHydrated: value }),

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
      projectSeq: 1,

      createProject: ({ name, started, patternId, totalRows }) => {
        const { projects, patterns, projectSeq } = get();
        const key = `proj${projectSeq}`;
        const accent = patternId ? (patterns[patternId]?.accentColor ?? null) : null;

        // The original seeds one section per pattern section when a pattern is linked. That
        // needs the pattern engine (expansionFor), which is not ported yet, so every project
        // starts with a single countable section regardless — the same shape the original
        // produces when improvising without a pattern.
        set({
          projects: {
            ...projects,
            [key]: {
              name: name.trim() || 'Untitled project',
              started: started.trim() || 'Just cast on',
              photo: null,
              ...deriveProjectColors(accent),
              patternId,
              sections: [
                {
                  name: 'Main',
                  totalRows: Math.max(1, totalRows || 60),
                  row: 0,
                  complete: false,
                  seconds: 0,
                  notes: [],
                  materialId: null,
                  toolId: null,
                  markers: [],
                },
              ],
            },
          },
          projectSeq: projectSeq + 1,
        });
        return key;
      },

      updateProject: (key, { name, started, patternId }) => {
        const { projects, patterns } = get();
        const project = projects[key];
        if (!project) return;
        const accent = patternId ? (patterns[patternId]?.accentColor ?? null) : null;
        set({
          projects: {
            ...projects,
            [key]: {
              ...project,
              name: name.trim() || 'Untitled project',
              started: started.trim() || 'Just cast on',
              patternId,
              // Re-derive rather than keep the old colour: the project is colour-coded by the
              // pattern it is knitting, so relinking has to move the colour with it.
              ...deriveProjectColors(accent),
            },
          },
        });
      },

      deleteProject: (key) => {
        const { projects, activeProjectKey, timerKey } = get();
        // A timer belonging to the deleted project has nowhere to bank its time.
        if (timerKey?.startsWith(`${key}|`)) set({ timerKey: null, timerStartedAt: null });

        const nextProjects = { ...projects };
        delete nextProjects[key];
        const patch: Partial<KnitwitState> = { projects: nextProjects };

        if (activeProjectKey === key) {
          // Counting screens read projects[activeProjectKey]; leaving it dangling would
          // crash them, so move to whatever project remains.
          patch.activeProjectKey = Object.keys(nextProjects)[0] ?? '';
          patch.activeSectionIndex = 0;
        }
        set(patch);
      },

      addSection: (projectKey, { name, totalRows }) => {
        const { projects } = get();
        const project = projects[projectKey];
        if (!project) return;
        set({
          projects: {
            ...projects,
            [projectKey]: {
              ...project,
              sections: [
                ...project.sections,
                {
                  name: name.trim() || `Section ${project.sections.length + 1}`,
                  totalRows: Math.max(1, totalRows || 1),
                  row: 0,
                  complete: false,
                  seconds: 0,
                  notes: [],
                  materialId: null,
                  toolId: null,
                  markers: [],
                },
              ],
            },
          },
        });
      },

      updateSection: (projectKey, index, { name, totalRows }) => {
        const { projects } = get();
        const project = projects[projectKey];
        if (!project?.sections[index]) return;
        const nextTotal = Math.max(1, totalRows || 1);
        set({
          projects: {
            ...projects,
            [projectKey]: {
              ...project,
              sections: project.sections.map((s, i) =>
                i === index
                  ? {
                      ...s,
                      name: name.trim() || s.name,
                      totalRows: nextTotal,
                      // Shrinking a section below the current row would leave the counter
                      // reading "row 40 of 20"; pull the progress back to the new end.
                      row: Math.min(s.row, nextTotal),
                    }
                  : s,
              ),
            },
          },
        });
      },

      deleteSection: (projectKey, index) => {
        const { projects, activeProjectKey, activeSectionIndex, timerKey } = get();
        const project = projects[projectKey];
        // A project with no sections has nothing to count and breaks every screen that
        // reads sections[0], so the last one cannot be removed.
        if (!project || project.sections.length <= 1 || !project.sections[index]) return;

        if (timerKey === `${projectKey}|${index}`) set({ timerKey: null, timerStartedAt: null });

        const nextSections = project.sections.filter((_, i) => i !== index);
        const patch: Partial<KnitwitState> = {
          projects: { ...projects, [projectKey]: { ...project, sections: nextSections } },
        };
        // Indices shift when an earlier section goes; keep the active one pointing at the
        // same section rather than silently sliding to its neighbour.
        if (activeProjectKey === projectKey && activeSectionIndex >= index) {
          patch.activeSectionIndex = Math.max(0, Math.min(activeSectionIndex - 1, nextSections.length - 1));
        }
        set(patch);
      },

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
    }),
    {
      name: 'knitwit-store',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),

      // Only the user's actual data is written to disk. Everything omitted here is transient
      // UI state that should start fresh on each launch.
      //
      // The running timer (timerKey/timerStartedAt) is deliberately NOT persisted. Restoring it
      // would mean an app closed overnight with the timer running silently credits hours of
      // "knitting time" that never happened — corrupting the one number the timer exists to
      // report. Undercounting an interrupted session is the safer failure. Accumulated time
      // already banked into section.seconds does persist.
      partialize: (state) => ({
        materials: state.materials,
        tools: state.tools,
        patterns: state.patterns,
        projects: state.projects,
        activeProjectKey: state.activeProjectKey,
        activeSectionIndex: state.activeSectionIndex,
        noteSeq: state.noteSeq,
        materialSeq: state.materialSeq,
        toolSeq: state.toolSeq,
        projectSeq: state.projectSeq,
      }),

      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
