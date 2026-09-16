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
import { entityId, newProjectSection, SEED_STAMP, stamp } from '@/lib/entity-id';
import {
  currentSectionIndexOf,
  deriveProjectColors,
  parseStartedText,
  patternSectionMarkers,
  sizeValue,
} from '@/lib/knitwit-helpers';
import {
  bandNow,
  emptyAchievements,
  localDate,
  normaliseAchievements,
  recordActivity,
  stitchesForRow,
} from '@/lib/achievements';
import { stitchRatio } from '@/lib/gauge';
import { fetchTechniqueCatalogue } from '@/lib/fetch-technique-catalogue';
import { CATALOGUE_MAX_AGE_MS, matchTechnique } from '@/lib/technique-catalogue';
import { categoryFromName } from '@/lib/project-to-pattern';
import { regaugeSectionRows } from '@/lib/regauge';
import type {
  Achievements,
  Gauge,
  Material,
  Pattern,
  PatternCategory,
  PatternRow,
  PatternSection,
  Project,
  ProjectSection,
  ProjectStatus,
  CatalogueTechnique,
  Technique,
  TechniqueCraft,
  TechniqueStatus,
  Tool,
  UserSettings,
} from '@/types/knitwit';

type KnitwitState = {
  // False until the saved state has been read back off the device. The UI waits on this so it
  // never flashes seed data before the user's real projects load.
  hasHydrated: boolean;
  // Set when the saved data could not be read at all. The app still starts — it has to, or there
  // is no way to reach the rescue — but it starts empty, and this is what tells the difference
  // between "no work yet" and "your work is here and we cannot see it".
  hydrationError: string | null;
  setHasHydrated: (value: boolean) => void;

  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void;

  achievements: Achievements;
  setProjectStatus: (key: string, status: ProjectStatus) => void;

  materials: Record<string, Material>;
  tools: Record<string, Tool>;
  patterns: Record<string, Pattern>;
  // What the knitter has said about each technique, keyed by the catalogue's slug — or by a
  // generated id for one they added themselves.
  techniques: Record<string, Technique>;
  // The shared catalogue, cached so the Techniques tab works offline after the first load.
  catalogue: Record<string, CatalogueTechnique>;
  catalogueFetchedAt: number | null;
  catalogueError: string | null;
  loadCatalogue: (force?: boolean) => Promise<void>;
  projects: Record<string, Project>;

  activeProjectKey: string;
  activeSectionIndex: number;
  // Sections worked on, most recent first, as "projectKey|sectionIndex". activeProjectKey alone
  // can't answer "where was I before this?", which is what Home needs when the last thing worked
  // on has since been frogged or finished.
  recentSections: string[];

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
    startedOn: string | null;
    craft: TechniqueCraft;
    patternId: string | null;
    totalRows: number;
    // Chosen in the wizard. Omitted, it's read off the name — the same guess, made a moment later.
    category?: PatternCategory;
    // Free-text groupings, chosen in the wizard or added later.
    labels?: string[];
    // Which of the pattern's sizes this project is being knitted in.
    sizeIndex?: number;
    // The knitter's swatch gauge. When it differs from the pattern's, the sections below are
    // resolved to it — cast-ons rescaled and shaping redistributed — so the counter works in the
    // knitter's numbers rather than the pattern's.
    swatchGauge?: Gauge | null;
    // Chosen mappings from the pattern's generic material/tool slots to the user's own stash.
    slotMaterials?: Record<string, string>;
    slotTools?: Record<string, string>;
    // Sections planned in the wizard when improvising. Ignored when a pattern supplies its own —
    // a pattern's sections are the thing being knitted, and inventing extras alongside them would
    // give the project two sources of truth. `totalRows` above is the fallback for neither.
    sections?: ({ name: string; totalRows: number; description?: string } & Partial<SectionKit>)[];
  }) => string;
  updateProject: (
    key: string,
    patch: {
      name: string;
      startedOn: string | null;
      craft: TechniqueCraft;
      patternId: string | null;
      photo?: string | null;
      labels?: string[];
    } & Partial<ProjectMeta>,
  ) => void;
  deleteProject: (key: string) => void;

  addSection: (
    projectKey: string,
    draft: { name: string; totalRows: number } & Partial<SectionKit>,
  ) => void;
  updateSection: (
    projectKey: string,
    index: number,
    patch: { name: string; totalRows: number },
  ) => void;
  // What this section is worked with, out of the knitter's own stash. Separate from updateSection
  // because it's a different gesture: name and rows are typed into a form and saved, this is
  // toggled on and off and takes effect there and then.
  setSectionKit: (projectKey: string, index: number, patch: Partial<SectionKit>) => void;
  // Free-text notes, saved as they're typed. No Save button: a notes box that can lose what you
  // wrote by navigating away is worse than no notes box.
  setProjectNotes: (projectKey: string, notes: string) => void;
  setSectionNotes: (projectKey: string, index: number, notes: string) => void;
  setPatternNotes: (patternId: string, notes: string) => void;
  setPatternSectionNotes: (patternId: string, index: number, notes: string) => void;
  // The written instructions and the chart read from them. Its own action because the stitch
  // editor owns all three together and hands them back as a set.
  setSectionStitches: (
    projectKey: string,
    index: number,
    draft: { description: string; castOn: number; rows: PatternRow[] },
  ) => void;
  deleteSection: (projectKey: string, index: number) => void;

  saveMaterial: (id: string | null, data: Material) => string;
  deleteMaterial: (id: string) => void;
  saveTool: (id: string | null, data: Tool) => string;
  deleteTool: (id: string) => void;
  savePattern: (id: string | null, data: Pattern) => string;
  savePatternFromProject: (projectKey: string, data: Pattern) => string;
  deletePattern: (id: string) => void;
  // A technique is picked from the catalogue and given a status, not written from scratch.
  setTechniqueStatus: (id: string, status: TechniqueStatus | null) => void;
  setTechniqueNotes: (id: string, notes: string) => void;
  // The escape hatch: something the catalogue doesn't have. Never matched from a pattern.
  addCustomTechnique: (name: string, craft: TechniqueCraft) => string;
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

