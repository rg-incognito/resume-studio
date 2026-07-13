export const AI_PROVIDER_IDS = ["gemini", "anthropic", "openai"] as const;
export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

/**
 * Ceiling on how long a single outbound call to a provider's API is allowed
 * to hang before we abort it. Without this, a stalled connection (bad
 * egress, DNS, provider incident) hangs until the SDK's own default (which
 * for some SDKs is effectively unbounded), leaving the request stuck with no
 * error at all. Generous because full resume generation with a large model
 * genuinely can take tens of seconds.
 */
export const AI_REQUEST_TIMEOUT_MS = 60_000;

/**
 * Static display metadata for the Settings UI. Lives here (not index.ts) so
 * client components can import it without pulling in index.ts's provider
 * adapters — those import the Gemini/Anthropic/OpenAI server SDKs, which
 * must never end up in a client bundle.
 */
export const PROVIDER_INFO: Record<AiProviderId, { label: string; keyUrl: string; keyPlaceholder: string }> = {
  gemini: {
    label: "Gemini",
    keyUrl: "https://aistudio.google.com/apikey",
    keyPlaceholder: "Paste your Gemini API key",
  },
  anthropic: {
    label: "Anthropic (Claude)",
    keyUrl: "https://console.anthropic.com/settings/keys",
    keyPlaceholder: "Paste your Anthropic API key",
  },
  openai: {
    label: "OpenAI (ChatGPT)",
    keyUrl: "https://platform.openai.com/api-keys",
    keyPlaceholder: "Paste your OpenAI API key",
  },
};

export interface GenerateTextParams {
  prompt: string;
  apiKey: string;
}

export interface GenerateStructuredParams {
  prompt: string;
  apiKey: string;
  /** JSON Schema (as produced by z.toJSONSchema()) describing the desired output shape. */
  jsonSchema: object;
}

/** One model this call tried, in order. `error` is set only when `ok` is false. */
export interface AiAttempt {
  model: string;
  ok: boolean;
  error?: string;
}

/**
 * Surfaced alongside every successful call so the UI can show which model
 * actually answered — useful for Gemini in particular, where the configured
 * model can silently fail over to a different one when Google retires it for
 * a given key.
 */
export interface AiCallMeta {
  modelUsed: string;
  attempted: AiAttempt[];
}

export interface AiProvider {
  id: AiProviderId;
  generateText(params: GenerateTextParams): Promise<{ text: string } & AiCallMeta>;
  /** `data` is the parsed JSON value — callers validate it against their own zod schema. */
  generateStructured(params: GenerateStructuredParams): Promise<{ data: unknown } & AiCallMeta>;
}
