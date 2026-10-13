import {
  accountStateOf,
  addRecoveryEmail,
  attachProvider,
  createAccount,
  deleteAccount,
  describeProviderReturn,
  providerLabel,
  recheckEmail,
  requestPasswordReset,
  setNewPassword,
} from '@/lib/auth';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockLinkIdentity = jest.fn();
const mockSignInWithOAuth = jest.fn();
const mockFinishProviderFlow = jest.fn();
const mockProviderReturnError = jest.fn();
const mockUpdateUser = jest.fn();
const mockSignUp = jest.fn();
const mockResetPasswordForEmail = jest.fn();
const mockInvoke = jest.fn();
const mockRefreshSession = jest.fn();
let mockSession: unknown = null;
let mockAnonymous = true;

jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    auth: {
      linkIdentity: mockLinkIdentity,
      signInWithOAuth: mockSignInWithOAuth,
      updateUser: (a: unknown, b?: unknown) => (b === undefined ? mockUpdateUser(a) : mockUpdateUser(a, b)),
      refreshSession: () => mockRefreshSession(),
      signUp: (a: unknown) => mockSignUp(a),
      resetPasswordForEmail: (a: unknown, b: unknown) => mockResetPasswordForEmail(a, b),
    },
  }),
}));
jest.mock('@/lib/session', () => ({
  currentSession: () => ({
    session: { user: { id: 'u1', is_anonymous: mockAnonymous, identities: [] } },
    settled: true,
  }),
  ensureSession: async () => mockSession,
}));
jest.mock('@/lib/edge-function', () => ({
  invokeEdgeFunction: (name: string, body: unknown, opts: unknown) => mockInvoke(name, body, opts),
}));
jest.mock('@/lib/auth-return', () => ({
  authReturnUrl: () => 'https://knitwit.eu/account',
  emailReturnUrl: () => 'https://knitwit.eu/account',
  skipBrowserRedirect: false,
  finishProviderFlow: (url: string | null) => mockFinishProviderFlow(url),
  providerReturnError: () => mockProviderReturnError(),
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
      pendingEmail: null,
      needsEmail: false,
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

  // The account Ravelry makes: signed in, not anonymous, and nothing to recover it with.
  it('knows an account with no email needs one', () => {
    const state = accountStateOf({
      user: { id: 'u1', is_anonymous: false, email: '', identities: [{ provider: 'custom:ravelry' }] },
    } as never);
    expect(state.needsEmail).toBe(true);
    expect(state.providers).toEqual(['custom:ravelry']);
  });

  // Asked for, not yet confirmed. Still held: an address nobody has proved is not a way back in.
  it('still needs one while the address waits for its link', () => {
    const state = accountStateOf({
      user: { id: 'u1', is_anonymous: false, email: '', new_email: 'me@example.com', identities: [] },
    } as never);
    expect(state.needsEmail).toBe(true);
    expect(state.pendingEmail).toBe('me@example.com');
  });

  // Anonymous accounts have their own wall; this must not put a second one in front of it.
  it('does not ask an anonymous account for an email here', () => {
    const state = accountStateOf({ user: { id: 'u1', is_anonymous: true } } as never);
    expect(state.needsEmail).toBe(false);
  });

  it('does not ask an account that has one', () => {
    const state = accountStateOf({
      user: { id: 'u1', is_anonymous: false, email: 'me@example.com' },
    } as never);
    expect(state.needsEmail).toBe(false);
  });

  it('names Ravelry as Ravelry, not by its configuration id', () => {
    expect(providerLabel('custom:ravelry')).toBe('Ravelry');
    expect(providerLabel('apple')).toBe('Apple');
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

  // The bug this default exists to prevent. Pressing Apple on a sign-in screen used to *link*
  // whenever the device held an anonymous session, so somebody signing in to an account they
  // already had was told their Apple ID "is already attached to a different Knitwit account" —
  // true, useless, and not what the button offered to do.
  it('signs in by default, even when the device holds an anonymous account', async () => {
    mockAnonymous = true;
    await attachProvider('apple');
    expect(mockSignInWithOAuth).toHaveBeenCalled();
    expect(mockLinkIdentity).not.toHaveBeenCalled();
  });

  // The other intent, which is the whole point of having gone anonymous first: the id survives, so
  // the knitting does.
  it('links when asked to keep the account already in hand', async () => {
    await attachProvider('apple', 'keep-this-account');
    expect(mockLinkIdentity).toHaveBeenCalledWith(expect.objectContaining({ provider: 'apple' }));
    expect(mockSignInWithOAuth).not.toHaveBeenCalled();
  });

  // There is nothing to keep, so there is nothing to link to.
  it('signs in even when asked to keep an account that is not anonymous', async () => {
    mockAnonymous = false;
    await attachProvider('apple', 'keep-this-account');
    expect(mockSignInWithOAuth).toHaveBeenCalled();
    expect(mockLinkIdentity).not.toHaveBeenCalled();
  });

  // Apple only returns a knitter to a URL the project agreed to in advance, so one has to be asked
  // for. Left off, Apple falls back to the project's Site URL and somebody signing in on knitwit.eu
  // lands somewhere else entirely.
  it('asks to be sent back to where the knitter was', async () => {
    await attachProvider('apple');
    expect(mockSignInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ redirectTo: 'https://knitwit.eu/account' }),
      }),
    );
  });

  // Manual linking off does not fail — it succeeds into a second account and leaves the knitting on
  // the first. The message has to say that rather than "try again".
  it('says so plainly when linking is not switched on for the project', async () => {
    mockLinkIdentity.mockResolvedValue({ data: null, error: { message: 'Manual linking is disabled' } });
    expect(await attachProvider('apple', 'keep-this-account')).toEqual({
      ok: false,
      message: 'Signing in with Apple or Google is not switched on for Knitwit yet.',
    });
  });

  // Ravelry is a custom provider in Supabase, so the name the app uses is not the one it is
  // configured under.
  it('asks for Ravelry by its configured id', async () => {
    await attachProvider('ravelry');
    expect(mockSignInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'custom:ravelry' }),
    );
  });

  // From the Account screen: Ravelry as a second way into the account already open.
  it('links Ravelry to a signed-in account when asked to connect it', async () => {
    mockAnonymous = false;
    await attachProvider('ravelry', 'connect');
    expect(mockLinkIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'custom:ravelry' }),
    );
    expect(mockSignInWithOAuth).not.toHaveBeenCalled();
  });

  it('names Ravelry when its login is already somebody else’s way in', async () => {
    mockAnonymous = false;
    mockLinkIdentity.mockResolvedValue({
      data: null,
      error: { message: 'Identity is already linked to another user' },
    });
    const result = await attachProvider('ravelry', 'connect');
    expect(result).toHaveProperty('message', expect.stringContaining('Ravelry'));
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

// A provider refusal arrives as a redirect, so nothing is awaiting it. Read on arrival or not at
// all — and "not at all" looks exactly like never having pressed the button.
describe('coming back refused', () => {
  beforeEach(() => jest.clearAllMocks());

  it('says what Apple said', () => {
    mockProviderReturnError.mockReturnValue('Unable to exchange external code: c959');
    expect(describeProviderReturn()).toBe(
      'Apple let you in, but would not finish. This is a setting on Knitwit’s side, not anything you did.',
    );
  });

  it('says nothing when the knitter simply opened the screen', () => {
    mockProviderReturnError.mockReturnValue(null);
    expect(describeProviderReturn()).toBeNull();
  });
});


// Creating an account, which on some devices is a rescue rather than a sign-up.
//
// Knitwit gave everybody an anonymous account for its first five milestones, and those devices
// still hold one with a whole stash behind it. Calling signUp there makes a *second* user and
// leaves the first unreachable for ever — there is nothing to sign back into an anonymous account
// with. This is the branch that decides which, so it is the branch that can lose a year of work.
describe('creating an account', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession = null;
    mockUpdateUser.mockResolvedValue({ error: null });
    // A signed-in session straight away — what Supabase returns with confirmation switched off.
    mockSignUp.mockResolvedValue({ data: { user: { identities: [{}] }, session: {} }, error: null });
  });

  it('signs a new knitter up', async () => {
    expect(await createAccount('new@example.com', 'hunter22')).toEqual({ ok: true });
    expect(mockSignUp).toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  // With confirmation on there is no session until the link is followed. Unsaid, the screen waits
  // for one that is not coming: the knitter presses Create, the field clears, nothing happens, and
  // they press it again.
  it('says a link is on its way when there is no session yet', async () => {
    mockSignUp.mockResolvedValue({ data: { user: { identities: [{}] }, session: null }, error: null });
    expect(await createAccount('new@example.com', 'hunter22')).toEqual({
      ok: true,
      confirmEmail: true,
    });
  });

  // Supabase reports an address that is already taken as a user with no identities, on purpose:
  // answering plainly would let a stranger test addresses against the member list one at a time.
  // Knitwit says the same thing it says for a real sign-up, and the owner of the address learns
  // which it was from their inbox.
  it('does not reveal that an address is already registered', async () => {
    mockSignUp.mockResolvedValue({ data: { user: { identities: [] }, session: null }, error: null });
    expect(await createAccount('taken@example.com', 'hunter22')).toEqual({
      ok: true,
      confirmEmail: true,
    });
  });

  // The one that matters: same account, same id, same knitting.
  it('upgrades an anonymous account instead of making a second one', async () => {
    mockSession = { user: { id: 'u1', is_anonymous: true } };

    expect(await createAccount('mine@example.com', 'hunter22')).toEqual({ ok: true });
    expect(mockUpdateUser).toHaveBeenCalledWith({ email: 'mine@example.com', password: 'hunter22' });
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('does not upgrade a session that is already somebody', async () => {
    mockSession = { user: { id: 'u1', is_anonymous: false } };

    await createAccount('other@example.com', 'hunter22');
    expect(mockSignUp).toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('reports an address that is already taken rather than failing silently', async () => {
    mockSignUp.mockResolvedValue({ error: { message: 'User already registered' } });
    expect(await createAccount('taken@example.com', 'hunter22')).toEqual({
      ok: false,
      message: 'That email already has a Knitwit account. Sign in to it instead.',
    });
  });
});


// The email a Ravelry account is born without. Without it, losing the Ravelry login loses the
// knitting, so the app does not let anybody past until it is confirmed.
describe('adding an email to a Ravelry account', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Confirmation on: the address waits in new_email and `email` stays empty.
    mockUpdateUser.mockResolvedValue({ data: { user: { email: '', new_email: 'me@example.com' } }, error: null });
  });

  // updateUser, not signUp: the same user, so the Ravelry identity stays where it is.
  it('adds it to the account already signed in', async () => {
    expect(await addRecoveryEmail('  me@example.com ')).toEqual({ ok: true, confirmEmail: true });
    expect(mockUpdateUser).toHaveBeenCalledWith(
      { email: 'me@example.com' },
      { emailRedirectTo: 'https://knitwit.eu/account' },
    );
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('says when it went straight on, with confirmation switched off', async () => {
    mockUpdateUser.mockResolvedValue({ data: { user: { email: 'me@example.com' } }, error: null });
    expect(await addRecoveryEmail('me@example.com')).toEqual({ ok: true, confirmEmail: false });
  });

  // The way out of this is not "try again", it is "use that account" — so it is flagged, not just
  // worded.
  it('flags an address that already has an account', async () => {
    mockUpdateUser.mockResolvedValue({
      data: { user: null },
      error: { code: 'email_exists', message: 'A user with this email address has already been registered' },
    });
    expect(await addRecoveryEmail('taken@example.com')).toEqual({
      ok: false,
      taken: true,
      message: 'taken@example.com already has a Knitwit account.',
    });
  });

  it('does not send anything for an empty field', async () => {
    const result = await addRecoveryEmail('   ');
    expect(result.ok).toBe(false);
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  // Supabase's rate-limit message contains the word "email", which used to be read as "that does
  // not look like an email address" — telling somebody their perfectly good address was wrong.
  it('says the limit was hit, not that the address is wrong', async () => {
    mockUpdateUser.mockResolvedValue({ data: { user: null }, error: { message: 'email rate limit exceeded' } });
    const result = await addRecoveryEmail('me@example.com');
    expect(result).toHaveProperty('message', expect.stringContaining('Too many emails'));
  });

  // The link is often opened on another device, which tells this one nothing. Asking the server
  // again is how the gate finds out.
  it('finds out the link was followed by asking the server', async () => {
    mockRefreshSession.mockResolvedValue({
      data: { session: { user: { email: 'me@example.com' } } },
      error: null,
    });
    expect(await recheckEmail()).toBe(true);
  });

  it('keeps waiting when it has not been', async () => {
    mockRefreshSession.mockResolvedValue({ data: { session: { user: { email: '' } } }, error: null });
    expect(await recheckEmail()).toBe(false);
  });
});

// Getting back in. With no anonymous fallback and no second door, this email is the only thing
// between a forgotten password and an account nobody can open.
describe('resetting a password', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    mockUpdateUser.mockResolvedValue({ error: null });
  });

  it('asks for a link back to where the knitter is', async () => {
    await requestPasswordReset('  knitter@example.com  ');
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
      'knitter@example.com',
      expect.objectContaining({ redirectTo: 'https://knitwit.eu/account' }),
    );
  });

  // Saying "no account with that email" would be a free membership check for anybody working
  // through a list of guesses, and tells the knitter nothing they can act on — the useful answer is
  // the same either way: go and look in your inbox.
  it('says the same thing whether or not the address is registered', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: { message: 'User not found' } });
    expect(await requestPasswordReset('stranger@example.com')).toEqual({ ok: true });
  });

  it('sets the new password', async () => {
    expect(await setNewPassword('a-better-one')).toEqual({ ok: true });
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'a-better-one' });
  });

  it('says so when the new password is the old one', async () => {
    mockUpdateUser.mockResolvedValue({
      error: { message: 'New password should be different from the old password.' },
    });
    const result = await setNewPassword('same-as-before');
    expect(result).toEqual({
      ok: false,
      message: 'That is the password you already had. Choose a different one.',
    });
  });
});


// The one action with no undo.
describe('deleting an account', () => {
  beforeEach(() => jest.clearAllMocks());

  it('asks the function that holds the service role', async () => {
    mockInvoke.mockResolvedValue({ ok: true });
    expect(await deleteAccount()).toEqual({ ok: true });
    expect(mockInvoke).toHaveBeenCalledWith('delete-account', {}, expect.anything());
  });

  // The function refuses to half-delete, so a failure means the account is still whole. Reporting
  // it as gone would be the worst possible lie: the knitter stops looking for work that is still
  // there, or grieves work that was never lost.
  it('reports failure rather than assuming it worked', async () => {
    mockInvoke.mockRejectedValue(new Error('Some of your pictures could not be removed.'));
    expect(await deleteAccount()).toEqual({
      ok: false,
      message: 'Some of your pictures could not be removed.',
    });
  });
});
