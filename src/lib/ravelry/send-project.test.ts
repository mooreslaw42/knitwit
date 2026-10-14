import { invokeEdgeFunction } from '@/lib/edge-function';
import { useKnitwitStore } from '@/store/useKnitwitStore';
import type { Project } from '@/types/knitwit';

import { ravelryPatternToPattern } from './patterns';
import { sendProjectToRavelry } from './send-project';

jest.mock('@/lib/edge-function', () => ({ invokeEdgeFunction: jest.fn() }));

// The store persists through AsyncStorage, which has no implementation under jest-expo.
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const invoke = invokeEdgeFunction as jest.Mock;

function project(overrides: Partial<Project> = {}): Project {
  return {
    name: 'Winter cardigan',
    startedOn: '2026-10-01',
    craft: 'knit',
    photo: null,
    color: '#c8a2c8',
    colorDeep: '#8f6f8f',
    category: 'cardigans',
    level: 'intermediate',
    needleSize: '4mm',
    video: '',
    sourceName: '',
    sourceText: '',
    notes: '',
    labels: [],
    patternId: null,
    sizeIndex: 0,
    status: 'active',
    gauge: null,
    sections: [],
    ...overrides,
  };
}

function put(p: Project): string {
  return useKnitwitStore.getState().saveProject(null, p);
}

beforeEach(() => {
  invoke.mockReset();
  useKnitwitStore.setState({ materials: {}, tools: {}, patterns: {}, projects: {} });
});

describe('sendProjectToRavelry', () => {
  it('creates the project and stamps where it landed', async () => {
    const key = put(project());
    invoke.mockResolvedValue({
      ok: true,
      id: 40127751,
      url: 'https://www.ravelry.com/projects/henkdetank/winter-cardigan',
    });

    const sent = await sendProjectToRavelry(key);

    expect(sent.id).toBe('40127751');
    const [name, body] = invoke.mock.calls[0];
    expect(name).toBe('ravelry-import');
    expect(body).toMatchObject({ task: 'create-project', draft: { name: 'Winter cardigan' } });

    // Stamped, so the next import reconciles onto this row rather than bringing it back as a copy.
    expect(useKnitwitStore.getState().projects[key].ravelrySource).toMatchObject({
      id: '40127751',
      kind: 'project',
      url: 'https://www.ravelry.com/projects/henkdetank/winter-cardigan',
    });
  });

  it('refuses to send a project that already came from Ravelry', async () => {
    const key = put(
      project({
        ravelrySource: { id: '3333333', kind: 'project', url: '', importedAt: '2026-10-14T00:00:00.000Z' },
      }),
    );

    await expect(sendProjectToRavelry(key)).rejects.toThrow('already on Ravelry');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('refuses a nameless project rather than filing an "Untitled" on Ravelry', async () => {
    const key = put(project({ name: '  ' }));
    await expect(sendProjectToRavelry(key)).rejects.toThrow('name');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('leaves the project unstamped when Ravelry refuses', async () => {
    const key = put(project());
    invoke.mockRejectedValue(new Error('Ravelry would not take this project.'));

    await expect(sendProjectToRavelry(key)).rejects.toThrow('would not take');
    // Nothing was created there, so nothing is claimed here — the knitter can try again.
    expect(useKnitwitStore.getState().projects[key].ravelrySource).toBeUndefined();
  });

  it('keeps an edit made while the send was in flight', async () => {
    const key = put(project());
    invoke.mockImplementation(() => {
      // The knitter renames it while the request is out.
      const store = useKnitwitStore.getState();
      store.saveProject(key, { ...store.projects[key], name: 'Winter cardigan v2' });
      return Promise.resolve({ ok: true, id: 7, url: 'https://example.test/p' });
    });

    await sendProjectToRavelry(key);

    const saved = useKnitwitStore.getState().projects[key];
    expect(saved.name).toBe('Winter cardigan v2');
    expect(saved.ravelrySource?.id).toBe('7');
  });

  it('lends the linked pattern’s Ravelry id and the size being made', async () => {
    invoke.mockResolvedValue({ ok: true, id: 1, url: '' });

    // A pattern that came from Ravelry in the first place, built by the importer's own mapper so
    // the shape is the real one.
    const imported = ravelryPatternToPattern(
      { id: 1344864, permalink: 'camisole-no-9', name: 'Camisole No. 9', craft: { name: 'Knitting' } },
      '2026-10-14T00:00:00.000Z',
    );
    const patternKey = useKnitwitStore
      .getState()
      .savePattern(null, { ...imported, sizes: ['S', 'M', 'L'] });

    const key = put(project({ patternId: patternKey, sizeIndex: 1 }));
    await sendProjectToRavelry(key);

    expect(invoke.mock.calls[0][1].draft).toMatchObject({ pattern_id: 1344864, size: 'M' });
  });

  it('sends no pattern link for a pattern the knitter wrote themselves', async () => {
    invoke.mockResolvedValue({ ok: true, id: 1, url: '' });
    const own = ravelryPatternToPattern(
      { id: 999, permalink: 'mine', name: 'My own', craft: { name: 'Knitting' } },
      '2026-10-14T00:00:00.000Z',
    );
    // Same shape, but nothing from Ravelry — so there is no id there to point at.
    const patternKey = useKnitwitStore
      .getState()
      .savePattern(null, { ...own, ravelrySource: undefined });

    const key = put(project({ patternId: patternKey }));
    await sendProjectToRavelry(key);

    expect(invoke.mock.calls[0][1].draft.pattern_id).toBeUndefined();
  });
});
