import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const TEMPLATES_DIR = join(__dirname, "..", "templates");

type TemplateIndexEntry = {
  id: string;
  file: string;
  name: string;
  description: string;
};

async function main() {
  const index: TemplateIndexEntry[] = JSON.parse(
    readFileSync(join(TEMPLATES_DIR, "index.json"), "utf8"),
  );

  for (const entry of index) {
    const latexTemplateSource = readFileSync(join(TEMPLATES_DIR, entry.file), "utf8");

    await prisma.template.upsert({
      where: { id: entry.id },
      create: {
        id: entry.id,
        name: entry.name,
        description: entry.description,
        latexTemplateSource,
      },
      update: {
        name: entry.name,
        description: entry.description,
        latexTemplateSource,
      },
    });

    console.log(`seeded: ${entry.id}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
