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

// This restores a session and never creates one. It used to mint an anonymous account on first
// launch; the app is behind a sign-in wall now, so a signed-out device must stay signed out — a
// session conjured here would let somebody past the door without ever having gone through it.
describe('establishing a session', () => {
  beforeEach(() => {
    jest.resetModules();
    mockGetSession.mockReset();
    mockSignInAnonymously.mockReset();
  });

  it('leaves a signed-out device signed out', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    const { ensureSession: fresh, currentUserId: id, currentSession: now } = freshModule();
    await expect(fresh()).resolves.toBeNull();

    // The account this used to make silently is the thing the gate exists to prevent.
    expect(mockSignInAnonymously).not.toHaveBeenCalled();
    expect(id()).toBeNull();
    // Settled all the same: the layout waits on this before deciding whether to show the wall, and
    // "not asked yet" would flash a sign-in form at somebody already signed in.
    expect(now().settled).toBe(true);
  });

  it('reuses a stored session rather than making a second account', async () => {
    mockGetSession.mockResolvedValue({ data: { session: SESSION } });

    const { ensureSession: fresh } = freshModule();
    await fresh();

    expect(mockSignInAnonymously).not.toHaveBeenCalled();
  });

  // Four screens mounting together must ask storage once, not four times.
  it('joins one attempt when called many times at once', async () => {
    mockGetSession.mockResolvedValue({ data: { session: SESSION } });

    const { ensureSession: fresh } = freshModule();
    await Promise.all([fresh(), fresh(), fresh(), fresh()]);

    expect(mockGetSession).toHaveBeenCalledTimes(1);
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
      expect(currentSession()).toEqual({ session: null, settled: true, recovering: false });
    });
  });
});
