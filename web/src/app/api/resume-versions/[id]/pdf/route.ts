import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import { readPdf } from "@/lib/storage";

// Requires the same Bearer-token auth as every other route — the client
// fetches this via apiFetch() and turns it into a blob URL rather than
// linking to it directly, since a bare <a>/<iframe src> can't attach the
// Authorization header.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const version = await prisma.resumeVersion.findUnique({
    where: { id },
    include: { profile: { select: { userId: true } } },
  });
  if (!version || version.profile.userId !== user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const pdf = await readPdf(id);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="resume-${id}.pdf"`,
    },
  });
}
