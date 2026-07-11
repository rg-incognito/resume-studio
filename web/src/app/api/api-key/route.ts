import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import { encrypt, decrypt, maskSecret } from "@/lib/encryption";

const bodySchema = z.object({ apiKey: z.string().min(10).max(500) });

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorized();

  const record = await prisma.apiKey.findUnique({ where: { userId: user.id } });
  if (!record) return Response.json({ hasKey: false, masked: null });

  const masked = maskSecret(decrypt(record.encryptedKey));
  return Response.json({ hasKey: true, masked, lastUsedAt: record.lastUsedAt });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorized();

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const encryptedKey = encrypt(parsed.data.apiKey);
  await prisma.apiKey.upsert({
    where: { userId: user.id },
    create: { userId: user.id, encryptedKey },
    update: { encryptedKey },
  });

  return Response.json({ hasKey: true, masked: maskSecret(parsed.data.apiKey) });
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorized();

  await prisma.apiKey.deleteMany({ where: { userId: user.id } });
  return Response.json({ hasKey: false, masked: null });
}
