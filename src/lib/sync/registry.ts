import type { Entity } from '@/lib/sync/engine';
import { mergeMonotonic } from '@/lib/sync/monotonic';
import { patternSectionsEntity, projectSectionsEntity } from '@/lib/sync/sections';
import { useKnitwitStore } from '@/store/useKnitwitStore';
import type {
  Achievements,
  Material,
  Pattern,
  Project,
  Technique,
  Tool,
  UserSettings,
} from '@/types/knitwit';

// Everything that syncs, in the order it must sync.
//
// The order is not decoration. A section arriving for a project this device has never seen has
// nowhere to go, so parents come before children — and because a whole entity is pulled before the
// next one starts, a section's project is always local by the time the section is read.

// A record keyed by id is the common case and needs nothing said about it.
function collection<T>(
  table: string,
  read: () => Record<string, T>,
  write: (next: Record<string, T>) => void,
  merge?: Entity<T>['merge'],
): Entity<T> {
  return {
    table,
    local: read,
    replace: write,
    toRow: (value) => value as unknown as Record<string, unknown>,
    fromRow: (data) => data as unknown as T,
    merge,
  };
}

// Settings and awards are one object each, not a collection. They sync as a collection of exactly
// one so that there is a single engine rather than two — hence the constant id, which matches the
// default the table gives the column.
function singleton<T>(
  table: string,
  read: () => T,
  write: (value: T) => void,
  merge?: Entity<T>['merge'],
): Entity<T> {
  return {
    table,
    local: () => ({ me: read() }),
    replace: (next) => {
      if (next.me) write(next.me);
    },
    toRow: (value) => value as unknown as Record<string, unknown>,
    fromRow: (data) => data as unknown as T,
    merge,
  };
}

const store = () => useKnitwitStore.getState();

export const ENTITIES: Entity<never>[] = [
  // Independent of everything, so first and safest.
  collection<Material>(
    'materials',
    () => store().materials,
    (materials) => useKnitwitStore.setState({ materials }),
  ),
  collection<Tool>(
    'tools',
    () => store().tools,
    (tools) => useKnitwitStore.setState({ tools }),
  ),
  collection<Technique>(
    'techniques',
    () => store().techniques,
    (techniques) => useKnitwitStore.setState({ techniques }),
  ),

  // Parents before their sections.
  collection<Pattern>(
    'patterns',
    () => store().patterns,
    (patterns) => useKnitwitStore.setState({ patterns }),
  ),
  patternSectionsEntity,
  collection<Project>(
    'projects',
    () => store().projects,
    (projects) => useKnitwitStore.setState({ projects }),
  ),
  projectSectionsEntity,

  collection<UserSettings>(
    'user_settings',
    () => ({ me: store().settings }),
    (next) => {
      if (next.me) useKnitwitStore.setState({ settings: next.me });
    },
  ),

  // Awards count rather than describe, and the type says so of itself: nothing here ever decreases.
  // Taking whatever arrived would let a device that has been shut for a week push a stale total and
  // a knitter watch their row count go backwards.
  singleton<Achievements>(
    'achievements',
    () => store().achievements,
    (achievements) => useKnitwitStore.setState({ achievements }),
    mergeMonotonic,
  ),
] as unknown as Entity<never>[];

// The slices of the store each entity is built from, for the watcher to compare. A parent and its
// sections both watch the same slice, which is correct: moving a section changes the project too.
export const WATCHED: { table: string; slice: (s: ReturnType<typeof store>) => unknown }[] = [
  { table: 'materials', slice: (s) => s.materials },
  { table: 'tools', slice: (s) => s.tools },
  { table: 'techniques', slice: (s) => s.techniques },
  { table: 'patterns', slice: (s) => s.patterns },
  { table: 'pattern_sections', slice: (s) => s.patterns },
  { table: 'projects', slice: (s) => s.projects },
  { table: 'project_sections', slice: (s) => s.projects },
  { table: 'user_settings', slice: (s) => s.settings },
  { table: 'achievements', slice: (s) => s.achievements },
];

export function entityFor(table: string): Entity<never> | undefined {
  return ENTITIES.find((e) => e.table === table);
}