// Counted the moment the last row of the last section lands. Recorded rather than derived, so it
// survives the project being deleted or the pattern being changed afterwards — and counted once,
// because the guard in changeRow only fires on the transition.
function recordFinish(a: Achievements, project: Project, pattern: Pattern | null): Achievements {
  const patternId = project.patternId;
  const category = pattern?.category;
  return {
    ...a,
    totals: { ...a.totals, projectsFinished: a.totals.projectsFinished + 1 },
    finishedByPattern: patternId
      ? { ...a.finishedByPattern, [patternId]: (a.finishedByPattern[patternId] ?? 0) + 1 }
      : a.finishedByPattern,
    finishedByCategory: category
      ? { ...a.finishedByCategory, [category]: (a.finishedByCategory[category] ?? 0) + 1 }
      : a.finishedByCategory,
    finishedByCraft: pattern
      ? { ...a.finishedByCraft, [pattern.craft]: (a.finishedByCraft[pattern.craft] ?? 0) + 1 }
      : a.finishedByCraft,
  };
}

function bumpTotal(a: Achievements, key: keyof Achievements['totals']): Achievements {
  return { ...a, totals: { ...a.totals, [key]: a.totals[key] + 1 } };
}

// Most recent first, no duplicates, capped — this is a "where was I" trail, not a history.
function withRecent(recent: string[], projectKey: string, sectionIndex: number): string[] {
  const entry = `${projectKey}|${sectionIndex}`;
  return [entry, ...recent.filter((r) => r !== entry)].slice(0, 12);
}

// Everything a project records about itself that a pattern also records. Grouped because the
// edit screen offers them as a block and updateProject takes them as one.
type ProjectMeta = Pick<
  Project,
  'category' | 'level' | 'needleSize' | 'video' | 'sourceName' | 'sourceText'
>;

// The three lists a project section carries: what it is worked with, as ids into the knitter's
// own stash. Named as a set because every screen that offers one offers all three.
type SectionKit = Pick<ProjectSection, 'materialIds' | 'toolIds' | 'techniqueIds'>;

// Ids that still exist in the stash, de-duplicated, in the order given.
function keepKnown(ids: string[], stash: Record<string, unknown>): string[] {
  return [...new Set(ids)].filter((id) => id in stash);
}

// A project section's yarn/tool/technique lists, repaired in place.
//
// Shape-driven, not version-gated, and called from `merge` rather than `migrate` — which is the
// whole point. `migrate` only runs when the stored version differs from the current one, so a
// back-fill living inside it is gated by exactly the thing it exists to escape: bump the version
// in one commit and add the back-fill in the next, and it can never run again. `merge` runs on
// every hydration, so the invariant "these three are arrays" holds however the store got here.
//
// The conversion itself recovers data as well as widening it. A project stamped from a pattern
// only ever banked a stash item when the pattern section named exactly one slot, so a two-colour
// yoke resolved to no yarn at all. Where the pattern is still around, its slots are re-resolved
// through the project's own mappings; sections match by name, since they're stamped in order but
// renamed afterwards.
// The `notes` → `rowNotes` rename, repaired in place on one section — a project's or a pattern's.
//
// Rescue before coercing, not after. Blanking `notes` to a string first and then looking for the
// array in it destroys every row-pinned note in the section — which is exactly what the first
// version of this did.
// Sections predate having an identity, so every stored one needs a new one before anything can
// reconcile it. Random, not derived from position: two devices doing this backfill independently
// must not both decide the third section is `psec_3` and then disagree about which sleeve that is.
//
// The consequence is worth naming. A knitter who used Knitwit on a laptop and a phone *before*
// accounts existed has two unrelated sets of ids for what they think of as the same project, and
// no backfill can know that. Those will sync as duplicates, and the answer is to pick one device
// as the source of truth the first time they sign in — not to guess here.
function repairSectionIdentity(section: Record<string, unknown>, prefix: string): void {
  if (typeof section.id !== 'string' || !section.id) section.id = entityId(prefix);
  // Old enough to lose to any real edit, since we cannot know when it actually changed.
  if (typeof section.updatedAt !== 'string' || !section.updatedAt) section.updatedAt = SEED_STAMP;
}

