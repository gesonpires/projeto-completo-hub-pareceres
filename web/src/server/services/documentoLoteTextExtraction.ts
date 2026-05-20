import path from "node:path";
import { PDFParse } from "pdf-parse";

const MAX_EXTRACTED_CHARS = 200_000;

export async function tryExtractDocumentText(
  originalName: string,
  mime: string | null,
  bytes: Buffer,
): Promise<string | null> {
  const ext = path.extname(originalName).toLowerCase();

  const isText =
    (mime ? mime.startsWith("text/") : false) ||
    ext === ".txt" ||
    ext === ".csv" ||
    ext === ".json" ||
    ext === ".md";
  if (isText) {
    const s = bytes.toString("utf8").replaceAll("\u0000", "");
    return s.length > MAX_EXTRACTED_CHARS ? s.slice(0, MAX_EXTRACTED_CHARS) : s;
  }

  const isPdf = (mime ? mime === "application/pdf" : false) || ext === ".pdf";
  if (isPdf) {
    try {
      const parser = new PDFParse({ data: bytes });
      const out = await parser.getText();
      await parser.destroy();
      const s = (out.text ?? "").trim();
      if (!s) return null;
      return s.length > MAX_EXTRACTED_CHARS ? s.slice(0, MAX_EXTRACTED_CHARS) : s;
    } catch {
      return null;
    }
  }

  return null;
}
