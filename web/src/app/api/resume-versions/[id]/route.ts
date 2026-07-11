import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, unauthorized } from "@/lib/auth";

async function assertOwnership(userId: string, versionId: string) {
  const version = await prisma.resumeVersion.findUnique({
    where: { id: versionId },
    include: { profile: { select: { userId: true } } },
  });
  if (!version || version.profile.userId !== userId) return null;
  return version;
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const version = await assertOwnership(user.id, id);
  if (!version) return Response.json({ error: "Not found" }, { status: 404 });

  await prisma.resumeVersion.delete({ where: { id } });
  return Response.json({ ok: true });
}
