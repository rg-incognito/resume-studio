import type { AiProviderId } from "@/lib/ai";
import { AI_REQUEST_TIMEOUT_MS } from "@/lib/ai/types";
import { GeminiModelUnavailableError } from "@/lib/ai/gemini";

function describeGeminiError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);

  if (message.includes("RESOURCE_EXHAUSTED") || message.includes('"code":429')) {
    const isDaily = message.includes("PerDay");
    return isDaily
      ? "Your Gemini API key hit its daily free-tier limit (20 requests/day for this model). It resets once a day — the \"retry in Ns\" the API reports doesn't apply to this limit. Wait for the reset, or enable billing on your Google AI Studio / Cloud project for higher limits (ai.google.dev/gemini-api/docs/rate-limits)."
      : "Your Gemini API key is being rate-limited (too many requests too quickly). Wait a bit and try again.";
  }
  if (
    message.includes("API_KEY_INVALID") ||
    message.includes("API key not valid") ||
    (message.includes('"code":400') && message.includes("API key"))
  ) {
    return "Your Gemini API key looks invalid or was rejected. Check it in Settings.";
  }
  if (message.includes('"code":403') || message.includes("PERMISSION_DENIED")) {
    return "Your Gemini API key doesn't have permission for this model. Check it in Settings.";
  }
  if (message.includes("GeminiModelUnavailableError") || message.includes("no working alternative")) {
    return "None of the Gemini models available to your API key could be reached right now. This can happen right after Google retires a model — try again in a moment, or check that your key has access to at least one Gemini model at ai.google.dev.";
  }
  if (message.includes('"code":404') && message.includes("no longer available")) {
    return "The Gemini model this app was configured to use has been retired by Google for your account. The app tried to automatically switch to a different available model — if you're seeing this, that also failed. Try again in a moment.";
  }
  if (message.includes("UNAVAILABLE") || message.includes('"code":503')) {
    return "Gemini is temporarily overloaded on Google's end (their own error calls this \"usually temporary\"). The app already retried a couple of times — wait a moment and try again.";
  }

  return message;
}

/** Anthropic and OpenAI's SDKs throw typed error classes exposing a real
 * numeric `.status`, unlike Gemini's stringified-JSON-in-message approach —
 * check that directly rather than string-matching. */
function getStatus(err: unknown): number | undefined {
  if (typeof err === "object" && err !== null && "status" in err) {
    const status = (err as { status: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}

function describeAnthropicOrOpenAiError(err: unknown, provider: "anthropic" | "openai"): string {
  const label = provider === "anthropic" ? "Anthropic" : "OpenAI";
  const consoleUrl = provider === "anthropic" ? "console.anthropic.com/settings/keys" : "platform.openai.com/api-keys";
  const status = getStatus(err);

  switch (status) {
    case 401:
      return `Your ${label} API key looks invalid or was rejected. Check it in Settings.`;
    case 403:
      return `Your ${label} API key doesn't have permission for this model. Check it in Settings.`;
    case 404:
      return `The ${label} model this app is configured to use isn't available for your account. Check your model access at ${consoleUrl}.`;
    case 429:
      return `Your ${label} API key is being rate-limited or has hit its usage/billing limit. Check your usage at ${consoleUrl}, or wait and try again.`;
    case 503:
      return `${label} is temporarily overloaded on their end. Wait a moment and try again.`;
    default:
      return err instanceof Error ? err.message : String(err);
  }
}

/** True for the SDKs' own timeout errors (Anthropic/OpenAI's `APIConnectionTimeoutError`,
 *  or a raw fetch `AbortError` from Gemini's client) once AI_REQUEST_TIMEOUT_MS elapses. */
function isTimeoutError(err: unknown): boolean {
  if (err instanceof Error && err.name === "APIConnectionTimeoutError") return true;
  if (err instanceof Error && err.name === "AbortError") return true;
  return err instanceof Error && /timed? ?out/i.test(err.message);
}

/**
 * Every provider SDK throws differently — Gemini's errors are a stringified
 * JSON blob inside Error.message, Anthropic/OpenAI throw typed error classes
 * with a real `.status`. Route handlers otherwise pass whichever raw shape
 * straight through to the client; this turns the common, actionable cases
 * into a plain sentence regardless of provider.
 */
export function describeAiError(err: unknown, provider: AiProviderId): string {
  if (isTimeoutError(err)) {
    const label = provider === "gemini" ? "Gemini" : provider === "anthropic" ? "Anthropic" : "OpenAI";
    return `${label} didn't respond within ${AI_REQUEST_TIMEOUT_MS / 1000}s, so the request was cancelled. This usually means a network problem reaching ${label}'s API from the server, not your prompt — try again in a moment.`;
  }
  if (provider === "gemini") return describeGeminiError(err);
  return describeAnthropicOrOpenAiError(err, provider);
}

/**
 * The raw, technical counterpart to describeAiError's plain-language
 * sentence — shown in a collapsed "Details" panel in the UI so the actual
 * failure (which model(s) were tried, HTTP status, raw SDK message) is
 * visible without needing server log access.
 */
export function rawAiErrorDetail(err: unknown, provider: AiProviderId): string {
  const lines = [`provider: ${provider}`];

  if (err instanceof GeminiModelUnavailableError) {
    lines.push(`models tried: ${err.attemptedModels.join(", ") || "(none)"}`);
  }
  const status = getStatus(err);
  if (status !== undefined) lines.push(`status: ${status}`);

  lines.push(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
  return lines.join("\n");
}
