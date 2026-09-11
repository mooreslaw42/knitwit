import { getSupabase } from '@/lib/supabase';

// Shared plumbing for calling an Edge Function: the timeout, and digging the function's own error
// message out of the generic wrapper supabase-js throws.

export class EdgeFunctionTimeout extends Error {}

// Thrown when the caller stopped the request on purpose. Distinct from a timeout because there is
// nothing to apologise for and nothing to show — the screen just goes back to how it was.
export class EdgeFunctionAborted extends Error {}

// supabase-js hides the function's own error message behind a generic FunctionsHttpError; the
// useful text ("not configured on this server", "that pattern is too long") is in the body.
export async function readErrorBody(error: unknown): Promise<string | null> {
  const context = (error as { context?: unknown }).context;
  if (typeof context !== 'object' || context === null) return null;
  const response = context as { json?: () => Promise<unknown> };
  if (typeof response.json !== 'function') return null;
  try {
    const body = await response.json();
    const message = (body as Record<string, unknown> | null)?.error;
    return typeof message === 'string' ? message : null;
  } catch {
    return null;
  }
}

export async function invokeEdgeFunction(
  name: string,
  body: Record<string, unknown>,
  options: { timeoutMs: number; timeoutMessage: string; signal?: AbortSignal },
): Promise<unknown> {
  // Both the signal and the timeout are handed to invoke(), which aborts the underlying fetch.
  // That matters for more than tidiness: an abandoned read still costs money until the request
  // actually stops, so "stop" has to mean stop, not "ignore the answer".
  const { data, error } = await getSupabase().functions.invoke(name, {
    body,
    signal: options.signal,
    timeout: options.timeoutMs,
  });

  if (error) {
    // Our own abort wins the race to explain what happened.
    if (options.signal?.aborted) throw new EdgeFunctionAborted('Stopped.');
    if (isAbortLike(error)) throw new EdgeFunctionTimeout(options.timeoutMessage);
    const detail = await readErrorBody(error);
    throw new Error(
      detail ?? "Couldn't reach the pattern reader. Check your connection and retry.",
    );
  }
  return data as unknown;
}

// An aborted fetch surfaces differently across runtimes and supabase-js versions — sometimes as a
// DOMException named AbortError, sometimes wrapped in a FunctionsFetchError. Match on either
// rather than on one shape that might change.
function isAbortLike(error: unknown): boolean {
  const e = error as { name?: unknown; message?: unknown };
  if (e?.name === 'AbortError' || e?.name === 'TimeoutError') return true;
  return typeof e?.message === 'string' && /abort|timed?\s*out/i.test(e.message);
}
