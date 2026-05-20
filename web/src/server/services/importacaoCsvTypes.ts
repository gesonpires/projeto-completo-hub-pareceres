/** Entrada do run de importação CSV/XLSX (MVP). */
export type ImportacaoCsvRunInput = {
  csvText: string;
  actorUserId: string;
  arquivoNome: string;
  fonteNome?: string;
  arquivoTipo?: "CSV" | "XLSX";
  arquivoMeta?: unknown;
  /** rowNumber (linha do CSV, base 1 + header) → instituicaoId ou "NEW" */
  reconciliacoes?: Record<number, string>;
};

export type ImportacaoCsvRunResult = {
  loteId: string;
  imported: number;
  rejected: number;
  errorsCount: number;
};
