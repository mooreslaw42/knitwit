import { greenptProvider, isRetryableStatus, retryDelayMs } from './provider-greenpt.ts';
import type { ModelRequest } from './provider.ts';

// The Edge Function is Deno and is excluded from `tsc` (see tsconfig), but this file is plain
// TypeScript over `fetch` — no Deno globals, no npm: specifiers — so Jest runs it like any other.
// Worth having: the retry it covers only fires on a bad day, which is exactly when nobody is
// watching.

const request: ModelRequest = {
  system: 'system',
  user: 'user',
  schema: { type: 'object' },
  model: 'glm-5.2', // the provider's current default; the fallback is the other one
  maxTokens: 100,
};

const ok = () =>
  new Response(JSON.stringify({ model: 'glm-5.3-flash', choices: [{ message: { content: '{"a":1}' } }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const fail = (status: number, headers: Record<string, string> = {}) =>
  new Response('503 The model provider encountered an error. Please try again.', {
    status,
    headers,
  });

describe('which GreenPT failures are worth retrying', () => {
  it('retries the ones that mean “same request, later”', () => {
    for (const status of [408, 409, 429, 500, 502, 503, 504]) {
      expect(isRetryableStatus(status)).toBe(true);
    }
  });

  it('does not retry the ones that mean “not this request”', () => {
    for (const status of [400, 401, 403, 404, 422, 501]) {
      expect(isRetryableStatus(status)).toBe(false);
    }
  });
});

describe('how long to wait', () => {
  it('backs off exponentially, jittered', () => {
    // Full jitter, so the stated delay is a ceiling. random() at 1 gives that ceiling.
    expect(retryDelayMs(1, null, () => 1)).toBe(500);
    expect(retryDelayMs(2, null, () => 1)).toBe(1000);
    expect(retryDelayMs(3, null, () => 1)).toBe(2000);
    expect(retryDelayMs(1, null, () => 0)).toBe(0);
    expect(retryDelayMs(2, null, () => 0.5)).toBe(500);
  });

  it('never waits longer than the cap, however many attempts', () => {
    expect(retryDelayMs(20, null, () => 1)).toBe(4000);
  });

  it('does as a Retry-After in seconds asks', () => {
    expect(retryDelayMs(1, '2', () => 1)).toBe(2000);
  });

  it('caps a Retry-After that asks for longer than we are willing to hold the request', () => {
    expect(retryDelayMs(1, '600', () => 1)).toBe(4000);
  });

  it('understands the HTTP-date form too', () => {
    const at = new Date(Date.now() + 2000).toUTCString();
    expect(retryDelayMs(1, at, () => 1)).toBeGreaterThan(500);
  });

  it('ignores a Retry-After it cannot read, rather than waiting zero or forever', () => {
    expect(retryDelayMs(2, 'soon', () => 1)).toBe(1000);
  });
});

describe('a GreenPT call that hits a transient failure', () => {
  const realFetch = global.fetch;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    warn.mockRestore();
    global.fetch = realFetch;
  });

  // The retries sleep, so the promise has to be driven forward past each backoff. Well past the
  // longest the policy can ask for, so the test never depends on which jitter came up.
  const settle = async <T,>(promise: Promise<T>): Promise<T> => {
    const settled = promise.then(
      (value) => ({ ok: true as const, value }),
      (error) => ({ ok: false as const, error }),
    );
    await jest.advanceTimersByTimeAsync(60_000);
    const result = await settled;
    if (!result.ok) throw result.error;
    return result.value;
  };

  it('recovers when the second attempt succeeds', async () => {
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(() => Promise.resolve(fail(503)))
      .mockImplementationOnce(() => Promise.resolve(ok()));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await settle(greenptProvider('key').complete(request));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.text).toBe('{"a":1}');
  });

  // The reported failure: "Couldn't read that pattern: GreenPT returned 503: 503 The model
  // provider encountered an error." One blip used to end a whole document import.
  it('gives up and reports the provider’s own status once nothing works', async () => {
    const fetchMock = jest.fn().mockImplementation(() => Promise.resolve(fail(503)));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(settle(greenptProvider('key').complete(request))).rejects.toThrow(
      /GreenPT returned 503/,
    );
    // Two on the default, then two more on the other model.
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  // Measured on the day: whichever of the two is unwell, the other answers. The fallback is
  // "try the other model", so this test does not care which name is currently primary.
  it('moves to the other model when the default is the thing that is down', async () => {
    const bodies: string[] = [];
    const fetchMock = jest.fn().mockImplementation((_url: string, init: { body: string }) => {
      bodies.push(init.body);
      const model = JSON.parse(init.body).model as string;
      return Promise.resolve(model === request.model ? fail(503) : ok());
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await settle(greenptProvider('key').complete(request));

    expect(result.text).toBe('{"a":1}');
    const tried = bodies.map((b) => JSON.parse(b).model);
    expect(tried.slice(0, 2)).toEqual([request.model, request.model]);
    expect(tried[2]).not.toBe(request.model);
  });

  it('leaves a pinned model pinned, rather than answering as a model nobody asked for', async () => {
    const fetchMock = jest.fn().mockImplementation(() => Promise.resolve(fail(503)));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      settle(greenptProvider('key').complete({ ...request, model: 'some-pinned-model' })),
    ).rejects.toThrow(/GreenPT returned 503/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // The regression the knitter actually felt: a provider that stopped answering, retried with no
  // clock, turned a slow import into one that never came back.
  it('gives every attempt a leash so a hanging provider cannot stall the import', async () => {
    const fetchMock = jest.fn().mockImplementation((_url: string, init: { signal?: AbortSignal }) => {
      expect(init.signal).toBeInstanceOf(AbortSignal);
      return Promise.resolve(ok());
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await settle(greenptProvider('key').complete(request));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not reach for the fallback when the request itself is the problem', async () => {
    const fetchMock = jest.fn().mockImplementation(() => Promise.resolve(fail(400)));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(settle(greenptProvider('key').complete(request))).rejects.toThrow(
      /GreenPT returned 400/,
    );
    // The json_object probe, and nothing beyond it.
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it('retries a dropped connection the same way', async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new TypeError('network error'))
      .mockResolvedValueOnce(ok());
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await settle(greenptProvider('key').complete(request));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.text).toBe('{"a":1}');
  });

  it('does not retry a request the provider will refuse every time', async () => {
    const fetchMock = jest.fn().mockImplementation(() => Promise.resolve(fail(401)));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(settle(greenptProvider('key').complete(request))).rejects.toThrow(
      /GreenPT returned 401/,
    );
    // Once, plus the one-off json_object probe — never three.
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(2);
  });
});
