import Anthropic from "@anthropic-ai/sdk";
import type { AiProvider, GenerateStructuredParams, GenerateTextParams } from "@/lib/ai/types";

const DEFAULT_MODEL = "claude-sonnet-5";
const MAX_TOKENS = 8192;

async function generateText({ prompt, apiKey }: GenerateTextParams): Promise<string> {
  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  const response = await client.messages.create({
    model,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock) throw new Error("Claude returned no text content");
  return textBlock.text;
}

/**
 * Claude has no native "respond in this JSON schema" mode, so structured
 * output is obtained via forced tool use: define one tool whose input_schema
 * is the schema we want, force tool_choice to that tool, and read the
 * already-parsed object straight off the returned tool_use block's .input.
 */
async function generateStructured({ prompt, apiKey, jsonSchema }: GenerateStructuredParams): Promise<unknown> {
  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  const response = await client.messages.create({
    model,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: prompt }],
    tools: [
      {
        name: "emit_result",
        description: "Emits the structured result requested in the prompt.",
        input_schema: jsonSchema as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: "emit_result" },
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse) throw new Error("Claude did not return structured output");
  return toolUse.input;
}

export const anthropicProvider: AiProvider = {
  id: "anthropic",
  generateText,
  generateStructured,
};
