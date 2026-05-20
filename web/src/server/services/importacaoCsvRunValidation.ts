import { MVP_IMPORT_CRITICAL_COLUMNS } from "../imports/mvpColumns";
import { parseCsvSafe, previewCsvMvp } from "../imports/csvMvpCore";

const MAX_JSON_PAYLOAD = 200_000;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ImportacaoCsvRunGuardResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

export type ImportSourceInfoParsed = {
  arquivoTipo: "CSV" | "XLSX";
  arquivoMeta: unknown | null;
};

/**
 * Interpreta sourceInfoJson do preview (tipo de arquivo + metadados).
 * JSON inválido ou sem kind conhecido: segue como CSV (MVP).
 */
export function parseImportSourceInfo(
  sourceInfoJson?: string,
): ImportacaoCsvRunGuardResult<ImportSourceInfoParsed> {
  if (!sourceInfoJson) {
    return { ok: true, value: { arquivoTipo: "CSV", arquivoMeta: null } };
  }

  if (sourceInfoJson.length > MAX_JSON_PAYLOAD) {
    return {
      ok: false,
      message: "Metadados do arquivo muito grandes. Gere o preview novamente.",
    };
  }

  try {
    const raw = JSON.parse(sourceInfoJson) as unknown;
    if (raw && typeof raw === "object") {
      const m = raw as Record<string, unknown>;
      if (m.kind === "xlsx" || m.kind === "csv") {
        return {
          ok: true,
          value: {
            arquivoTipo: m.kind === "xlsx" ? "XLSX" : "CSV",
            arquivoMeta: m,
          },
        };
      }
    }
  } catch {
    // Metadados quebrados: segue como CSV (não bloqueia).
  }

  return { ok: true, value: { arquivoTipo: "CSV", arquivoMeta: null } };
}

/**
 * Guardrails do run: headers, colunas críticas (CSV + meta do preview) e previewCsvMvp(1).
 */
export function assertCsvReadyForImport(
  csvText: string,
  arquivoMeta?: unknown | null,
): ImportacaoCsvRunGuardResult<void> {
  const headerCheck = parseCsvSafe(csvText);
  if (headerCheck.error) {
    return {
      ok: false,
      message: `Falha ao ler CSV para importação: ${headerCheck.error}. Gere o preview novamente.`,
    };
  }

  const first = headerCheck.records[0] ?? {};
  const keys = Object.keys(first);
  const missingCritical = MVP_IMPORT_CRITICAL_COLUMNS.filter((c) => !keys.includes(c));
  if (missingCritical.length > 0) {
    return {
      ok: false,
      message: `Arquivo inválido: faltam colunas críticas (${missingCritical.join(
        ", ",
      )}). Ajuste o header ou use o template e gere o preview novamente.`,
    };
  }

  const metaMissing =
    arquivoMeta &&
    typeof arquivoMeta === "object" &&
    Array.isArray((arquivoMeta as Record<string, unknown>).missingColumns)
      ? (
          (arquivoMeta as Record<string, unknown>).missingColumns as unknown[]
        ).filter((x) => typeof x === "string")
      : [];
  const missingCriticalFromMeta = MVP_IMPORT_CRITICAL_COLUMNS.filter((c) =>
    metaMissing.includes(c),
  );
  if (missingCriticalFromMeta.length > 0) {
    return {
      ok: false,
      message: `Arquivo inválido: faltam colunas críticas (${missingCriticalFromMeta.join(
        ", ",
      )}). Ajuste o header ou use o template e gere o preview novamente.`,
    };
  }

  const pre = previewCsvMvp(csvText, 1);
  if (pre.errors.length > 0) {
    const firstErr = pre.errors[0]!;
    return {
      ok: false,
      message:
        `Arquivo inválido: ${pre.errors.length} erro(s) encontrado(s). ` +
        `Ex.: linha ${firstErr.rowNumber}: ${firstErr.message}`,
    };
  }

  return { ok: true, value: undefined };
}

export type ReconciliacoesParsed = {
  reconciliacoes?: Record<number, string>;
};

/**
 * Parse do mapa rowNumber → instituicaoId | "NEW" enviado pelo preview.
 */
export function parseReconciliacoesJson(
  reconciliacoesJson?: string,
): ImportacaoCsvRunGuardResult<ReconciliacoesParsed> {
  if (!reconciliacoesJson) {
    return { ok: true, value: {} };
  }

  if (reconciliacoesJson.length > MAX_JSON_PAYLOAD) {
    return {
      ok: false,
      message:
        "Reconciliações muito grandes. Gere o preview novamente e tente dividir o arquivo.",
    };
  }

  try {
    const raw = JSON.parse(reconciliacoesJson) as unknown;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return {
        ok: false,
        message: "Reconciliações inválidas (formato). Gere o preview novamente.",
      };
    }

    const rec: Record<number, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const row = Number(k);
      if (!Number.isInteger(row) || row < 2 || row > 2_000_000) continue;
      if (typeof v !== "string") continue;
      if (v === "NEW" || UUID_RE.test(v)) rec[row] = v;
    }

    return {
      ok: true,
      value: {
        reconciliacoes: Object.keys(rec).length > 0 ? rec : undefined,
      },
    };
  } catch {
    return {
      ok: false,
      message: "Reconciliações inválidas (JSON). Gere o preview novamente.",
    };
  }
}
