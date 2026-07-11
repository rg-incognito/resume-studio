import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, unauthorized } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorized();

  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
  if (!profile) return Response.json([]);

  const versions = await prisma.resumeVersion.findMany({
    where: { profileId: profile.id },
    orderBy: { createdAt: "desc" },
    include: { template: { select: { name: true } } },
  });

  return Response.json(
    versions.map((v) => ({
      id: v.id,
      label: v.label,
      templateName: v.template.name,
      jobDescription: v.jobDescription,
      pdfUrl: v.generatedPdfUrl,
      createdAt: v.createdAt,
    })),
  );
}
