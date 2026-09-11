// The provider seam.
//
// Everything above this line in the call stack talks about "a model that returns JSON matching a
// schema". Everything below is vendor-specific. AGENTS.md names GreenPT (EU Router) as the
// intended provider; we're on the Anthropic API for now, and this interface is what makes that a
// config change later rather than a rewrite. The rule GreenPT was there to protect — the model is
// only ever called server-side, never from the client — holds either way, and is the reason this
// file lives in an Edge Function and the API key is a Supabase secret.

export type ModelUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
};

export type ModelRequest = {
  // Stable across every call — the provider is expected to cache it if it can.
  system: string;
  // Varies per call.
  user: string;
  // JSON schema the response must satisfy.
  schema: unknown;
  model: string;
  maxTokens: number;
};

export type ModelResult = {
  // Raw JSON text. Schema-valid per `schema`, but still parsed and re-validated by the caller.
  text: string;
  model: string;
  usage: ModelUsage;
};

export type ModelProvider = {
  readonly name: string;
  readonly defaultModel: string;
  complete(req: ModelRequest): Promise<ModelResult>;
};

export const EMPTY_USAGE: ModelUsage = {
  input_tokens: 0,
  output_tokens: 0,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
};
