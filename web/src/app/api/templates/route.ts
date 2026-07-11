import { prisma } from "@/lib/prisma";

// Public catalog — no paywalled templates, no auth needed to browse.
export async function GET() {
  const templates = await prisma.template.findMany({
    select: { id: true, name: true, description: true },
    orderBy: { createdAt: "asc" },
  });
  return Response.json(templates);
}
