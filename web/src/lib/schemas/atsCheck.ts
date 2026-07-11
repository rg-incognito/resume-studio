import { z } from "zod";

// Gemini's structured output doesn't reliably honor JSON Schema maxLength —
// it treats these as soft guidance, not a hard cap, so limits here are kept
// generous (headroom over what the prompt asks for) rather than tight. The
// prompt is the primary lever for conciseness; these are a safety net against
// pathological output, not the enforcement mechanism.
export const atsChangeSchema = z.object({
  area: z.string().max(120),
  current: z.string().max(800),
  suggested: z.string().max(800),
  reason: z.string().max(500),
  pointsImpact: z.number().min(0).max(20),
});

export const atsCategorySchema = z.object({
  name: z.string().max(60),
  score: z.number().min(0).max(100),
  summary: z.string().max(600),
});

export const atsReportSchema = z.object({
  overallScore: z.number().min(0).max(100),
  categories: z.array(atsCategorySchema).min(1),
  changes: z.array(atsChangeSchema).default([]),
  strengths: z.array(z.string().max(400)).default([]),
});

export type AtsChange = z.infer<typeof atsChangeSchema>;
export type AtsCategory = z.infer<typeof atsCategorySchema>;
export type AtsReport = z.infer<typeof atsReportSchema>;
