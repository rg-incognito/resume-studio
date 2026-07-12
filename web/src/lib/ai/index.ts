import type { AiProvider, AiProviderId } from "@/lib/ai/types";
import { geminiProvider } from "@/lib/ai/gemini";
import { anthropicProvider } from "@/lib/ai/anthropic";
import { openaiProvider } from "@/lib/ai/openai";

export type { AiProvider, AiProviderId } from "@/lib/ai/types";
export { AI_PROVIDER_IDS, PROVIDER_INFO } from "@/lib/ai/types";

const PROVIDERS: Record<AiProviderId, AiProvider> = {
  gemini: geminiProvider,
  anthropic: anthropicProvider,
  openai: openaiProvider,
};

export function getProvider(id: AiProviderId): AiProvider {
  return PROVIDERS[id];
}