function repairSectionNotes(section: Record<string, unknown>): void {
  if (typeof section.description !== 'string') section.description = '';
  if (!('stitchMultiple' in section)) section.stitchMultiple = null;
  if (!Array.isArray(section.rowNotes) && Array.isArray(section.notes)) {
    section.rowNotes = section.notes;
    section.notes = '';
  }
  if (!Array.isArray(section.rowNotes)) section.rowNotes = [];
  if (typeof section.notes !== 'string') section.notes = '';
}

function repairSectionKits(state: {
  projects?: Record<string, Record<string, unknown>>;
  patterns?: Record<string, Record<string, unknown>>;
}): void {
  for (const project of Object.values(state.projects ?? {})) {
    const patternId = project.patternId as string | null | undefined;
    const source = patternId ? state.patterns?.[patternId] : undefined;

    // A project now records what a pattern records. Seeded from the pattern it was made from,
    // since that is where the true answer already is; improvised projects get a reading of their
    // own name and sensible blanks, which is exactly what the conversion screen used to guess.
    if (typeof project.category !== 'string') {
      project.category = (source?.category as string | undefined) ?? categoryFromName(String(project.name ?? ''));
    }
    if (typeof project.level !== 'string') {
      project.level = (source?.level as string | undefined) ?? 'intermediate';
    }
    if (typeof project.needleSize !== 'string') {
      project.needleSize = (source?.needleSize as string | undefined) ?? '';
    }
    for (const [key, from] of [
      ['video', 'video'],
      ['sourceName', 'sourceName'],
      ['sourceText', 'sourceText'],
    ] as const) {
      if (typeof project[key] !== 'string') {
        project[key] = (source?.[from] as string | undefined) ?? '';
      }
    }
    const sourceSections = (source?.sections as Record<string, unknown>[] | undefined) ?? [];
    const slotMaterials = (project.slotMaterials ?? {}) as Record<string, string>;
    const slotTools = (project.slotTools ?? {}) as Record<string, string>;

    // Fields a project section gained once it could hold everything a pattern section holds.
    // Shape-driven like the rest: absent means "predates this", not "version N".
    if (typeof project.notes !== 'string') project.notes = (source?.notes as string | undefined) ?? '';
    if (!Array.isArray(project.labels)) project.labels = [];

    for (const section of (project.sections as Record<string, unknown>[]) ?? []) {
      repairSectionIdentity(section, 'psec');
      repairSectionNotes(section);
    }

    for (const section of (project.sections as Record<string, unknown>[]) ?? []) {
      if (Array.isArray(section.materialIds) && Array.isArray(section.toolIds)) {
        if (!Array.isArray(section.techniqueIds)) section.techniqueIds = [];
        continue;
      }

      const from = sourceSections.find((ps) => ps.name === section.name);
      const viaPattern = (slots: unknown, map: Record<string, string>) =>
        (Array.isArray(slots) ? (slots as string[]) : []).map((slot) => map[slot]).filter(Boolean);

      const materials = viaPattern(from?.materials, slotMaterials);
      const tools = viaPattern(from?.tools, slotTools);
      const ownMaterial = section.materialId as string | null | undefined;
      const ownTool = section.toolId as string | null | undefined;

      // The pattern's mapping wins when it resolves to anything, since it can only be richer than
      // the single id that was kept; otherwise carry that single id across.
      section.materialIds = materials.length ? materials : ownMaterial ? [ownMaterial] : [];
      section.toolIds = tools.length ? tools : ownTool ? [ownTool] : [];
      if (!Array.isArray(section.techniqueIds)) section.techniqueIds = [];
      delete section.materialId;
      delete section.toolId;
    }
  }

  // Patterns gained the same fields at the same time and were being left out — which broke the
  // one thing every pattern exists for. `createProject` reads `ps.rowNotes` and `ps.notes`
  // straight off each pattern section, so a pattern stored before the rename crashed the wizard
  // on "Save project" rather than starting the project.
  //
  // This repair used to live in `migrate`, under a comment claiming it ran unconditionally. It
  // did not: `migrate` only runs when the stored version differs from the current one, so a store
  // already at the current version never saw it and every pattern in it stayed broken. That these
  // lists exist is an invariant every screen reads as one — `pattern.techniques.map(…)` with no
  // guard — so it belongs here, where it runs on every hydration. Idempotent, and costs nothing.
  for (const pattern of Object.values(state.patterns ?? {})) {
    for (const key of ['sections', 'materials', 'tools', 'techniques', 'sizes'] as const) {
      if (!Array.isArray(pattern[key])) pattern[key] = [];
    }
    if (typeof pattern.notes !== 'string') pattern.notes = '';
    for (const section of pattern.sections as Record<string, unknown>[]) {
      repairSectionIdentity(section, 'sec');
      repairSectionNotes(section);
      for (const key of ['materials', 'tools', 'techniques', 'markers', 'rows'] as const) {
        if (!Array.isArray(section[key])) section[key] = [];
      }
    }
  }
}

