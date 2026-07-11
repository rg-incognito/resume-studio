import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import { decrypt } from "@/lib/encryption";
import { compileLatex, LatexCompileError } from "@/lib/compiler";
import { generateResumeLatex } from "@/lib/gemini";
import { describeGeminiError } from "@/lib/geminiErrors";
import { savePdf } from "@/lib/storage";
import { profileSchema } from "@/lib/schemas/profile";

const bodySchema = z.object({
  templateId: z.string().min(1),
  jobDescription: z.string().max(20_000).optional(),
  label: z.string().max(120).optional(),
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorized();

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { templateId, jobDescription, label } = parsed.data;

  const [profileRecord, template, apiKeyRecord] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: user.id } }),
    prisma.template.findUnique({ where: { id: templateId } }),
    prisma.apiKey.findUnique({ where: { userId: user.id } }),
  ]);

  if (!template) {
    return Response.json({ error: "Template not found" }, { status: 404 });
  }
  if (!apiKeyRecord) {
    return Response.json(
      { error: "Add your Gemini API key in Settings first" },
      { status: 400 },
    );
  }
  const profileParsed = profileSchema.safeParse(profileRecord ?? {});
  if (!profileRecord || !profileParsed.success) {
    return Response.json(
      { error: "Fill out your profile before generating a resume" },
      { status: 400 },
    );
  }

  const apiKey = decrypt(apiKeyRecord.encryptedKey);

  // Gemini occasionally emits body content that fails to compile (e.g. a
  // missed escape on a special character) even with the preamble spliced in
  // deterministically. Retrying regenerates fresh content and resolves most
  // of these transparently instead of surfacing a one-off failure to the user.
  const MAX_ATTEMPTS = 3;
  let latex = "";
  let pdf: Buffer | undefined;
  let lastError: { message: string; log?: string } | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      latex = await generateResumeLatex({
        profile: profileParsed.data,
        templateSource: template.latexTemplateSource,
        jobDescription,
        apiKey,
      });
    } catch (err) {
      return Response.json(
        { error: `Gemini generation failed: ${describeGeminiError(err)}` },
        { status: 502 },
      );
    }

    try {
      ({ pdf } = await compileLatex(latex));
      lastError = null;
      break;
    } catch (err) {
      const log = err instanceof LatexCompileError ? err.log : String(err);
      lastError = { message: "The generated LaTeX didn't compile", log };
    }
  }

  if (!pdf || lastError) {
    return Response.json(
      { error: lastError?.message ?? "The generated LaTeX didn't compile", log: lastError?.log },
      { status: 502 },
    );
  }

  const resumeVersion = await prisma.resumeVersion.create({
    data: {
      profileId: profileRecord.id,
      templateId: template.id,
      jobDescription,
      generatedLatex: latex,
      label: label ?? (jobDescription ? "Tailored" : "Base"),
    },
  });

  const pdfUrl = await savePdf(resumeVersion.id, pdf);
  await prisma.resumeVersion.update({
    where: { id: resumeVersion.id },
    data: { generatedPdfUrl: pdfUrl },
  });
  await prisma.apiKey.update({
    where: { userId: user.id },
    data: { lastUsedAt: new Date() },
  });

  return Response.json({ id: resumeVersion.id, pdfUrl });
}
