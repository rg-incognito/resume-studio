import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import { decrypt } from "@/lib/encryption";
import { parseResumeText } from "@/lib/resumeAi";
import { describeAiError, rawAiErrorDetail } from "@/lib/aiErrors";
import type { AiProviderId } from "@/lib/ai";

const bodySchema = z.object({ resumeText: z.string().min(20).max(30_000) });

// Extracts structured profile data from pasted resume text using the user's
// own Gemini key. Returns the parsed profile for the client to pre-fill the
// form with — never writes to the DB directly, so the user reviews/edits
// before saving via PUT /api/profile as usual.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorized();

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const apiKeyRecord = await prisma.apiKey.findUnique({ where: { userId: user.id } });
  if (!apiKeyRecord) {
    return Response.json(
      { error: "Add an API key in Settings first" },
      { status: 400 },
    );
  }
  const provider = apiKeyRecord.provider as AiProviderId;

  try {
    console.error(`[route-trace] calling parseResumeText t=${Date.now()}`);
    const { profile, modelUsed } = await parseResumeText({
      resumeText: parsed.data.resumeText,
      apiKey: decrypt(apiKeyRecord.encryptedKey),
      provider,
    });
    console.error(`[route-trace] parseResumeText SUCCESS t=${Date.now()}`);
    return Response.json({ profile, modelUsed });
  } catch (err) {
    console.error(`[route-trace] CAUGHT in route t=${Date.now()} err=${err instanceof Error ? err.stack : String(err)}`);
    return Response.json(
      {
        error: `Couldn't parse that resume: ${describeAiError(err, provider)}`,
        log: rawAiErrorDetail(err, provider),
      },
      { status: 502 },
    );
  }
}
