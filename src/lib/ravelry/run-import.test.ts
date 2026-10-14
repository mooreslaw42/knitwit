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

beforeEach(() => {
  invoke.mockReset();
  useKnitwitStore.setState({ materials: {}, tools: {}, patterns: {}, projects: {} });
});

describe('runRavelryImport', () => {
  it('pulls from the server and lands the entities in the store', async () => {
    invoke.mockResolvedValue({
      ok: true,
      connected: true,
      data: {
        stash: [
          {
            id: 11111111,
            permalink: 'drops-saga',
            name: 'Garnstudio DROPS Saga',
            yarn: { permalink: 'garnstudio-drops-saga', grams: 50 },
            user: { username: 'testknitter' },
          },
        ],
        needles: [
          { id: 1, needle_type_id: 69, needle_type: { metric_name: '3.25', type_name: 'dp', length: 8 } },
        ],
        patterns: [{ id: 2222222, permalink: 'sample-camisole', name: 'Sample Camisole', craft: { name: 'Knitting' } }],
        projects: [
          {
            id: 3333333,
            permalink: 'test-project-1',
            name: 'Test project 1',
            pattern_id: 2222222,
            packs: [{ stash_id: 11111111, yarn_id: 2085, skeins: 2 }],
            user: { username: 'testknitter' },
          },
        ],
      },
    });

    const summary = await runRavelryImport();

    expect(invoke).toHaveBeenCalledWith('ravelry-import', { task: 'pull' }, expect.anything());
    expect(summary).toEqual({ materials: 1, tools: 1, patterns: 1, projects: 1 });

    const state = useKnitwitStore.getState();
    const material = Object.values(state.materials).find((m) => m.ravelrySource?.id === '11111111');
    const pattern = Object.values(state.patterns).find((p) => p.ravelrySource?.id === '2222222');
    const project = Object.values(state.projects).find((p) => p.ravelrySource?.id === '3333333');
    expect(material?.brand).toBe('Garnstudio DROPS Saga');
    expect(pattern?.name).toBe('Sample Camisole');
    // The project linked to the imported pattern and yarn.
    const patternKey = Object.keys(state.patterns).find((k) => state.patterns[k].ravelrySource?.id === '2222222');
    const materialKey = Object.keys(state.materials).find((k) => state.materials[k].ravelrySource?.id === '11111111');
    expect(project?.patternId).toBe(patternKey);
    expect(project?.materialSkeins).toEqual({ [materialKey as string]: 2 });
  });

  it('throws when the server returns no data', async () => {
    invoke.mockResolvedValue({ ok: true });
    await expect(runRavelryImport()).rejects.toThrow(/nothing to import/i);
  });
});
