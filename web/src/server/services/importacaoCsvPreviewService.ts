import { MVP_IMPORT_COLUMNS } from "@/server/imports/mvpColumns";
import { parseCsvSafe, previewCsvMvp } from "@/server/imports/csvMvpCore";
import { ingestImportUploadFile } from "@/server/imports/importacaoFileIngestion";
import { buildImportacaoCsvDryRunImpact } from "./importacaoCsvPreviewDryRun";
import { buildImportacaoCsvReconciliationSuggestions } from "./importacaoCsvPreviewSugestoes";
import type {
  ImportacaoCsvPreviewResult,
  ImportSourceInfo,
} from "./importacaoCsvPreviewTypes";

export type {
  ImportacaoCsvPreviewResult,
  ImportacaoCsvPreviewSuccess,
  ImportacaoCsvDryRunImpact,
  ImportacaoCsvReconciliationSuggestion,
  ImportSourceInfo,
  CsvSourceInfo,
  XlsxSourceInfo,
} from "./importacaoCsvPreviewTypes";

const PREVIEW_SAMPLE_LIMIT = 20;

function buildCsvSourceInfo(csvText: string): ImportSourceInfo | null {
  const { records, error, delimiter } = parseCsvSafe(csvText);
  if (error || records.length === 0) return null;

  const keys = Object.keys(records[0] ?? {});
  const missing = MVP_IMPORT_COLUMNS.filter((c) => !keys.includes(c));
  return {
    kind: "csv",
    delimiter,
    rows: records.length,
    cols: keys.length,
    detectedHeaders: keys,
    missingColumns: missing as unknown as string[],
  };
}

/**
 * Preview completo a partir de CSV já ingerido (validação estrutural + dry-run + sugestões).
 */
export async function previewImportacaoCsv(params: {
  arquivoNome: string;
  csvText: string;
  sourceInfo: ImportSourceInfo | null;
}): Promise<ImportacaoCsvPreviewResult> {
  if (!params.csvText.trim()) {
    return { ok: false, message: "CSV vazio." };
  }

  let sourceInfo = params.sourceInfo;
  if (!sourceInfo) {
    sourceInfo = buildCsvSourceInfo(params.csvText);
  }

  const preview = previewCsvMvp(params.csvText, PREVIEW_SAMPLE_LIMIT);
  const dryRunImpact = await buildImportacaoCsvDryRunImpact(preview);
  const sugestoes = await buildImportacaoCsvReconciliationSuggestions(params.csvText);

  return {
    ok: true,
    arquivoNome: params.arquivoNome,
    csvText: params.csvText,
    sourceInfo,
    preview,
    dryRunImpact,
    sugestoes,
  };
}

/**
 * Preview a partir de upload (XLSX/CSV + encoding auxiliar).
 */
export async function previewImportacaoCsvFromUpload(params: {
  file: File;
  sheetName?: string;
}): Promise<ImportacaoCsvPreviewResult> {
  try {
    const ingested = await ingestImportUploadFile(params.file, params.sheetName);
    return previewImportacaoCsv({
      arquivoNome: params.file.name,
      csvText: ingested.csvText,
      sourceInfo: ingested.sourceInfo,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `Falha ao gerar preview: ${msg}` };
  }
}
