import { z } from "zod";
import { atsReportSchema, type AtsReport } from "@/lib/schemas/atsCheck";
import { getProvider, type AiProviderId } from "@/lib/ai";

const REPORT_JSON_SCHEMA = z.toJSONSchema(atsReportSchema);

const SECTION_CANDIDATES = [
  "summary",
  "objective",
  "experience",
  "work experience",
  "employment",
  "education",
  "skills",
  "technical skills",
  "projects",
  "certifications",
  "achievements",
  "awards",
  "publications",
];

/**
 * Facts we can check mechanically rather than asking the model to guess —
 * these are handed to Gemini as ground truth for the Formatting &
 * Parseability category, since an LLM can't reliably tell "this text looks
 * garbled because the PDF used a multi-column table" from prose alone.
 */
function deterministicSignals(text: string, totalPages: number) {
  const hasEmail = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text);
  const hasPhone = /(\+?\d[\d\s().-]{7,}\d)/.test(text);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const lower = text.toLowerCase();
  const sections = SECTION_CANDIDATES.filter((s) => lower.includes(s));
  const weirdCharRatio =
    (text.match(/[^\x09\x0A\x0D\x20-\x7E]/g)?.length ?? 0) / Math.max(text.length, 1);

  return { hasEmail, hasPhone, wordCount, totalPages, sections, weirdCharRatio };
}

function buildPrompt(
  resumeText: string,
  jobDescription: string | undefined,
  signals: ReturnType<typeof deterministicSignals>,
) {
  const jdBlock = jobDescription
    ? `JOB DESCRIPTION:\n"""\n${jobDescription}\n"""\n`
    : `No job description was provided — score "Keyword Match" generically against what's typical for this resume's own apparent target role, rather than against a specific posting.\n`;

  return `You are an ATS (Applicant Tracking System) resume auditor. Score the
RESUME below the way real ATS parsers and recruiters evaluate resumes, and
produce a specific, actionable list of changes.

MECHANICAL FACTS about this resume (already verified — trust these, don't
re-derive them):
- Contact email detected: ${signals.hasEmail ? "yes" : "no"}
- Phone number detected: ${signals.hasPhone ? "yes" : "no"}
- Page count: ${signals.totalPages}
- Word count: ${signals.wordCount}
- Section headers detected: ${signals.sections.length ? signals.sections.join(", ") : "none clearly detected"}
- Text extraction quality: ${
    signals.weirdCharRatio > 0.02
      ? "poor — likely a scanned image, or a graphical/multi-column layout that real ATS parsers will also mangle"
      : "clean — the PDF's text layer is machine-readable"
  }

Score these categories, each 0-100:
1. "Formatting & Parseability" — based on the mechanical facts above: standard
   section headers, machine-readable text, reasonable length (ideally 1 page
   for under ~8 years of experience, up to 2 pages beyond that), contact info
   present, no signs of parser-breaking tables/columns/graphics.
2. "Keyword Match" — coverage of the required skills, tools, and
   qualifications from the job description (or, if none given, from the
   resume's own apparent target role).
3. "Quantified Impact" — the proportion of bullets that state a concrete
   number, metric, or outcome versus vague duty statements.
4. "Action Verbs & Clarity" — strong, specific action verbs opening each
   bullet (not "responsible for", "helped", "worked on"), concise phrasing.
5. "Structure & Completeness" — logical section order, no sections missing
   for this candidate's apparent career stage, consistent date formatting.
Each category's "summary" must be ONE short sentence (under 25 words) — do
not write a paragraph.

overallScore: a weighted average across the categories that reflects real
ATS + recruiter impact (weight Keyword Match higher when a job description
is given).

changes: the most impactful concrete edits, ranked by pointsImpact
descending. For each one:
- area: which category it improves
- current: the EXACT phrase copied from the resume text below (quote it
  verbatim — never invent text that isn't present)
- suggested: your exact rewritten replacement
- reason: ONE short sentence (under 20 words) on why this helps ATS scoring
  or recruiter read
- pointsImpact: your estimate (0-20) of how many overall points this single
  change is worth
Include at least 3 and at most 10 changes.

strengths: 2-4 short bullets (under 20 words each) on what the resume
already does well.

${jdBlock}
RESUME TEXT (extracted from the candidate's PDF):
"""
${resumeText}
"""`;
}

export async function analyzeAts({
  resumeText,
  totalPages,
  jobDescription,
  apiKey,
  provider,
}: {
  resumeText: string;
  totalPages: number;
  jobDescription?: string;
  apiKey: string;
  provider: AiProviderId;
}): Promise<AtsReport> {
  const signals = deterministicSignals(resumeText, totalPages);

  const result = await getProvider(provider).generateStructured({
    prompt: buildPrompt(resumeText, jobDescription, signals),
    apiKey,
    jsonSchema: REPORT_JSON_SCHEMA,
  });

  const parsed = atsReportSchema.safeParse(clampStringLengths(result));
  if (!parsed.success) {
    throw new Error("The ATS analysis didn't match the expected shape");
  }
  return parsed.data;
}

/**
 * Gemini's structured output treats JSON Schema maxLength as a soft hint,
 * not a hard cap, and occasionally overshoots it. Clamp raw string fields to
 * the schema's limits before validation so a slightly verbose sentence
 * doesn't fail the whole report.
 */
function clampStringLengths(raw: unknown): unknown {
  if (raw === null || typeof raw !== "object") return raw;
  const obj = raw as Record<string, unknown>;

  const clamp = (val: unknown, max: number) =>
    typeof val === "string" && val.length > max ? val.slice(0, max) : val;

  if (Array.isArray(obj.categories)) {
    obj.categories = obj.categories.map((c) =>
      c && typeof c === "object"
        ? { ...c, summary: clamp((c as Record<string, unknown>).summary, 600) }
        : c,
    );
  }
  if (Array.isArray(obj.changes)) {
    obj.changes = obj.changes.map((c) => {
      if (!c || typeof c !== "object") return c;
      const change = c as Record<string, unknown>;
      return {
        ...change,
        area: clamp(change.area, 120),
        current: clamp(change.current, 800),
        suggested: clamp(change.suggested, 800),
        reason: clamp(change.reason, 500),
      };
    });
  }
  if (Array.isArray(obj.strengths)) {
    obj.strengths = obj.strengths.map((s) => clamp(s, 400));
  }
  return obj;
}