// A technique used to be whatever the knitter typed: { name, craft, notes, link }. It is now a
// reference to the shared catalogue plus what they know about it.
//
// The two can't be matched here, because the catalogue lives in Supabase and hydration is
// synchronous and offline. So every old record becomes a custom one — theirs, intact, visible —
// and reconcileTechniques moves the ones that have a catalogue entry across when it loads.
//
// Status is 'known': the old library was "techniques I've noted down", and someone who wrote a
// technique down is far more likely to have done it than to be wishing for it.
function repairTechniques(state: { techniques?: Record<string, Record<string, unknown>> }): void {
  for (const [id, t] of Object.entries(state.techniques ?? {})) {
    if (typeof t?.status === 'string') continue;
    const name = typeof t?.name === 'string' ? t.name : '';
    const craft = t?.craft === 'crochet' || t?.craft === 'both' ? t.craft : 'knit';
    state.techniques![id] = {
      status: 'known',
      notes: typeof t?.notes === 'string' ? t.notes : '',
      addedOn: localDate(),
      ...(name ? { custom: { name, craft } } : {}),
    };
  }
}

// Moves a hand-written technique onto its catalogue entry once the catalogue is available.
//
// Everything the knitter said about it — status, notes, when they added it — comes across, and
// the catalogue entry supplies the name, craft, summary and video it never had. Anything with no
// match stays exactly as it is: a technique the catalogue doesn't know is still theirs.
function reconcileTechniques(
  mine: Record<string, Technique>,
  catalogue: CatalogueTechnique[],
): Record<string, Technique> {
  const next: Record<string, Technique> = {};
  let changed = false;

  for (const [id, t] of Object.entries(mine)) {
    const matched = t.custom ? matchTechnique(t.custom.name, catalogue) : null;
    if (!matched || next[matched.id] || mine[matched.id]) {
      // No match, or the knitter already has the catalogue entry — leave it where it is rather
      // than merging two records and losing one set of notes.
      next[id] = t;
      continue;
    }
    const { custom: _custom, ...rest } = t;
    next[matched.id] = rest;
    changed = true;
  }
  return changed ? next : mine;
}

// Marks a section as changed just now.
//
// Every write goes through this rather than setting updatedAt at each call site, because the one
// that forgets is invisible: the section still saves, still looks right, and simply never wins a
// reconciliation again. A stale timestamp is a silent bug, so there is one place to get it right.
function touched<T extends { updatedAt: string }>(section: T): T {
  return { ...section, updatedAt: stamp() };
}

// Rewrites one section of one project, leaving everything else identical. Returns an empty patch
// for a section that isn't there, so a stale route parameter is a no-op rather than a crash.
function patchSection(
  state: KnitwitState,
  projectKey: string,
  index: number,
  change: (section: ProjectSection) => ProjectSection,
): Partial<KnitwitState> {
  const project = state.projects[projectKey];
  if (!project?.sections[index]) return {};
  return {
    projects: {
      ...state.projects,
      [projectKey]: {
        ...project,
        sections: project.sections.map((s, i) => (i === index ? touched(change(s)) : s)),
      },
    },
  };
}

function clampSectionIndex(projects: Record<string, Project>, projectKey: string, index: number) {
  const n = projects[projectKey]?.sections.length ?? 0;
  if (!n) return 0;
  if (index < 0 || index >= n) return 0;
  return index;
}

// What happens when the persisted store has been read — or could not be.
//
// Both arguments matter, and the second one used to be dropped. `state` is undefined when hydration
// threw: corrupt storage, or a repair meeting a shape it did not expect. The old line was
// `state?.setHasHydrated(true)`, so on that path nothing was set, `ready` in the root layout stayed
// false, and the app sat on its loading screen for ever. The knitter's work was still on the disk,
// whole; nothing said so, and the obvious thing to try next — clear the site data and reload — is
// the one action that destroys it.
//
// So the flag is always set, written straight to the store rather than through a state that may not
// exist, and the failure is kept for the screen that has to explain it.
//
// Exported because this is the branch that matters and the one hardest to reach through the
// storage layer in a test.
export function finishHydration(state: KnitwitState | undefined, error?: unknown): void {
  if (error) {
    // Hydration always fails during the server render — there is no `window` there, so no
    // localStorage to read. That is normal and was harmless while this branch did nothing; writing
    // state here is not, because persisting it reaches for the same missing localStorage and throws
    // again, this time out of the render. Nothing on the server has data to lose or a knitter to
    // tell, so leave it exactly as it was: unhydrated, rendering nothing, waiting for the client.
    if (typeof window === 'undefined') return;

    console.error('knitwit: could not read saved data', error);
    useKnitwitStore.setState({
      hasHydrated: true,
      hydrationError: error instanceof Error ? error.message : String(error),
    });
    return;
  }
  state?.setHasHydrated(true);
}

