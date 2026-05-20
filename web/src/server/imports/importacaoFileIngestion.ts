import { xlsxToCsvMvp } from "./xlsxMvp";
import type { ImportSourceInfo } from "../services/importacaoCsvPreviewTypes";

function isXlsxUpload(file: File) {
  return (
    file.name.toLowerCase().endsWith(".xlsx") ||
    file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}

/**
 * Converte upload CSV/XLSX em texto CSV + metadados de origem (quando XLSX).
 */
export async function ingestImportUploadFile(
  file: File,
  sheetName?: string,
): Promise<{ csvText: string; sourceInfo: ImportSourceInfo | null }> {
  if (isXlsxUpload(file)) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const converted = xlsxToCsvMvp({ bytes, preferredSheetName: sheetName });
    return { csvText: converted.csvText, sourceInfo: converted.sourceInfo };
  }

  let text = await file.text();
  if (text.includes("\uFFFD")) {
    const bytes = Buffer.from(await file.arrayBuffer());
    text = new TextDecoder("latin1").decode(bytes);
  }

  return { csvText: text, sourceInfo: null };
}
