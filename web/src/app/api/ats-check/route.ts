import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import { decrypt } from "@/lib/encryption";
import { assertPdfSize, extractPdfText, PdfTextExtractionError } from "@/lib/pdfText";
import { analyzeAts } from "@/lib/atsCheck";
import { describeAiError } from "@/lib/aiErrors";
import type { AiProviderId } from "@/lib/ai";

const MAX_JD_CHARS = 20_000;

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorized();

  const apiKeyRecord = await prisma.apiKey.findUnique({ where: { userId: user.id } });
  if (!apiKeyRecord) {
    return Response.json(
      { error: "Add an API key in Settings first" },
      { status: 400 },
    );
  }
  const provider = apiKeyRecord.provider as AiProviderId;

  const form = await request.formData();
  const file = form.get("resume");
  const jobDescriptionField = form.get("jobDescription");

  if (!(file instanceof File) || file.type !== "application/pdf") {
    return Response.json({ error: "Upload your resume as a PDF file" }, { status: 400 });
  }

  try {
    assertPdfSize(file.size);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "PDF is too large" },
      { status: 400 },
    );
  }

  const jobDescription =
    typeof jobDescriptionField === "string"
      ? jobDescriptionField.trim().slice(0, MAX_JD_CHARS)
      : "";

  const buffer = Buffer.from(await file.arrayBuffer());

  let resumeText: string;
  let totalPages: number;
  try {
    ({ text: resumeText, totalPages } = await extractPdfText(buffer));
  } catch (err) {
    const message = err instanceof PdfTextExtractionError ? err.message : "Couldn't read that PDF";
    return Response.json({ error: message }, { status: 400 });
  }

  try {
    const report = await analyzeAts({
      resumeText,
      totalPages,
      jobDescription: jobDescription || undefined,
      apiKey: decrypt(apiKeyRecord.encryptedKey),
      provider,
    });
    return Response.json(report);
  } catch (err) {
    return Response.json(
      { error: `ATS analysis failed: ${describeAiError(err, provider)}` },
      { status: 502 },
    );
  }
}
