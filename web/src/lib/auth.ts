import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyIdToken } from "@/lib/firebase-admin";
import type { User } from "@/generated/prisma/client";

export async function getCurrentUser(request: NextRequest): Promise<User | null> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const idToken = header.slice("Bearer ".length);
  let decoded: Awaited<ReturnType<typeof verifyIdToken>>;
  try {
    decoded = await verifyIdToken(idToken);
  } catch {
    return null;
  }

  if (!decoded.email) return null;

  return prisma.user.upsert({
    where: { googleId: decoded.uid },
    create: {
      googleId: decoded.uid,
      email: decoded.email,
      name: decoded.name ?? decoded.email,
    },
    update: {
      email: decoded.email,
      name: decoded.name ?? decoded.email,
    },
  });
}

export function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
