import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  SEED_MATERIALS,
  SEED_PATTERNS,
  SEED_PROJECTS,
  SEED_TECHNIQUES,
  SEED_TOOLS,
} from '@/data/seed';
import {
  currentSectionIndexOf,
  deriveProjectColors,
  patternSectionMarkers,
  sizeValue,
} from '@/lib/knitwit-helpers';
import { stitchRatio } from '@/lib/gauge';
import { regaugeSectionRows } from '@/lib/regauge';
import type {
  Gauge,
  Material,
  Pattern,
  PatternRow,
  PatternSection,
  Project,
  Technique,
  Tool,
} from '@/types/knitwit';

type KnitwitState = {
  // False until the saved state has been read back off the device. The UI waits on this so it
  // never flashes seed data before the user's real projects load.
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;

  materials: Record<string, Material>;
  tools: Record<string, Tool>;
  patterns: Record<string, Pattern>;
  techniques: Record<string, Technique>;
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
  patternSeq: number;
  techniqueSeq: number;
  projectSeq: number;

  createProject: (draft: {
    name: string;
    started: string;
    patternId: string | null;
    totalRows: number;
    // Which of the pattern's sizes this project is being knitted in.
    sizeIndex?: number;
    // The knitter's swatch gauge. When it differs from the pattern's, the sections below are
    // resolved to it — cast-ons rescaled and shaping redistributed — so the counter works in the
    // knitter's numbers rather than the pattern's.
    swatchGauge?: Gauge | null;
    // Chosen mappings from the pattern's generic material/tool slots to the user's own stash.
    slotMaterials?: Record<string, string>;
    slotTools?: Record<string, string>;
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
  savePattern: (id: string | null, data: Pattern) => string;
  deletePattern: (id: string) => void;
  saveTechnique: (id: string | null, data: Technique) => string;
  deleteTechnique: (id: string) => void;

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

// A pattern section becomes a project section: per-size numbers resolved to the one size, then —
// if the knitter's gauge differs — the chart re-gauged. Both are one-time resolutions, so from
// here on the project holds plain numbers that nothing recomputes.
function resolveSection(
  ps: PatternSection,
  sizeIndex: number,
  ratio: number | null,
): { castOn: number; rows: PatternRow[] } {
  const sized = ps.rows.map((r) => ({
    ...r,
    stitches: r.stitches.map((g) => ({
      ...g,
      count: g.count == null ? null : sizeValue(g.count, sizeIndex),
    })),
  }));
  const castOn = sizeValue(ps.castOn, sizeIndex);
  if (ratio == null) return { castOn, rows: sized };

  // regaugeSectionRows validates its own rebuild and hands back the pattern's rows unchanged if it
  // couldn't stand behind the result — so a project is never stamped from a chart that doesn't
  // reconcile with its own cast-on.
  const out = regaugeSectionRows(sized, castOn, ratio, ps.stitchMultiple);
  return { castOn: out.castOn, rows: out.rows };
}

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
      techniques: SEED_TECHNIQUES,
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
      patternSeq: 8,
      techniqueSeq: 4,
      projectSeq: 1,

      createProject: ({
        name,
        started,
        patternId,
        totalRows,
        sizeIndex = 0,
        swatchGauge = null,
        slotMaterials = {},
        slotTools = {},
      }) => {
        const { projects, patterns, projectSeq, noteSeq } = get();
        const key = `proj${projectSeq}`;
        const pattern = patternId ? (patterns[patternId] ?? null) : null;
        const accent = pattern?.accentColor ?? null;

        // A project stamped from a pattern inherits the pattern's planned sections — their row
        // counts, stitch-marker events and per-row notes — as its countable sections, each reset
        // to zero progress. The pattern only names generic yarn/tool slots; a concrete stash item
        // is banked on a section only when it uses exactly one slot and the user mapped it (see
        // slotMaterials/slotTools). Note ids are re-issued from the store's own sequence so they
        // never collide with notes the user adds later. Improvising (no pattern, or a pattern
        // with no sections) still starts with a single countable section.
        let nextNoteSeq = noteSeq;
        const patternSections = pattern?.sections ?? [];
        // Resolved once, here, rather than recomputed on every render of the counter — the same
        // choice as sizeIndex, and for the same reason: a project on the needles should not shift
        // underneath the knitter.
        const ratio =
          pattern?.gauge && swatchGauge ? stitchRatio(pattern.gauge, swatchGauge) : null;
        const regauged = ratio != null && Math.abs(ratio - 1) > 0.0005 ? ratio : null;
        const sections =
          patternSections.length > 0
            ? patternSections.map((ps) => ({
                name: ps.name,
                totalRows: Math.max(1, sizeValue(ps.totalRows, sizeIndex) || 1),
                row: 0,
                complete: false,
                seconds: 0,
                notes: ps.notes.map((n) => ({ id: nextNoteSeq++, row: n.row, text: n.text })),
                materialId: ps.materials.length === 1 ? (slotMaterials[ps.materials[0]] ?? null) : null,
                toolId: ps.tools.length === 1 ? (slotTools[ps.tools[0]] ?? null) : null,
                // Markers flagged on charted rows count too, not just bare section markers.
                markers: patternSectionMarkers(ps),
                // The chart is copied, not referenced, so later pattern edits leave a project in
                // progress alone. Deep-cloned so editing one never mutates the other, and every
                // per-size number is resolved to the one size this project is being knitted in —
                // from here on the project holds plain numbers.
                ...resolveSection(ps, sizeIndex, regauged),
              }))
            : [
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
                  castOn: 0,
                  rows: [],
                },
              ];

        set({
          projects: {
            ...projects,
            [key]: {
              name: name.trim() || 'Untitled project',
              started: started.trim() || 'Just cast on',
              photo: null,
              ...deriveProjectColors(accent),
              patternId,
              sizeIndex,
              gauge: regauged && pattern?.gauge && swatchGauge
                ? { pattern: pattern.gauge, mine: swatchGauge }
                : null,
              slotMaterials,
              slotTools,
              sections,
            },
          },
          projectSeq: projectSeq + 1,
          noteSeq: nextNoteSeq,
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
                  castOn: 0,
                  rows: [],
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

      savePattern: (id, data) => {
        const { patterns, patternSeq } = get();
        const resolvedId = id ?? `p${patternSeq}`;
        set({
          patterns: { ...patterns, [resolvedId]: data },
          patternSeq: id ? patternSeq : patternSeq + 1,
        });
        return resolvedId;
      },

      deletePattern: (id) => {
        const { patterns, projects } = get();
        const nextPatterns = { ...patterns };
        delete nextPatterns[id];
        // A project pointing at the deleted pattern keeps its own sections/colour, but loses the
        // dangling link so screens don't read a missing pattern.
        const nextProjects = Object.fromEntries(
          Object.entries(projects).map(([key, p]) => [
            key,
            p.patternId === id ? { ...p, patternId: null } : p,
          ]),
        );
        set({ patterns: nextPatterns, projects: nextProjects });
      },

      saveTechnique: (id, data) => {
        const { techniques, techniqueSeq } = get();
        const resolvedId = id ?? `te${techniqueSeq}`;
        set({
          techniques: { ...techniques, [resolvedId]: data },
          techniqueSeq: id ? techniqueSeq : techniqueSeq + 1,
        });
        return resolvedId;
      },

      deleteTechnique: (id) => {
        const { techniques } = get();
        const next = { ...techniques };
        delete next[id];
        set({ techniques: next });
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
      // v17 records the gauge a project was cast on at — see the back-fill in migrate().
      version: 17,
      storage: createJSONStorage(() => AsyncStorage),

      // v1 → v2 added Pattern.sections. v2 → v3 moved patterns off the user's stash: a pattern now
      // carries generic material/tool slots (Pattern.materials/tools) and its sections reference
      // those slot ids (PatternSection.materials/tools) instead of pointing a materialId/toolId
      // straight at a stash item. v3 → v4 added Tool.quantity (how many the user owns). Backfill
      // the new fields (and drop the old per-section pointers) so nothing reads an undefined field.
      migrate: (persisted, version) => {
        // Shared by patterns, materials and a material's per-craft gauges, which all carried the
        // same pair of strings.
        const migrateGauge = (holder: Record<string, unknown>) => {
          if ('gauge' in holder) return;
          const stitches = parseFloat(String(holder.gaugeStitches ?? ''));
          const rows = parseFloat(String(holder.gaugeRows ?? ''));
          const hasStitches = Number.isFinite(stitches) && stitches > 0;
          const hasRows = Number.isFinite(rows) && rows > 0;
          holder.gauge =
            hasStitches || hasRows
              ? {
                  stitches: hasStitches ? stitches : 0,
                  rows: hasRows ? rows : 0,
                  width: 10,
                  height: 10,
                  unit: 'cm',
                }
              : null;
          delete holder.gaugeStitches;
          delete holder.gaugeRows;
        };

        const state = persisted as {
          patterns?: Record<string, Record<string, unknown>>;
          materials?: Record<string, Record<string, unknown>>;
          tools?: Record<string, Record<string, unknown>>;
          projects?: Record<string, Record<string, unknown>>;
        } | undefined;
        if (state?.patterns) {
          for (const pattern of Object.values(state.patterns)) {
            // Run unconditionally, not behind a version gate. That these lists exist is an
            // invariant every screen reads as one — `pattern.techniques.map(…)` with no guard.
            // The original back-fill sat behind `version < 5`, so a pattern that reached a later
            // version still missing one was never repaired, and the detail screen crashed on it.
            // Repairing the shape every time is idempotent and costs nothing.
            for (const key of ['sections', 'materials', 'tools', 'techniques', 'sizes'] as const) {
              if (!Array.isArray(pattern[key])) pattern[key] = [];
            }
            for (const section of pattern.sections as Record<string, unknown>[]) {
              for (const key of ['materials', 'tools', 'techniques', 'notes', 'markers', 'rows'] as const) {
                if (!Array.isArray(section[key])) section[key] = [];
              }
            }
            // v14 → v15: gauge gains a unit. The bare strings always meant "per 10cm" — that was
            // the label printed next to the field — so that is what they become. An empty pair
            // meant "not stated", which is now null rather than a gauge of zero.
            if (version < 15) migrateGauge(pattern);
            // v15 → v16: re-gauging needs the knitter's own swatch alongside the pattern's gauge,
            // and a per-section stitch repeat so a rescaled count still divides.
            if (version < 16) {
              if (!('swatchGauge' in pattern)) pattern.swatchGauge = null;
              for (const section of pattern.sections as Record<string, unknown>[]) {
                if (!('stitchMultiple' in section)) section.stitchMultiple = null;
              }
            }
            if (version < 3) {
              if (!pattern.materials) pattern.materials = [];
              if (!pattern.tools) pattern.tools = [];
              for (const section of pattern.sections as Record<string, unknown>[]) {
                if (!section.materials) section.materials = [];
                if (!section.tools) section.tools = [];
                delete section.materialId;
                delete section.toolId;
              }
            }
            // v4 → v5: patterns gained needleSize + techniques, and material slots dropped swatch.
            if (version < 5) {
              if (typeof pattern.needleSize !== 'string') pattern.needleSize = '';
              if (!pattern.techniques) pattern.techniques = [];
              for (const material of (pattern.materials as Record<string, unknown>[]) ?? []) {
                delete material.swatch;
              }
            }
            // v5 → v6: patterns gained a video link and sections gained a technique reference list.
            if (version < 6) {
              if (typeof pattern.video !== 'string') pattern.video = '';
              for (const section of (pattern.sections as Record<string, unknown>[]) ?? []) {
                if (!section.techniques) section.techniques = [];
              }
            }
            // v6 → v7: patterns can carry the imported source (uploaded file name / pasted text).
            if (version < 7) {
              if (typeof pattern.sourceName !== 'string') pattern.sourceName = '';
              if (typeof pattern.sourceText !== 'string') pattern.sourceText = '';
            }
            // v7 → v8: each pattern section can carry its own raw pattern text.
            if (version < 8) {
              for (const section of (pattern.sections as Record<string, unknown>[]) ?? []) {
                if (typeof section.description !== 'string') section.description = '';
              }
            }
            // v8 → v9: each pattern section gained the structured stitch-by-stitch `rows` array.
            if (version < 9) {
              for (const section of (pattern.sections as Record<string, unknown>[]) ?? []) {
                if (!section.rows) section.rows = [];
              }
            }
            // v9 → v10: each pattern section gained a `castOn` (starting live stitch count).
            if (version < 10) {
              for (const section of (pattern.sections as Record<string, unknown>[]) ?? []) {
                if (typeof section.castOn !== 'number') section.castOn = 0;
              }
            }
          }
        }
        // v14 → v15: materials carry gauge too, both at the top level and per craft.
        if (version < 15 && state?.materials) {
          for (const material of Object.values(state.materials)) {
            migrateGauge(material);
            const crafts = material.crafts as Record<string, Record<string, unknown>> | undefined;
            for (const craft of Object.values(crafts ?? {})) migrateGauge(craft);
          }
        }
        // v16 → v17: a project records the gauge it was cast on at. Existing projects were worked
        // at the pattern's own gauge, which is what null means.
        if (version < 17 && state?.projects) {
          for (const project of Object.values(state.projects)) {
            if (!('gauge' in project)) project.gauge = null;
          }
        }
        // v12 → v13: a project records which size it is being knitted in. Existing projects
        // predate multi-size patterns, so they are all the first size.
        if (version < 13 && state?.projects) {
          for (const project of Object.values(state.projects)) {
            if (typeof project.sizeIndex !== 'number') project.sizeIndex = 0;
          }
        }
        // v10 → v12: project sections carry their own copy of the stitch chart. Projects created
        // before this read the chart live off their pattern, so take that snapshot now rather than
        // leaving them chart-less — sections line up by index, which is how they were stamped.
        // An empty chart counts as "not snapshotted yet", so a store that already reached v11 with
        // blank rows still gets filled; a project that genuinely has its own chart is never
        // overwritten.
        if (version < 12 && state?.projects) {
          for (const project of Object.values(state.projects)) {
            const patternId = project.patternId as string | null | undefined;
            const source = patternId ? state.patterns?.[patternId] : undefined;
            const sourceSections = (source?.sections as Record<string, unknown>[] | undefined) ?? [];
            const sections = (project.sections as Record<string, unknown>[]) ?? [];
            sections.forEach((section, i) => {
              const from = sourceSections[i];
              const fromRows = Array.isArray(from?.rows) ? (from.rows as unknown[]) : [];
              const ownRows = Array.isArray(section.rows) ? (section.rows as unknown[]) : [];
              if (ownRows.length === 0 && fromRows.length > 0) {
                section.rows = fromRows;
                section.castOn = typeof from?.castOn === 'number' ? from.castOn : 0;
              }
              if (!Array.isArray(section.rows)) section.rows = [];
              if (typeof section.castOn !== 'number') section.castOn = 0;
            });
          }
        }
        if (version < 4 && state?.tools) {
          for (const tool of Object.values(state.tools)) {
            if (typeof tool.quantity !== 'number') tool.quantity = 1;
          }
        }
        return state as unknown as KnitwitState;
      },

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
        techniques: state.techniques,
        projects: state.projects,
        activeProjectKey: state.activeProjectKey,
        activeSectionIndex: state.activeSectionIndex,
        noteSeq: state.noteSeq,
        materialSeq: state.materialSeq,
        toolSeq: state.toolSeq,
        patternSeq: state.patternSeq,
        techniqueSeq: state.techniqueSeq,
        projectSeq: state.projectSeq,
      }),

      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
