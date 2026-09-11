import { getSupabase } from '@/lib/supabase';

// Shared plumbing for calling an Edge Function: the timeout, and digging the function's own error
// message out of the generic wrapper supabase-js throws.

export class EdgeFunctionTimeout extends Error {}

// supabase-js's invoke() takes no AbortSignal, so this races the call rather than cancelling it.
// The request may still finish on the server — which is fine, since nothing is applied until the
// knitter accepts it — but the screen stops waiting. Without this a hung function leaves a
// spinner turning with no way out, which is worse than any error message.
async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new EdgeFunctionTimeout(message)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

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
  options: { timeoutMs: number; timeoutMessage: string },
): Promise<unknown> {
  const call = getSupabase()
    .functions.invoke(name, { body })
    .then(async ({ data, error }) => {
      if (error) {
        const detail = await readErrorBody(error);
        throw new Error(
          detail ?? "Couldn't reach the pattern reader. Check your connection and retry.",
        );
      }
      return data as unknown;
    });

  return await withTimeout(call, options.timeoutMs, options.timeoutMessage);
}
