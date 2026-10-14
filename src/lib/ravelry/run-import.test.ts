import { invokeEdgeFunction } from '@/lib/edge-function';
import { useKnitwitStore } from '@/store/useKnitwitStore';

import { runRavelryImport } from './run-import';

jest.mock('@/lib/edge-function', () => ({ invokeEdgeFunction: jest.fn() }));

// The store persists through AsyncStorage, which has no implementation under jest-expo — without
// this mock importing the store fails the whole suite. (See useKnitwitStore.test.ts.)
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const invoke = invokeEdgeFunction as jest.Mock;

const STASH = {
  id: 11111111,
  permalink: 'drops-saga',
  name: 'Garnstudio DROPS Saga',
  yarn: { permalink: 'garnstudio-drops-saga', grams: 50 },
  user: { username: 'testknitter' },
};
const PATTERN = { id: 2222222, permalink: 'sample-camisole', name: 'Sample Camisole', craft: { name: 'Knitting' } };
const PROJECT = {
  id: 3333333,
  permalink: 'test-project-1',
  name: 'Test project 1',
  pattern_id: 2222222,
  packs: [{ stash_id: 11111111, yarn_id: 2085, skeins: 2 }],
  user: { username: 'testknitter' },
};

// Answers the paged conversation the importer has with the server.
function serve(pages: {
  needles?: unknown[];
  stash?: unknown[][];
  library?: number[][];
  projects?: unknown[][];
  patterns?: unknown[];
}) {
  invoke.mockImplementation((_name: string, body: Record<string, unknown>) => {
    const page = (body.page as number) ?? 1;
    const slice = (all: unknown[][] | undefined) => ({
      items: all?.[page - 1] ?? [],
      hasMore: (all?.length ?? 0) > page,
    });
    switch (body.task) {
      case 'needles':
        return Promise.resolve({ items: pages.needles ?? [] });
      case 'stash':
        return Promise.resolve(slice(pages.stash));
      case 'library':
        return Promise.resolve({
          ids: pages.library?.[page - 1] ?? [],
          hasMore: (pages.library?.length ?? 0) > page,
        });
      case 'projects':
        return Promise.resolve(slice(pages.projects));
      case 'patterns': {
        const want = new Set(body.ids as number[]);
        return Promise.resolve({
          items: (pages.patterns ?? []).filter((p) => want.has((p as { id: number }).id)),
        });
      }
      default:
        return Promise.resolve({});
    }
  });
}

beforeEach(() => {
  invoke.mockReset();
  useKnitwitStore.setState({ materials: {}, tools: {}, patterns: {}, projects: {} });
});

