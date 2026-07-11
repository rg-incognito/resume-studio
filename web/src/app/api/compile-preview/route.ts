import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { compileLatex, LatexCompileError } from "@/lib/compiler";

const bodySchema = z.object({ templateId: z.string().min(1) });

/**
 * Goal.txt build-order step 5 checkpoint: proves the sandboxed Docker
 * compiler pipeline works end-to-end, compiling a seeded template exactly
 * as stored (no profile merge, no Gemini) — before step 6 wires Gemini in.
 * Dev-only: not meant to be reachable once step 6 supersedes it.
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Not available in production" }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const template = await prisma.template.findUnique({ where: { id: parsed.data.templateId } });
  if (!template) {
    return Response.json({ error: "Template not found" }, { status: 404 });
  }

  try {
    const { pdf } = await compileLatex(template.latexTemplateSource);
    return new Response(new Uint8Array(pdf), {
      headers: { "Content-Type": "application/pdf" },
    });
  } catch (err) {
    const log = err instanceof LatexCompileError ? err.log : String(err);
    return Response.json({ error: "Compile failed", log }, { status: 500 });
  }
}
