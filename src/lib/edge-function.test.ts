import {
  EdgeFunctionAborted,
  EdgeFunctionTimeout,
  invokeEdgeFunction,
  readErrorBody,
} from '@/lib/edge-function';

const mockInvoke = jest.fn();
jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({ functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } }),
}));

// Every AI call in the app goes through this one function, and it was the only module in the
// project at zero per cent covered. What it decides is what a knitter is told when something goes
// wrong: a server that is down, a read they stopped themselves, and a refusal with a real reason
// in it all arrive here as the same opaque wrapper, and all three read differently on screen.

const options = { timeoutMs: 1_000, timeoutMessage: 'That took too long.' };

// supabase-js hides the function's own message behind a generic error; the text is in the body.
const wrapped = (message: string) => ({ context: { json: async () => ({ error: message }) } });

beforeEach(() => mockInvoke.mockReset());

describe('invokeEdgeFunction', () => {
  it('hands back what the function returned', async () => {
    mockInvoke.mockResolvedValue({ data: { rows: [1, 2] }, error: null });
    expect(await invokeEdgeFunction('parse-pattern', { task: 'rows' }, options)).toEqual({
      rows: [1, 2],
    });
  });

  it('passes the body, the signal and the timeout through', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });
    const signal = new AbortController().signal;
    await invokeEdgeFunction('parse-pattern', { task: 'rows' }, { ...options, signal });

    expect(mockInvoke).toHaveBeenCalledWith('parse-pattern', {
      body: { task: 'rows' },
      signal,
      // Handed to invoke rather than raced outside it: an abandoned read costs money until the
      // request actually stops, so "stop" has to mean stop.
      timeout: 1_000,
    });
  });

  // The useful half of an error. Without this every refusal reads as "couldn't reach the server",
  // including the ones that say exactly what was wrong with the pattern.
  it("digs the function's own message out of the wrapper", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: wrapped('That pattern is too long.') });
    await expect(invokeEdgeFunction('parse-pattern', {}, options)).rejects.toThrow(
      'That pattern is too long.',
    );
  });

  it('falls back to something a knitter can act on when there is no message', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('Failed to fetch') });
    await expect(invokeEdgeFunction('parse-pattern', {}, options)).rejects.toThrow(
      /Check your connection/,
    );
  });

  it('calls a timeout a timeout, however the runtime spells it', async () => {
    for (const error of [
      { name: 'AbortError', message: 'The operation was aborted' },
      { name: 'TimeoutError', message: 'signal timed out' },
      { name: 'FunctionsFetchError', message: 'Request timed out' },
      { name: 'FunctionsFetchError', message: 'aborted' },
    ]) {
      mockInvoke.mockResolvedValue({ data: null, error });
      await expect(invokeEdgeFunction('parse-pattern', {}, options)).rejects.toBeInstanceOf(
        EdgeFunctionTimeout,
      );
    }
  });

  it("carries the caller's own wording on a timeout", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { name: 'AbortError', message: 'aborted' } });
    await expect(
      invokeEdgeFunction('parse-pattern', {}, { ...options, timeoutMessage: 'Retake the photo.' }),
    ).rejects.toThrow('Retake the photo.');
  });

  // Stopping on purpose is not a failure: the screen goes back to how it was and says nothing.
  it('tells a deliberate stop apart from a timeout', async () => {
    const controller = new AbortController();
    controller.abort();
    mockInvoke.mockResolvedValue({ data: null, error: { name: 'AbortError', message: 'aborted' } });

    await expect(
      invokeEdgeFunction('parse-pattern', {}, { ...options, signal: controller.signal }),
    ).rejects.toBeInstanceOf(EdgeFunctionAborted);
  });
});

describe('readErrorBody', () => {
  it('reads the message out of a wrapped error', async () => {
    expect(await readErrorBody(wrapped('No rows to convert.'))).toBe('No rows to convert.');
  });

  it('gives nothing back rather than guessing', async () => {
    expect(await readErrorBody(new Error('plain'))).toBeNull();
    expect(await readErrorBody({ context: null })).toBeNull();
    expect(await readErrorBody({ context: {} })).toBeNull();
    // A body that is not JSON, and one whose error is not a string.
    expect(
      await readErrorBody({
        context: {
          json: async () => {
            throw new Error('not json');
          },
        },
      }),
    ).toBeNull();
    expect(await readErrorBody({ context: { json: async () => ({ error: 42 }) } })).toBeNull();
  });
});
