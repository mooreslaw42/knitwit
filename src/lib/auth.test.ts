import { accountStateOf } from '@/lib/auth';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

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