export const useKnitwitStore = create<KnitwitState>()(
  persist(
    (set, get) => ({
      hasHydrated: false,
      hydrationError: null,
      setHasHydrated: (value) => set({ hasHydrated: value }),

      // Metric by default: the app's own defaults, the seed data and the reference mockup are all
      // written per 10cm.
      settings: { gaugeUnit: 'cm' },
      updateSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),

      achievements: emptyAchievements(),

      setProjectStatus: (key, status) => {
        const { projects, achievements } = get();
        const project = projects[key];
        if (!project || project.status === status) return;
        set({
          projects: { ...projects, [key]: { ...project, status } },
          // Lifetime and one-way: unfrogging later doesn't take the badge back, because the
          // knitter did in fact rip it out.
          achievements:
            status === 'frogged'
              ? {
                  ...achievements,
                  totals: {
                    ...achievements.totals,
                    projectsFrogged: achievements.totals.projectsFrogged + 1,
                  },
                }
              : achievements,
        });
      },

      materials: SEED_MATERIALS,
      tools: SEED_TOOLS,
      patterns: SEED_PATTERNS,
      techniques: SEED_TECHNIQUES,
      catalogue: {},
      catalogueFetchedAt: null,
      catalogueError: null,
      projects: SEED_PROJECTS,

      activeProjectKey: 'meadow',
      activeSectionIndex: currentSectionIndexOf(SEED_PROJECTS.meadow),
      recentSections: [],

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
        startedOn,
        craft,
        patternId,
        totalRows,
        sizeIndex = 0,
        swatchGauge = null,
        slotMaterials = {},
        slotTools = {},
        sections: planned = [],
        category,
        labels = [],
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
        const blank = (over: Partial<ProjectSection> & { name: string; totalRows: number }) =>
          newProjectSection({
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
          ...over,
        });

        const sections =
          patternSections.length > 0
            ? patternSections.map((ps) =>
                newProjectSection({
                name: ps.name,
                totalRows: Math.max(1, sizeValue(ps.totalRows, sizeIndex) || 1),
                row: 0,
                complete: false,
                seconds: 0,
                rowNotes: ps.rowNotes.map((n) => ({ id: nextNoteSeq++, row: n.row, text: n.text })),
                notes: ps.notes,
                materialIds: ps.materials.map((slot) => slotMaterials[slot]).filter(Boolean),
                toolIds: ps.tools.map((slot) => slotTools[slot]).filter(Boolean),
                // A pattern names its techniques inline rather than pointing at the knitter's
                // library, so there is nothing to resolve them to. Left for the knitter to set.
                techniqueIds: [],
                description: ps.description,
                stitchMultiple: ps.stitchMultiple,
                // Markers flagged on charted rows count too, not just bare section markers.
                markers: patternSectionMarkers(ps),
                // The chart is copied, not referenced, so later pattern edits leave a project in
                // progress alone. Deep-cloned so editing one never mutates the other, and every
                // per-size number is resolved to the one size this project is being knitted in —
                // from here on the project holds plain numbers.
                ...resolveSection(ps, sizeIndex, regauged),
              }),
              )
            : planned.length > 0
              ? planned.map((p, i) =>
                  blank({
                    ...p,
                    name: p.name.trim() || `Section ${i + 1}`,
                    totalRows: Math.max(1, p.totalRows || 1),
                  }),
                )
              : // Every project needs something to count — screens read sections[0], and the last
                // section can't be deleted for the same reason. So there is always one.
                [blank({ name: 'Main', totalRows: Math.max(1, totalRows || 60) })];

        set({
          projects: {
            ...projects,
            [key]: {
              name: name.trim() || 'Untitled project',
              startedOn,
              craft,
              photo: null,
              ...deriveProjectColors(accent),
              // Copied off the pattern where there is one, so a project made from a sweater
              // pattern is a sweater. Improvised, it reads its own name and leaves the rest blank
              // for the knitter to fill in — the same reading the conversion screen used to do,
              // moved to the moment the project is created.
              category: category ?? pattern?.category ?? categoryFromName(name),
              level: pattern?.level ?? 'intermediate',
              needleSize: pattern?.needleSize ?? '',
              video: pattern?.video ?? '',
              sourceName: pattern?.sourceName ?? '',
              sourceText: pattern?.sourceText ?? '',
              // The pattern's notes come across as the project's own starting point. Editing them
              // on the project never touches the pattern — a project is a copy, not a view.
              notes: pattern?.notes ?? '',
              labels,
              patternId,
              sizeIndex,
              status: 'active',
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

      updateProject: (key, { name, startedOn, craft, patternId, photo, labels, ...meta }) => {
        const { projects, patterns } = get();
        const project = projects[key];
        if (!project) return;
        const accent = patternId ? (patterns[patternId]?.accentColor ?? null) : null;
        set({
          projects: {
            ...projects,
            [key]: {
              ...project,
              // Spread first so the named fields below always win over a stale meta key.
              ...meta,
              name: name.trim() || 'Untitled project',
              startedOn,
              craft,
              patternId,
              // Undefined means the caller isn't touching the photo; null means remove it.
              photo: photo === undefined ? project.photo : photo,
              labels: labels ?? project.labels,
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
        const patch: Partial<KnitwitState> = {
          projects: nextProjects,
          // The "where was I" trail would otherwise keep pointing at a project that no longer
          // exists. Home copes with that, but leaving it would let the trail fill with ghosts.
          recentSections: (get().recentSections ?? []).filter((r) => !r.startsWith(`${key}|`)),
        };

        if (activeProjectKey === key) {
          // Counting screens read projects[activeProjectKey]; leaving it dangling would
          // crash them, so move to whatever project remains.
          patch.activeProjectKey = Object.keys(nextProjects)[0] ?? '';
          patch.activeSectionIndex = 0;
        }
        set(patch);
      },

      addSection: (projectKey, { name, totalRows, materialIds = [], toolIds = [], techniqueIds = [] }) => {
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
                newProjectSection({
                  name: name.trim() || `Section ${project.sections.length + 1}`,
                  totalRows: Math.max(1, totalRows || 1),
                  row: 0,
                  complete: false,
                  seconds: 0,
                  rowNotes: [],
                  notes: '',
                  materialIds,
                  toolIds,
                  techniqueIds,
                  description: '',
                  stitchMultiple: null,
                  markers: [],
                  castOn: 0,
                  rows: [],
                }),
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

      // Both go through the same patch, since the only difference is which field moves. An id that
      // isn't in the stash is refused rather than stored: a section pointing at a yarn that doesn't
      // exist reads as "no material" everywhere anyway, so storing it would just be a lie the
      // screens can't see.
      // Ids that aren't in the stash are dropped rather than stored: a section pointing at a yarn
      // that doesn't exist renders as nothing everywhere anyway, so keeping it would be a lie the
      // screens can't see. An omitted list is left alone, so toggling a yarn never touches tools.
      setSectionKit: (projectKey, index, patch) => {
        const { materials, tools, techniques } = get();
        set(
          patchSection(get(), projectKey, index, (s) => ({
            ...s,
            materialIds: patch.materialIds ? keepKnown(patch.materialIds, materials) : s.materialIds,
            toolIds: patch.toolIds ? keepKnown(patch.toolIds, tools) : s.toolIds,
            techniqueIds: patch.techniqueIds
              ? keepKnown(patch.techniqueIds, techniques)
              : s.techniqueIds,
          })),
        );
      },

      setSectionStitches: (projectKey, index, { description, castOn, rows }) =>
        set(
          patchSection(get(), projectKey, index, (s) => ({
            ...s,
            description,
            castOn: Math.max(0, Math.round(castOn) || 0),
            rows,
          })),
        ),

      setProjectNotes: (projectKey, notes) => {
        const { projects } = get();
        const project = projects[projectKey];
        if (!project) return;
        set({ projects: { ...projects, [projectKey]: { ...project, notes } } });
      },

      setSectionNotes: (projectKey, index, notes) =>
        set(patchSection(get(), projectKey, index, (s) => ({ ...s, notes }))),

      setPatternNotes: (patternId, notes) => {
        const { patterns } = get();
        const pattern = patterns[patternId];
        if (!pattern) return;
        set({ patterns: { ...patterns, [patternId]: { ...pattern, notes } } });
      },

      setPatternSectionNotes: (patternId, index, notes) => {
        const { patterns } = get();
        const pattern = patterns[patternId];
        if (!pattern?.sections[index]) return;
        set({
          patterns: {
            ...patterns,
            [patternId]: {
              ...pattern,
              sections: pattern.sections.map((s, i) => (i === index ? touched({ ...s, notes }) : s)),
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
                s.materialIds.includes(id)
                  ? touched({ ...s, materialIds: s.materialIds.filter((m) => m !== id) })
                  : s,
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
              sections: p.sections.map((s) =>
                s.toolIds.includes(id) ? touched({ ...s, toolIds: s.toolIds.filter((t) => t !== id) }) : s,
              ),
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
          // Only a new pattern counts; editing one you already had isn't making another.
          achievements: id ? get().achievements : bumpTotal(get().achievements, 'patternsCreated'),
        });
        return resolvedId;
      },

      // Writing a pattern out of a project and linking the two is one action, not two: a pattern
      // saved but not linked leaves the knitter looking at a project that still says "No pattern
      // linked" next to a library card that came from it.
      //
      // Deliberately not routed through updateProject, which re-derives the project's colours from
      // the pattern it links to. Here the pattern took its accent from the project, so re-deriving
      // would repaint the project from its own colour and shift it a shade darker.
      savePatternFromProject: (projectKey, data) => {
        const id = get().savePattern(null, data);
        const { projects } = get();
        const project = projects[projectKey];
        if (project) {
          set({ projects: { ...projects, [projectKey]: { ...project, patternId: id } } });
        }
        return id;
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

      loadCatalogue: async (force = false) => {
        const { catalogueFetchedAt, catalogue } = get();
        const fresh =
          catalogueFetchedAt !== null && Date.now() - catalogueFetchedAt < CATALOGUE_MAX_AGE_MS;
        if (!force && fresh && Object.keys(catalogue).length > 0) return;

        try {
          const rows = await fetchTechniqueCatalogue();
          // An empty response is a failure dressed as a success — a dropped connection, a policy
          // change. Keeping the cache beats blanking the knitter's library over it.
          if (rows.length === 0 && Object.keys(catalogue).length > 0) return;
          set({
            catalogue: Object.fromEntries(rows.map((t: CatalogueTechnique) => [t.id, t])),
            catalogueFetchedAt: Date.now(),
            catalogueError: null,
            // Techniques written by hand before the catalogue existed are matched to it here
            // rather than at hydration, because at hydration there is nothing to match against.
            techniques: reconcileTechniques(get().techniques, rows),
          });
        } catch (error) {
          // The cache carries on serving. The message is only shown when there is nothing cached.
          set({ catalogueError: error instanceof Error ? error.message : 'Could not load techniques.' });
        }
      },

      setTechniqueStatus: (id, status) => {
        const { techniques, achievements } = get();
        if (status === null) {
          const next = { ...techniques };
          delete next[id];
          set({ techniques: next });
          return;
        }
        const existing = techniques[id];
        set({
          techniques: {
            ...techniques,
            [id]: {
              status,
              notes: existing?.notes ?? '',
              addedOn: existing?.addedOn ?? localDate(),
              ...(existing?.custom ? { custom: existing.custom } : {}),
            },
          },
          // Counted when a technique is first learnt rather than when a record is created —
          // creating one isn't a thing you do any more. Only on the transition, so toggling
          // between Learning and Mastered doesn't inflate it.
          achievements:
            status === 'known' && existing?.status !== 'known'
              ? bumpTotal(achievements, 'techniquesAdded')
              : achievements,
        });
      },

      setTechniqueNotes: (id, notes) => {
        const { techniques } = get();
        const existing = techniques[id];
        if (!existing) return;
        set({ techniques: { ...techniques, [id]: { ...existing, notes } } });
      },

      addCustomTechnique: (name, craft) => {
        const { techniques, techniqueSeq } = get();
        const resolvedId = `own-${techniqueSeq}`;
        set({
          techniques: {
            ...techniques,
            [resolvedId]: {
              status: 'want',
              notes: '',
              addedOn: localDate(),
              custom: { name: name.trim() || 'Untitled technique', craft },
            },
          },
          techniqueSeq: techniqueSeq + 1,
        });
        return resolvedId;
      },

      deleteTechnique: (id) => {
        const { techniques, projects } = get();
        const next = { ...techniques };
        delete next[id];
        // Sections referencing it have to let go too, the same way they do for a deleted yarn or
        // tool. Techniques never needed this before, because a project couldn't reference one.
        set({
          techniques: next,
          projects: Object.fromEntries(
            Object.entries(projects).map(([key, p]) => [
              key,
              {
                ...p,
                sections: p.sections.map((s) =>
                  s.techniqueIds.includes(id)
                    ? touched({ ...s, techniqueIds: s.techniqueIds.filter((t) => t !== id) })
                    : s,
                ),
              },
            ]),
          ),
        });
      },

      setActiveSection: (projectKey, sectionIndex) => {
        const { projects, recentSections } = get();
        const index = clampSectionIndex(projects, projectKey, sectionIndex);
        set({
          activeProjectKey: projectKey,
          activeSectionIndex: index,
          recentSections: withRecent(recentSections ?? [], projectKey, index),
          dismissedMarkerRow: null,
          castOffDismissed: false,
          noteFormOpen: false,
        });
      },

      changeRow: (delta) => {
        const {
          projects,
          activeProjectKey,
          activeSectionIndex,
          dismissedMarkerRow,
          castOffDismissed,
          achievements,
        } = get();
        const project = projects[activeProjectKey];
        const section = project.sections[activeSectionIndex];
        // Saying "not yet" to binding off means the knitter isn't done — so counting on from the
        // last row grows the section rather than stopping dead at a planned total that turned out
        // to be short. Working to a measurement routinely needs more rows than the pattern says.
        const extending = castOffDismissed && delta > 0 && section.row >= section.totalRows;
        const totalRows = extending ? section.totalRows + delta : section.totalRows;
        const nextRow = Math.min(totalRows, Math.max(0, section.row + delta));

        // Ripping back below the end un-finishes the section. `complete` and `row` disagreeing is
        // what let a counter sitting on row 15 of 16 announce itself as finished.
        const complete = nextRow >= totalRows ? section.complete : false;

        // Only forward counts. Tapping back doesn't subtract — the row was knitted — and doesn't
        // add either. Each newly reached row is worth the stitches it actually contains.
        let earned = achievements;
        for (let row = section.row + 1; row <= nextRow; row++) {
          earned = recordActivity(
            earned,
            { rows: 1, stitches: stitchesForRow(section, row) },
            localDate(),
            bandNow(),
          );
        }

        set({
          projects: {
            ...projects,
            [activeProjectKey]: {
              ...project,
              sections: project.sections.map((s, i) =>
                i === activeSectionIndex ? touched({ ...s, row: nextRow, totalRows, complete }) : s,
              ),
            },
          },
          achievements: earned,
          recentSections: withRecent(get().recentSections ?? [], activeProjectKey, activeSectionIndex),
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
          achievements: recordActivity(get().achievements, { seconds: elapsed }),
          projects: {
            ...projects,
            [projectKey]: {
              ...projects[projectKey],
              sections: projects[projectKey].sections.map((s, i) =>
                i === index ? touched({ ...s, seconds: (s.seconds || 0) + elapsed }) : s,
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
        const { projects, patterns, activeProjectKey, activeSectionIndex, achievements } = get();
        const project = projects[activeProjectKey];
        const sections = project.sections.map((s, i) =>
          i === activeSectionIndex ? touched({ ...s, complete: true }) : s,
        );
        // A finish is recorded here rather than when the last row is counted. Binding off is
        // deliberate and happens once; counting the last row fired again every time the knitter
        // tapped back over it and forward again, which inflated the finished count.
        const finishing = sections.every((s) => s.complete);
        set({
          projects: { ...projects, [activeProjectKey]: { ...project, sections } },
          achievements: finishing
            ? recordFinish(achievements, project, project.patternId ? patterns[project.patternId] : null)
            : achievements,
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
                  ? touched({ ...s, rowNotes: [...s.rowNotes, { id: noteSeq, row, text }] })
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
      // v24 turns a project section's single yarn and single tool into lists, and adds techniques.
      version: 24,
      storage: createJSONStorage(() => AsyncStorage),

      // Runs on every hydration, unlike migrate, which zustand skips whenever the stored version
      // already matches the current one. Shape invariants belong here: a repair that only runs on
      // a version change is one bump away from never running again.
      merge: (persisted, current) => {
        const state = (persisted ?? {}) as Partial<KnitwitState> & Record<string, unknown>;
        repairSectionKits(state as Parameters<typeof repairSectionKits>[0]);
        // Same reasoning — a field added to Achievements after this store shipped is filled in
        // here rather than by a migration nobody will re-run.
        state.achievements = normaliseAchievements(state.achievements);
        repairTechniques(state as { techniques?: Record<string, Record<string, unknown>> });
        return { ...current, ...state };
      },

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
            // The shape back-fill that used to sit here now lives in `merge` — see the note
            // there. What remains is genuinely version-gated: one-off reinterpretations of data
            // that was already well-formed, which must not re-run.
            // v19 → v20: patterns gain a craft. Everything that already exists is knitting —
            // that is all the app could express until now.
            if (version < 20 && typeof pattern.craft !== 'string') pattern.craft = 'knit';
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
        // v18 → v19: awards need a record of what happened, and a project needs a status. Both
        // start empty: there is no history to reconstruct, because nothing was ever dated. An
        // existing project is active unless it has already been knitted to the end, which the
        // progress calculation still works out on its own.
        // v22 → v23: "Started Jun 14" becomes a date, and a project carries its own craft. The
        // year was never recorded, so parseStartedText infers the most recent one that isn't in
        // the future. A project takes its pattern's craft where it has one — that is what it was
        // being knitted in — and knitting otherwise, which is all the app could express.
        if (version < 23 && state?.projects) {
          for (const project of Object.values(state.projects)) {
            if (!('startedOn' in project)) {
              project.startedOn = parseStartedText(String(project.started ?? ''));
            }
            delete project.started;
            if (typeof project.craft !== 'string') {
              const patternId = project.patternId as string | null | undefined;
              const pattern = patternId ? state.patterns?.[patternId] : undefined;
              project.craft = (pattern?.craft as string | undefined) ?? 'knit';
            }
          }
        }
        // A section marked complete while its row count says otherwise is a contradiction the
        // counter read as "finished" — repaired rather than left to sit there confusing people.
        for (const project of Object.values(state?.projects ?? {})) {
          for (const section of (project.sections as Record<string, unknown>[]) ?? []) {
            if (section.complete && (section.row as number) < (section.totalRows as number)) {
              section.complete = false;
            }
          }
        }
        // Unconditional, not gated on a version. A back-fill written after the store has already
        // passed the version it checks for simply never runs — that is how finishedByCraft came to
        // be undefined on a store already at 19. normaliseAchievements fills whatever is missing,
        // so a field added later is repaired by this same line.
        if (state) {
          const withAwards = state as { achievements?: unknown };
          withAwards.achievements = normaliseAchievements(withAwards.achievements);
          for (const project of Object.values(state.projects ?? {})) {
            if (typeof project.status !== 'string') project.status = 'active';
          }
        }
        // v17 → v18: preferences move into the store. An existing install was working in
        // centimetres, because that was the only thing the app could express.
        if (version < 18 && state) {
          const withSettings = state as { settings?: unknown };
          if (typeof withSettings.settings !== 'object' || withSettings.settings === null) {
            withSettings.settings = { gaugeUnit: 'cm' };
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
        settings: state.settings,
        achievements: state.achievements,
        materials: state.materials,
        tools: state.tools,
        patterns: state.patterns,
        techniques: state.techniques,
        // Cached, not owned. This is the whole reason the Techniques tab works on a train: the
        // catalogue lives in Supabase, and without persisting it every cold start with no
        // connection would show a knitter's techniques as bare slugs.
        catalogue: state.catalogue,
        catalogueFetchedAt: state.catalogueFetchedAt,
        projects: state.projects,
        activeProjectKey: state.activeProjectKey,
        activeSectionIndex: state.activeSectionIndex,
        recentSections: state.recentSections,
        noteSeq: state.noteSeq,
        materialSeq: state.materialSeq,
        toolSeq: state.toolSeq,
        patternSeq: state.patternSeq,
        techniqueSeq: state.techniqueSeq,
        projectSeq: state.projectSeq,
      }),

      onRehydrateStorage: () => finishHydration,
    },
  ),
);
