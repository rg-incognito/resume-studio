import OpenAI from "openai";
import type { AiProvider, GenerateStructuredParams, GenerateTextParams } from "@/lib/ai/types";

const DEFAULT_MODEL = "gpt-5.1";

async function generateText({ prompt, apiKey }: GenerateTextParams): Promise<string> {
  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;

  const response = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("OpenAI returned an empty response");
  return text;
}

async function generateStructured({ prompt, apiKey, jsonSchema }: GenerateStructuredParams): Promise<unknown> {
  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;

  const response = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "response",
        // Non-strict: our zod schemas use .optional()/.default() throughout,
        // which don't satisfy OpenAI's strict-mode requirement that every
        // property be listed in `required`. Non-strict still returns valid
        // JSON; the caller's own zod .safeParse() is the real validation gate.
        strict: false,
        schema: jsonSchema as Record<string, unknown>,
      },
    },
  });

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("OpenAI returned an empty response");
  return JSON.parse(text);
}

export const openaiProvider: AiProvider = {
  id: "openai",
  generateText,
  generateStructured,
};
