// Compiles each seeded template and rasterizes its first page to a PNG under
// public/template-previews/<id>.png, so the template gallery can show real
// previews instead of a generic mockup. Rerun with `npm run generate:previews`
// whenever a template's content or styling changes. Requires Docker.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { compileLatex } from "../src/lib/compiler";

function runDocker(args: string[]): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (c) => (output += c.toString()));
    child.stderr.on("data", (c) => (output += c.toString()));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, output }));
  });
}

async function rasterize(pdf: Buffer): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "resume-raster-"));
  try {
    await writeFile(join(dir, "in.pdf"), pdf);
    const mountPath = dir.replace(/\\/g, "/");
    const { code, output } = await runDocker([
      "run",
      "--rm",
      "--network",
      "none",
      "-v",
      `${mountPath}:/data`,
      "-w",
      "/data",
      "texlive/texlive",
      "gs",
      "-sDEVICE=png16m",
      "-r120",
      "-dFirstPage=1",
      "-dLastPage=1",
      "-o",
      "out.png",
      "in.pdf",
    ]);
    if (code !== 0) throw new Error("gs failed: " + output);
    return await readFile(join(dir, "out.png"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function main() {
  const templatesDir = join(__dirname, "..", "templates");
  const outDir = join(__dirname, "..", "public", "template-previews");
  mkdirSync(outDir, { recursive: true });

  const files = readdirSync(templatesDir).filter((f) => f.endsWith(".tex"));
  const index = JSON.parse(readFileSync(join(templatesDir, "index.json"), "utf8")) as {
    id: string;
    file: string;
  }[];

  for (const entry of index) {
    if (!files.includes(entry.file)) continue;
    process.stdout.write(`${entry.id}... `);
    const source = readFileSync(join(templatesDir, entry.file), "utf8");
    const { pdf } = await compileLatex(source);
    const png = await rasterize(pdf);
    writeFileSync(join(outDir, `${entry.id}.png`), png);
    console.log("ok");
  }
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
