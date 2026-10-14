import type { Session } from '@supabase/supabase-js';

import { invokeEdgeFunction } from '@/lib/edge-function';

import { captureRavelryToken } from './connect-session';

jest.mock('@/lib/edge-function', () => ({
  invokeEdgeFunction: jest.fn(() => Promise.resolve({ ok: true, stored: true })),
}));

const invoke = invokeEdgeFunction as jest.Mock;

function session(parts: {
  providerRefresh?: string | null;
  providerToken?: string | null;
  providers?: string[];
}): Session {
  return {
    provider_refresh_token: parts.providerRefresh ?? null,
    provider_token: parts.providerToken ?? null,
    user: { identities: (parts.providers ?? []).map((provider) => ({ provider })) },
  } as unknown as Session;
}

describe('captureRavelryToken', () => {
  beforeEach(() => invoke.mockClear());

  it('sends the token when a Ravelry session carries one', () => {
    captureRavelryToken(
      session({ providerRefresh: 'r3fr3sh', providerToken: 'acc3ss', providers: ['custom:ravelry'] }),
    );
    expect(invoke).toHaveBeenCalledWith(
      'ravelry-connect',
      { refresh_token: 'r3fr3sh', access_token: 'acc3ss' },
      { timeoutMs: 10_000, timeoutMessage: '' },
    );
  });

  it('does nothing when there is no provider refresh token', () => {
    captureRavelryToken(session({ providerRefresh: null, providers: ['custom:ravelry'] }));
    expect(invoke).not.toHaveBeenCalled();
  });

  it('does nothing when the refresh token is not a Ravelry one', () => {
    captureRavelryToken(session({ providerRefresh: 'r3fr3sh', providers: ['google'] }));
    expect(invoke).not.toHaveBeenCalled();
  });

  it('does nothing for a null session', () => {
    captureRavelryToken(null);
    expect(invoke).not.toHaveBeenCalled();
  });
});
