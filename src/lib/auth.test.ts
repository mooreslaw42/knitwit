import { accountStateOf, attachProvider } from '@/lib/auth';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockLinkIdentity = jest.fn();
const mockSignInWithOAuth = jest.fn();
const mockFinishProviderFlow = jest.fn();
let mockAnonymous = true;

jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    auth: { linkIdentity: mockLinkIdentity, signInWithOAuth: mockSignInWithOAuth },
  }),
}));
jest.mock('@/lib/session', () => ({
  currentSession: () => ({
    session: { user: { id: 'u1', is_anonymous: mockAnonymous, identities: [] } },
    settled: true,
  }),
  ensureSession: async () => null,
}));
jest.mock('@/lib/auth-return', () => ({
  authReturnUrl: () => 'https://knitwit.eu/account',
  skipBrowserRedirect: false,
  finishProviderFlow: (url: string | null) => mockFinishProviderFlow(url),
}));

// What the Account screen decides from: whether there is a way back into this account at all.
describe('reading the account', () => {
  it('reports nothing when there is no session', () => {
    expect(accountStateOf(null)).toEqual({
      signedIn: false,
      anonymous: false,
      email: null,
      providers: [],
      userId: null,
    });
  });

  // The state that matters: an account holding everything, with no way to return to it.
  it('knows an anonymous account is not somewhere you can come back to', () => {
    const state = accountStateOf({
      user: { id: 'u1', is_anonymous: true, identities: [{ provider: 'anonymous' }] },
    } as never);

    expect(state.anonymous).toBe(true);
    expect(state.email).toBeNull();
    // 'anonymous' is not a provider anybody signs in with, so it is not offered as one.
    expect(state.providers).toEqual([]);
  });

  it('reports an account that has been saved', () => {
    const state = accountStateOf({
      user: {
        id: 'u1',
        is_anonymous: false,
        email: 'knitter@example.com',
        identities: [{ provider: 'email' }],
      },
    } as never);

    expect(state).toMatchObject({
      signedIn: true,
      anonymous: false,
      email: 'knitter@example.com',
      providers: ['email'],
      userId: 'u1',
    });
  });

  it('lists the providers attached to it', () => {
    const state = accountStateOf({
      user: {
        id: 'u1',
        is_anonymous: false,
        identities: [{ provider: 'anonymous' }, { provider: 'apple' }, { provider: 'google' }],
      },
    } as never);
    expect(state.providers).toEqual(['apple', 'google']);
  });

  it('copes with a user that has no identities at all', () => {
    const state = accountStateOf({ user: { id: 'u1', is_anonymous: false } } as never);
    expect(state.providers).toEqual([]);
    expect(state.signedIn).toBe(true);
  });
});


// Attaching Apple or Google, which has one way of going wrong that nobody can see: it succeeds,
// into an account that is not the one holding the knitting.
describe('attaching a provider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAnonymous = true;
    mockFinishProviderFlow.mockResolvedValue(undefined);
    const started = { data: { url: 'https://appleid.example/auth' }, error: null };
    mockLinkIdentity.mockResolvedValue(started);
    mockSignInWithOAuth.mockResolvedValue(started);
  });

  // The whole point of going anonymous first: the id has to survive, so an account worth keeping is
  // linked to rather than replaced.
  it('links to the account already in hand rather than making another', async () => {
    await attachProvider('apple');
    expect(mockLinkIdentity).toHaveBeenCalledWith(expect.objectContaining({ provider: 'apple' }));
    expect(mockSignInWithOAuth).not.toHaveBeenCalled();
  });

  it('signs in normally when there is no anonymous account to keep', async () => {
    mockAnonymous = false;
    await attachProvider('apple');
    expect(mockSignInWithOAuth).toHaveBeenCalled();
    expect(mockLinkIdentity).not.toHaveBeenCalled();
  });

  // Apple only returns a knitter to a URL the project agreed to in advance, so one has to be asked
  // for. Left off, Apple falls back to the project's Site URL and somebody signing in on knitwit.eu
  // lands somewhere else entirely.
  it('asks to be sent back to where the knitter was', async () => {
    await attachProvider('apple');
    expect(mockLinkIdentity).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ redirectTo: 'https://knitwit.eu/account' }),
      }),
    );
  });

  // Manual linking off does not fail — it succeeds into a second account and leaves the knitting on
  // the first. The message has to say that rather than "try again".
  it('says so plainly when linking is not switched on for the project', async () => {
    mockLinkIdentity.mockResolvedValue({ data: null, error: { message: 'Manual linking is disabled' } });
    expect(await attachProvider('apple')).toEqual({
      ok: false,
      message: 'Signing in with Apple or Google is not switched on for Knitwit yet.',
    });
  });

  // Backing out of Apple's sheet is a decision, not a fault, so nothing is said about it.
  it('stays quiet when the knitter changes their mind', async () => {
    mockFinishProviderFlow.mockRejectedValue(new Error('cancelled'));
    expect(await attachProvider('apple')).toEqual({ ok: false, message: '' });
  });

  // The failure with nothing to see: Apple returns, and the code that should have been on the URL
  // is not there. Silence would look exactly like success.
  it('reports a return that carried no answer', async () => {
    mockFinishProviderFlow.mockRejectedValue(new Error('no-code'));
    const result = await attachProvider('apple');
    expect(result.ok).toBe(false);
    expect(result).toHaveProperty('message', expect.stringContaining('without an answer'));
  });
});
