import { extractText, getDocumentProxy } from "unpdf";

const MAX_PDF_BYTES = 8 * 1024 * 1024;

export class PdfTextExtractionError extends Error {}

export function assertPdfSize(byteLength: number) {
  if (byteLength > MAX_PDF_BYTES) {
    throw new PdfTextExtractionError("PDF is too large (max 8MB)");
  }
}

export async function extractPdfText(
  buffer: Buffer,
): Promise<{ text: string; totalPages: number }> {
  let totalPages: number;
  let text: string;
  try {
    const doc = await getDocumentProxy(new Uint8Array(buffer));
    ({ text, totalPages } = await extractText(doc, { mergePages: true }));
  } catch {
    throw new PdfTextExtractionError(
      "Couldn't read that PDF — make sure it's a valid, non-corrupted file",
    );
  }

  const trimmed = text.trim();
  if (trimmed.length < 40) {
    throw new PdfTextExtractionError(
      "Couldn't extract readable text from that PDF — it may be a scanned image rather than a text-based document",
    );
  }

  return { text: trimmed, totalPages };
}
