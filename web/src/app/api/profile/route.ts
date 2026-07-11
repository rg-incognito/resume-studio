import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import { profileSchema } from "@/lib/schemas/profile";

const EMPTY_PROFILE = {
  personalInfo: {},
  workExperience: [],
  education: [],
  skills: [],
  projects: [],
  certifications: [],
  achievements: [],
};

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorized();

  const profile = await prisma.profile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...EMPTY_PROFILE },
    update: {},
  });

  return Response.json(profile);
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorized();

  const body = await request.json();
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const profile = await prisma.profile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...parsed.data },
    update: { ...parsed.data },
  });

  return Response.json(profile);
}
