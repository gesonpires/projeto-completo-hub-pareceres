import type { ImportPreview } from "../imports/csvMvpCore";

export type CsvSourceInfo = {
  kind: "csv";
  delimiter: "," | ";";
  rows: number;
  cols: number;
  detectedHeaders: string[];
  missingColumns: string[];
};

export type XlsxSourceInfo = {
  kind: "xlsx";
  sheetName: string;
  rows: number;
  cols: number;
  availableSheets: string[];
  detectedHeaders: string[];
  missingColumns: string[];
};

export type ImportSourceInfo = CsvSourceInfo | XlsxSourceInfo;

export type ImportacaoCsvDryRunImpact = {
  analyzedRows: number;
  instituicoes: { created: number; updated: number };
  processos: { created: number; updated: number };
  atos: { created: number; updated: number };
  eventos: { created: number; updated: number };
  documentos: { created: number; updated: number };
};

export type ImportacaoCsvReconciliationSuggestion = {
  rowNumber: number;
  nome: string;
  municipio?: string;
  uf?: string;
  matchLevel: "EXATO" | "MUNICIPIO_APROX" | "PARCIAL";
  candidatos: Array<{
    id: string;
    nome: string;
    municipio: string | null;
    uf: string | null;
    cnpj: string | null;
  }>;
};

export type ImportacaoCsvPreviewSuccess = {
  ok: true;
  arquivoNome: string;
  csvText: string;
  sourceInfo: ImportSourceInfo | null;
  preview: ImportPreview;
  dryRunImpact: ImportacaoCsvDryRunImpact;
  sugestoes: ImportacaoCsvReconciliationSuggestion[];
};

export type ImportacaoCsvPreviewResult =
  | ImportacaoCsvPreviewSuccess
  | { ok: false; message: string };
