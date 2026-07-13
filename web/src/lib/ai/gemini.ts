import { GoogleGenAI, type GenerateContentParameters, type GenerateContentResponse } from "@google/genai";
import type { AiAttempt, AiProvider, GenerateStructuredParams, GenerateTextParams } from "@/lib/ai/types";
import { AI_REQUEST_TIMEOUT_MS } from "@/lib/ai/types";

const DEFAULT_MODEL = "gemini-flash-latest";

// Preferred by substring match, checked in order — cheaper/faster models
// first. Gemini's available model lineup changes over time (a hardcoded
// model id can start 404ing for reasons outside our control), so this is a
// *preference* for ranking whatever ai.models.list() actually returns right
// now, not a hardcoded model id.
const FALLBACK_PREFERENCE = ["flash-latest", "2.5-flash", "flash", "pro-latest", "pro"];

// Model names that support chat-style generateContent but aren't good fits
// here (vision-only, embeddings, TTS, image generation, music, robotics/
// agent/research specialty models, etc.) — excluded so fallback doesn't burn
// an attempt on something that will never return usable prose/JSON.
const EXCLUDE_PATTERN =
  /embedding|vision|image|tts|audio|video|aqa|veo|imagen|nano-banana|lyria|robotic|computer-use|deep-research|antigravity/i;

// Once the configured model 404s, walk down at most this many ranked
// fallback candidates before giving up — bounds worst-case latency (each
// unavailable-model attempt fails fast with a 404, so this is generous).
const FALLBACK_CANDIDATE_LIMIT = 8;

// Cache the first model that actually works per API key for the life of the
// process, so repeat requests from the same user don't re-discover on every
// call — only the first request after a model gets retired pays the
// discovery cost.
const workingModelCache = new Map<string, string>();

export class GeminiModelUnavailableError extends Error {
  attemptedModels: string[];

  constructor(message: string, attemptedModels: string[]) {
    super(message);
    this.name = "GeminiModelUnavailableError";
    this.attemptedModels = attemptedModels;
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

// Google's own error text for this calls it "usually temporary" — the model
// itself is fine, it's just overloaded right now, so this is handled by
// retrying the *same* model with a short backoff rather than by switching
// models like isModelUnavailableError does.
function isTransientOverloadError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes("UNAVAILABLE") || message.includes('"code":503');
}

const TRANSIENT_RETRY_DELAYS_MS = [500, 1500];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Lists every model this API key can call generateContent on (excluding the
 * ones already tried and non-text specialty models), ranked by
 * FALLBACK_PREFERENCE with everything else appended after, and capped at
 * FALLBACK_CANDIDATE_LIMIT.
 */
async function rankedFallbackCandidates(ai: GoogleGenAI, exclude: Set<string>): Promise<string[]> {
  const pager = await ai.models.list();
  const candidates: string[] = [];
  for await (const model of pager) {
    const name = model.name?.replace(/^models\//, "");
    if (!name || exclude.has(name) || EXCLUDE_PATTERN.test(name)) continue;
    const actions = model.supportedActions ?? [];
    if (actions.length && !actions.includes("generateContent")) continue;
    candidates.push(name);
  }

  const ranked: string[] = [];
  const remaining = new Set(candidates);
  for (const pref of FALLBACK_PREFERENCE) {
    for (const c of candidates) {
      if (remaining.has(c) && c.includes(pref)) {
        ranked.push(c);
        remaining.delete(c);
      }
    }
  }
  for (const c of candidates) if (remaining.has(c)) ranked.push(c);

  return ranked.slice(0, FALLBACK_CANDIDATE_LIMIT);
}

/**
 * Wraps ai.models.generateContent: tries the configured/cached model first,
 * then — only if that specific model is unavailable for this key — walks
 * down a ranked list of every other model the key can actually reach,
 * dropping one at a time until one works. Throws GeminiModelUnavailableError
 * (carrying every model tried) if none of them do.
 */
async function generateContentWithFallback(
  ai: GoogleGenAI,
  apiKey: string,
  params: GenerateContentParameters,
): Promise<{ response: GenerateContentResponse; modelUsed: string; attempted: AiAttempt[] }> {
  const attempted: AiAttempt[] = [];
  const tried = new Set<string>();

  async function attempt(
    model: string,
  ): Promise<{ response: GenerateContentResponse; modelUsed: string; attempted: AiAttempt[] } | null> {
    tried.add(model);
    for (let retry = 0; ; retry++) {
      console.error(`[gemini-trace] calling generateContent model=${model} retry=${retry} t=${Date.now()}`);
      try {
        const response = await ai.models.generateContent({ ...params, model });
        console.error(`[gemini-trace] SUCCESS model=${model} t=${Date.now()}`);
        workingModelCache.set(apiKey, model);
        attempted.push({ model, ok: true });
        return { response, modelUsed: model, attempted };
      } catch (err) {
        console.error(`[gemini-trace] CAUGHT model=${model} retry=${retry} t=${Date.now()} err=${err instanceof Error ? err.message : String(err)}`);
        if (isTransientOverloadError(err) && retry < TRANSIENT_RETRY_DELAYS_MS.length) {
          console.error(`[gemini-trace] sleeping ${TRANSIENT_RETRY_DELAYS_MS[retry]}ms before retry`);
          await sleep(TRANSIENT_RETRY_DELAYS_MS[retry]);
          continue;
        }
        if (!isTransientOverloadError(err) && !isModelUnavailableError(err)) throw err;
        attempted.push({ model, ok: false, error: err instanceof Error ? err.message : String(err) });
        return null;
      }
    }
  }

  const firstModel = workingModelCache.get(apiKey) ?? params.model;
  console.error(`[gemini-trace] START firstModel=${firstModel} t=${Date.now()}`);
  const first = await attempt(firstModel);
  if (first) return first;

  console.error(`[gemini-trace] listing fallback candidates t=${Date.now()}`);
  const candidates = await rankedFallbackCandidates(ai, tried);
  console.error(`[gemini-trace] got ${candidates.length} candidates: ${candidates.join(", ")} t=${Date.now()}`);
  for (const candidate of candidates) {
    const result = await attempt(candidate);
    if (result) return result;
  }

  throw new GeminiModelUnavailableError(
    `Tried ${attempted.length} Gemini model(s) and none worked for this API key: ${attempted.map((a) => a.model).join(", ")}.`,
    attempted.map((a) => a.model),
  );
}

async function generateText({ prompt, apiKey }: GenerateTextParams) {
  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: AI_REQUEST_TIMEOUT_MS } });
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  const { response, modelUsed, attempted } = await generateContentWithFallback(ai, apiKey, {
    model,
    contents: prompt,
  });
  const text = response.text;
  if (!text) throw new Error("Gemini returned an empty response");
  return { text, modelUsed, attempted };
}

async function generateStructured({ prompt, apiKey, jsonSchema }: GenerateStructuredParams) {
  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: AI_REQUEST_TIMEOUT_MS } });
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  const { response, modelUsed, attempted } = await generateContentWithFallback(ai, apiKey, {
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: jsonSchema,
    },
  });
  const text = response.text;
  if (!text) throw new Error("Gemini returned an empty response");
  return { data: JSON.parse(text), modelUsed, attempted };
}

export const geminiProvider: AiProvider = {
  id: "gemini",
  generateText,
  generateStructured,
};
