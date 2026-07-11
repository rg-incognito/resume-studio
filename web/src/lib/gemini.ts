import { z } from "zod";
import { GoogleGenAI } from "@google/genai";
import { profileSchema, type ProfileInput } from "@/lib/schemas/profile";
import { generateContentWithFallback } from "@/lib/geminiModel";

const DEFAULT_MODEL = "gemini-flash-latest";
const PROFILE_JSON_SCHEMA = z.toJSONSchema(profileSchema);

const BEGIN_DOCUMENT = "\\begin{document}";
const END_DOCUMENT = "\\end{document}";

/**
 * Splits a template into its preamble (everything through \begin{document})
 * and its body (everything between \begin{document} and \end{document}).
 * Gemini only ever generates a replacement body — the preamble (packages,
 * macros, \titleformat, colors) is spliced back in verbatim afterwards, so a
 * hallucinated preamble (e.g. retyping "dvipsnames" as "dvipsNames") can
 * never break compilation, no matter what the model outputs.
 */
function splitTemplate(templateSource: string): { preamble: string; body: string } {
  const beginIdx = templateSource.indexOf(BEGIN_DOCUMENT);
  const endIdx = templateSource.indexOf(END_DOCUMENT);
  if (beginIdx === -1 || endIdx === -1) {
    throw new Error("Template is missing \\begin{document} or \\end{document}");
  }
  return {
    preamble: templateSource.slice(0, beginIdx + BEGIN_DOCUMENT.length),
    body: templateSource.slice(beginIdx + BEGIN_DOCUMENT.length, endIdx),
  };
}

function buildPrompt(profile: ProfileInput, templateBody: string, jobDescription?: string) {
  const tailoringBlock = jobDescription
    ? `\nTAILORING INSTRUCTIONS:
The candidate is applying to this job. Reorder and reweight bullets (do not
invent experience) so the most relevant achievements and keywords from the
job description appear first within each section, for ATS keyword alignment:

"""
${jobDescription}
"""
`
    : "";

  return `You are filling in the body of a candidate's resume, written in LaTeX.

Below is a REFERENCE BODY: the content between \\begin{document} and
\\end{document} of a LaTeX resume. Its macros (\\resumeItem,
\\resumeSubheading, \\resumeProjectHeading, etc.), section order, and visual
structure define the exact format to produce. Its current text belongs to a
different person — treat it purely as a formatting example. Do NOT include
the preamble, \\begin{document}, or \\end{document} in your output — only the
body content that goes between them.

Produce replacement body content that:
- Keeps the same macros, section order, and overall visual structure as the
  reference body.
- Replaces all content (name, contact info, experience, education, skills,
  projects, links, achievements) with the CANDIDATE PROFILE below.
- Omits any section entirely if the profile has no data for it (e.g. no
  certifications), rather than leaving placeholder text.
- Writes concise, resume-appropriate bullet phrasing from the profile's raw
  bullets/fields — do not fabricate facts not present in the profile.
- Reproduces every URL, email address, and number from the profile
  character-for-character (copy, don't retype from memory) — these must
  never be paraphrased, corrected, or altered in any way.
- Escapes every LaTeX special character that appears in ordinary text —
  % & # $ _ ~ ^ \\ — with a backslash (e.g. a bullet mentioning "66%" must be
  written as "66\\%", "R&D" as "R\\&D", "C#" as "C\\#", "50k users" stays as
  is, but "$50k" must be written "\\$50k"). This still applies to numbers and
  symbols you're reproducing character-for-character: keep the exact digits
  and characters, just add the required escape backslash. An unescaped %, &,
  #, $, or _ in body text will break the document, so check every bullet
  before finishing. Do NOT escape characters inside \\href{...}{...} URLs.
${tailoringBlock}
CANDIDATE PROFILE (JSON):
${JSON.stringify(profile, null, 2)}

REFERENCE BODY:
${templateBody}

Output ONLY the raw LaTeX body content (no preamble, no \\begin{document}/
\\end{document}, no markdown code fences, no explanation, no commentary
before or after).`;
}

function stripCodeFence(text: string): string {
  const fenced = text.match(/```(?:latex|tex)?\n([\s\S]*?)```/i);
  let body = (fenced ? fenced[1] : text).trim();
  body = body.replace(/^\\begin\{document\}\s*/, "").replace(/\\end\{document\}\s*$/, "").trim();
  return body;
}

export async function generateResumeLatex({
  profile,
  templateSource,
  jobDescription,
  apiKey,
}: {
  profile: ProfileInput;
  templateSource: string;
  jobDescription?: string;
  apiKey: string;
}): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const { preamble, body } = splitTemplate(templateSource);

  const response = await generateContentWithFallback(ai, apiKey, {
    model,
    contents: buildPrompt(profile, body, jobDescription),
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  return `${preamble}\n${stripCodeFence(text)}\n${END_DOCUMENT}\n`;
}

/**
 * Extracts structured profile data from pasted raw resume text (any format —
 * plain text copy-pasted from a PDF/Word doc, another LaTeX resume, etc).
 * Used by the "fill from resume" import feature — the result is only ever
 * used to pre-fill the profile form for the user to review, never saved
 * directly, per Goal.txt's "profile is canonical, never raw text" rule.
 */
export async function parseResumeText({
  resumeText,
  apiKey,
}: {
  resumeText: string;
  apiKey: string;
}): Promise<ProfileInput> {
  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  const prompt = `Extract structured profile data from this resume text.

Only include information actually present in the text — never invent
companies, dates, or achievements. Reproduce URLs, emails, and numbers
character-for-character. If a field isn't present, omit it or use an empty
string/array as appropriate for its type. Group skills into sensible
labeled categories rather than one giant list, if the source doesn't already
group them.

RESUME TEXT:
"""
${resumeText}
"""`;

  const response = await generateContentWithFallback(ai, apiKey, {
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: PROFILE_JSON_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  const parsed = profileSchema.safeParse(JSON.parse(text));
  if (!parsed.success) {
    throw new Error("Gemini's extracted profile didn't match the expected shape");
  }
  return parsed.data;
}
