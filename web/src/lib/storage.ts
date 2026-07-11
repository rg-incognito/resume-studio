import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "resumes");

function pdfPath(resumeVersionId: string): string {
  return path.join(STORAGE_ROOT, `${resumeVersionId}.pdf`);
}

export async function savePdf(resumeVersionId: string, pdf: Buffer): Promise<string> {
  await mkdir(STORAGE_ROOT, { recursive: true });
  await writeFile(pdfPath(resumeVersionId), pdf);
  return `/api/resume-versions/${resumeVersionId}/pdf`;
}

export async function readPdf(resumeVersionId: string): Promise<Buffer> {
  return readFile(pdfPath(resumeVersionId));
}
