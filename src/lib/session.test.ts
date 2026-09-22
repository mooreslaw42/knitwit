import { currentSession, currentUserId, ensureSession } from '@/lib/session';

// Jest only lets a mock factory reach variables whose names begin with `mock`.
const mockSignInAnonymously = jest.fn();
const mockGetSession = jest.fn();

jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    auth: {
      getSession: () => mockGetSession(),
      signInAnonymously: () => mockSignInAnonymously(),
    },
  }),
}));

const SESSION = { user: { id: 'user-1', is_anonymous: true } };

// The module keeps its session in module scope on purpose — one account per app, not per caller —
// so each test needs its own copy of it.
function freshModule() {
  let mod!: typeof import('@/lib/session');
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('@/lib/session');
  });
  return mod;
}

// The whole point of M1 is that this is invisible and cannot hurt anyone. So: it must never throw,
// never block, and never make two accounts for one knitter.
describe('establishing a session', () => {
  beforeEach(() => {
    jest.resetModules();
    mockGetSession.mockReset();
    mockSignInAnonymously.mockReset();
  });

  it('signs in anonymously when there is nothing stored', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockSignInAnonymously.mockResolvedValue({ data: { session: SESSION }, error: null });

    const { ensureSession: fresh, currentUserId: id } = freshModule();
    await fresh();

    expect(mockSignInAnonymously).toHaveBeenCalledTimes(1);
    expect(id()).toBe('user-1');
  });

  it('reuses a stored session rather than making a second account', async () => {
    mockGetSession.mockResolvedValue({ data: { session: SESSION } });

    const { ensureSession: fresh } = freshModule();
    await fresh();

    expect(mockSignInAnonymously).not.toHaveBeenCalled();
  });

  // Two screens mounting together must not produce two knitters.
  it('makes one account when called many times at once', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockSignInAnonymously.mockResolvedValue({ data: { session: SESSION }, error: null });

    const { ensureSession: fresh } = freshModule();
    await Promise.all([fresh(), fresh(), fresh(), fresh()]);

    expect(mockSignInAnonymously).toHaveBeenCalledTimes(1);
  });

  // Offline, rate-limited, or the feature turned off. All of them mean: carry on locally.
  it('carries on with no session when signing in fails', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockSignInAnonymously.mockResolvedValue({ data: { session: null }, error: { message: 'offline' } });

    const { ensureSession: fresh, currentSession: now } = freshModule();
    await expect(fresh()).resolves.toBeNull();
    // Settled matters: it is how sync tells "no account" from "not asked yet".
    expect(now().settled).toBe(true);
    expect(now().session).toBeNull();
  });

  it('does not throw when the client itself blows up', async () => {
    mockGetSession.mockRejectedValue(new Error('no window'));

    const { ensureSession: fresh } = freshModule();
    await expect(fresh()).resolves.toBeNull();
  });

  it('reports nothing before it has been asked', () => {
    expect(currentSession().settled).toBe(false);
    expect(currentUserId()).toBeNull();
    expect(typeof ensureSession).toBe('function');
  });
});

// The promise this module makes about itself: nothing in it can stop the app. It was only half
// kept — ensureSession caught everything, watchSession caught nothing — and a build that shipped
// without Supabase credentials crashed on launch rather than working locally.
describe('when the project is not configured at all', () => {
  it('does not take the app down with it', () => {
    jest.isolateModules(() => {
      jest.doMock('@/lib/supabase', () => ({
        getSupabase: () => {
          throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY');
        },
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { watchSession, currentSession } = require('@/lib/session');

      expect(() => watchSession()()).not.toThrow();
      // Settled, with no session — sync reads this to tell "no account" from "not asked yet", and
      // must not wait for one that can never arrive.
      expect(currentSession()).toEqual({ session: null, settled: true });
    });
  });
});
