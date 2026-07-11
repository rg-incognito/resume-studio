/**
 * The @google/genai SDK throws its errors as a stringified JSON blob inside
 * Error.message (e.g. `ApiError: {"error":{"code":429,...}}`). Route
 * handlers otherwise pass that raw blob straight through to the client.
 * This turns the common, actionable cases into a plain sentence.
 */
export function describeGeminiError(err: unknown): string {
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

  return message;
}
