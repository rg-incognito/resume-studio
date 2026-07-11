import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const COMPILE_TIMEOUT_MS = 60_000;
const DOCKER_IMAGE = "texlive/texlive";
const SOURCE_FILENAME = "resume.tex";

export class LatexCompileError extends Error {
  constructor(
    message: string,
    public readonly log: string,
  ) {
    super(message);
    this.name = "LatexCompileError";
  }
}

function toDockerMountPath(winPath: string): string {
  return winPath.replace(/\\/g, "/");
}

function runDocker(args: string[], timeoutMs: number): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new LatexCompileError("LaTeX compilation timed out", output));
        return;
      }
      resolve({ code, output });
    });
  });
}

/**
 * Compiles a LaTeX source string to PDF inside a sandboxed, network-isolated
 * Docker container (Goal.txt §7: timeouts, limited filesystem access, no
 * shell-injection risk since args are never shell-interpolated).
 */
export async function compileLatex(source: string): Promise<{ pdf: Buffer; log: string }> {
  const dir = await mkdtemp(path.join(tmpdir(), "resume-compile-"));
  try {
    await writeFile(path.join(dir, SOURCE_FILENAME), source, "utf8");

    const mountPath = toDockerMountPath(dir);
    const { code, output } = await runDocker(
      [
        "run",
        "--rm",
        "--network",
        "none",
        "--memory",
        "512m",
        "--cpus",
        "1",
        "-v",
        `${mountPath}:/data`,
        "-w",
        "/data",
        DOCKER_IMAGE,
        "pdflatex",
        "-interaction=nonstopmode",
        "-halt-on-error",
        SOURCE_FILENAME,
      ],
      COMPILE_TIMEOUT_MS,
    );

    const pdfFile = path.join(dir, "resume.pdf");
    if (code !== 0) {
      throw new LatexCompileError("pdflatex exited with a nonzero status", output);
    }

    let pdf: Buffer;
    try {
      pdf = await readFile(pdfFile);
    } catch {
      throw new LatexCompileError("pdflatex did not produce a PDF", output);
    }

    return { pdf, log: output };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