describe('runRavelryImport', () => {
  it('walks the pages and lands linked entities in the store', async () => {
    serve({
      needles: [
        { id: 1, needle_type_id: 69, needle_type: { metric_name: '3.25', type_name: 'dp', length: 8 } },
      ],
      stash: [[STASH]],
      library: [[]],
      projects: [[PROJECT]],
      patterns: [PATTERN],
    });

    const summary = await runRavelryImport();

    expect(summary).toEqual({ materials: 1, tools: 1, patterns: 1, projects: 1 });
    const state = useKnitwitStore.getState();
    const patternKey = Object.keys(state.patterns).find(
      (k) => state.patterns[k].ravelrySource?.id === '2222222',
    );
    const materialKey = Object.keys(state.materials).find(
      (k) => state.materials[k].ravelrySource?.id === '11111111',
    );
    const project = Object.values(state.projects).find((p) => p.ravelrySource?.id === '3333333');
    // The pattern the project referenced was fetched by id and applied before the project, so the
    // link resolves.
    expect(project?.patternId).toBe(patternKey);
    expect(project?.materialSkeins).toEqual({ [materialKey as string]: 2 });
  });

  it('keeps asking while there is more, and reports progress as it goes', async () => {
    const second = { ...STASH, id: 22222222, permalink: 'second', name: 'Second yarn' };
    serve({ stash: [[STASH], [second]], library: [[]], projects: [[]] });

    const seen: number[] = [];
    const summary = await runRavelryImport((soFar) => seen.push(soFar.materials));

    expect(summary.materials).toBe(2); // both pages walked
    expect(Object.keys(useKnitwitStore.getState().materials)).toHaveLength(2);
    // Progress was reported with a rising count, not just at the end.
    expect(seen).toEqual(expect.arrayContaining([1, 2]));
  });

  it('refreshes patterns on a later run rather than skipping what it already has', async () => {
    serve({ stash: [[]], library: [[2222222]], projects: [[]], patterns: [PATTERN] });

    await runRavelryImport();
    const afterFirst = invoke.mock.calls.filter(([, b]) => b.task === 'patterns').length;
    await runRavelryImport();
    const afterSecond = invoke.mock.calls.filter(([, b]) => b.task === 'patterns').length;

    // Deduping is per run, not against the store — otherwise a pattern imported once would never
    // pick up a change on Ravelry again.
    expect(afterFirst).toBe(1);
    expect(afterSecond).toBe(2);
    expect(Object.keys(useKnitwitStore.getState().patterns)).toHaveLength(1); // still reconciled, not duplicated
  });

  it('loads the technique catalogue before mapping any pattern', async () => {
    // Otherwise the attribute matching quietly does nothing on the likeliest path of all: the
    // catalogue is loaded lazily by the Techniques tab and the pattern wizard, and a knitter who
    // signs in and imports from the Account screen has touched neither.
    const loadCatalogue = jest.fn().mockResolvedValue(undefined);
    useKnitwitStore.setState({ loadCatalogue });
    serve({ stash: [[]], library: [[]], projects: [[]] });

    await runRavelryImport();

    expect(loadCatalogue).toHaveBeenCalled();
  });

  it('imports anyway when the catalogue cannot be loaded', async () => {
    useKnitwitStore.setState({ loadCatalogue: jest.fn().mockRejectedValue(new Error('offline')) });
    serve({ stash: [[STASH]], library: [[]], projects: [[]] });

    // A nicety must not be able to fail the import.
    await expect(runRavelryImport()).resolves.toMatchObject({ materials: 1 });
  });

  it('retries a page once before giving up on it', async () => {
    serve({ stash: [[STASH]], library: [[]], projects: [[]] });
    const good = invoke.getMockImplementation() as jest.Mock;
    let failed = false;
    invoke.mockImplementation((name: string, body: Record<string, unknown>) => {
      if (body.task === 'stash' && !failed) {
        failed = true;
        // What a cold start looks like from here: a failure that is not a failure.
        return Promise.reject(new Error("Couldn't reach Ravelry."));
      }
      return good(name, body);
    });

    const summary = await runRavelryImport();

    // The second attempt got the page, so the import carried on rather than ending at nothing.
    expect(summary.materials).toBe(1);
  });

  it('gives up when a page fails twice, keeping what landed before it', async () => {
    serve({ needles: [{ id: 1, needle_type_id: 69, needle_type: { metric_name: '3.25' } }] });
    const good = invoke.getMockImplementation() as jest.Mock;
    invoke.mockImplementation((name: string, body: Record<string, unknown>) =>
      body.task === 'stash' ? Promise.reject(new Error('Ravelry is down.')) : good(name, body),
    );

    await expect(runRavelryImport()).rejects.toThrow('Ravelry is down.');
    // The needles were applied before the stash failed, and they stay applied.
    expect(Object.keys(useKnitwitStore.getState().tools)).toHaveLength(1);
  });

  it('asks for a pattern’s details only once even when several projects share it', async () => {
    const other = { ...PROJECT, id: 4444444, permalink: 'p2', name: 'Another', pattern_id: 2222222 };
    serve({ stash: [[]], library: [[2222222]], projects: [[PROJECT, other]], patterns: [PATTERN] });

    await runRavelryImport();

    const patternCalls = invoke.mock.calls.filter(([, body]) => body.task === 'patterns');
    // The library page fetched it; the projects page found it already there and asked for nothing.
    expect(patternCalls).toHaveLength(1);
    expect(Object.keys(useKnitwitStore.getState().patterns)).toHaveLength(1);
  });
});
