import { GoogleGenAI, type GenerateContentParameters, type GenerateContentResponse } from "@google/genai";
import type { AiProvider, GenerateStructuredParams, GenerateTextParams } from "@/lib/ai/types";

const DEFAULT_MODEL = "gemini-flash-latest";

// Preferred by substring match, checked in order — cheaper/faster models
// first. Gemini's available model lineup changes over time (a hardcoded
// model id can start 404ing for reasons outside our control), so this is a
// *preference* for picking among whatever ai.models.list() actually returns
// right now, not a hardcoded model id.
const FALLBACK_PREFERENCE = ["flash-latest", "2.5-flash", "flash", "pro-latest", "pro"];

// Model names that support chat-style generateContent but aren't good fits
// here (vision-only, embeddings, TTS, image generation, etc.).
const EXCLUDE_PATTERN = /embedding|vision|image|tts|audio|video|aqa|veo|imagen/i;

// Cache the first model that actually works per API key for the life of the
// process, so repeat requests from the same user don't re-discover on every
// call — only the first request after a model gets retired pays the
// discovery cost.
const workingModelCache = new Map<string, string>();

export class GeminiModelUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiModelUnavailableError";
  }
}

function isModelUnavailableError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes('"code":404') ||
    message.includes("NOT_FOUND") ||
    message.includes("is no longer available") ||
    message.includes("was not found")
  );
}

async function discoverFallbackModel(ai: GoogleGenAI, tried: Set<string>): Promise<string | null> {
  const pager = await ai.models.list();
  const candidates: string[] = [];
  for await (const model of pager) {
    const name = model.name?.replace(/^models\//, "");
    if (!name || tried.has(name) || EXCLUDE_PATTERN.test(name)) continue;
    const actions = model.supportedActions ?? [];
    if (actions.length && !actions.includes("generateContent")) continue;
    candidates.push(name);
  }
  if (candidates.length === 0) return null;

  for (const pref of FALLBACK_PREFERENCE) {
    const match = candidates.find((c) => c.includes(pref));
    if (match) return match;
  }
  return candidates[0];
}

/**
 * Wraps ai.models.generateContent, automatically discovering and retrying
 * with a different model (via ai.models.list()) if the configured model has
 * been retired/deprecated for this account. Throws GeminiModelUnavailableError
 * with a clear message if no working model can be found at all.
 */
async function generateContentWithFallback(
  ai: GoogleGenAI,
  apiKey: string,
  params: GenerateContentParameters,
): Promise<GenerateContentResponse> {
  const tried = new Set<string>();
  let model = workingModelCache.get(apiKey) ?? params.model;

  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    tried.add(model);
    try {
      const response = await ai.models.generateContent({ ...params, model });
      workingModelCache.set(apiKey, model);
      return response;
    } catch (err) {
      if (!isModelUnavailableError(err)) throw err;

      const fallback = await discoverFallbackModel(ai, tried);
      if (!fallback) {
        throw new GeminiModelUnavailableError(
          `The configured Gemini model ("${params.model}") is unavailable, and no working alternative could be found for this API key. Check that the key is valid and has access to at least one Gemini model at ai.google.dev.`,
        );
      }
      model = fallback;
    }
  }
  throw new GeminiModelUnavailableError(`Tried ${tried.size} Gemini models and none worked for this API key.`);
}

async function generateText({ prompt, apiKey }: GenerateTextParams): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  const response = await generateContentWithFallback(ai, apiKey, { model, contents: prompt });
  const text = response.text;
  if (!text) throw new Error("Gemini returned an empty response");
  return text;
}

async function generateStructured({ prompt, apiKey, jsonSchema }: GenerateStructuredParams): Promise<unknown> {
  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  const response = await generateContentWithFallback(ai, apiKey, {
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: jsonSchema,
    },
  });
  const text = response.text;
  if (!text) throw new Error("Gemini returned an empty response");
  return JSON.parse(text);
}

export const geminiProvider: AiProvider = {
  id: "gemini",
  generateText,
  generateStructured,
};
