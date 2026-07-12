export const AI_PROVIDER_IDS = ["gemini", "anthropic", "openai"] as const;
export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

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

export interface AiProvider {
  id: AiProviderId;
  generateText(params: GenerateTextParams): Promise<string>;
  /** Returns the parsed JSON value — callers validate it against their own zod schema. */
  generateStructured(params: GenerateStructuredParams): Promise<unknown>;
}
