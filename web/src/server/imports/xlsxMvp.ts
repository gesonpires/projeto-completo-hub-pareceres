import * as XLSX from "xlsx";
import { MVP_IMPORT_COLUMNS } from "@/server/imports/mvpColumns";

export type XlsxSourceInfo = {
  kind: "xlsx";
  sheetName: string;
  rows: number;
  cols: number;
  availableSheets: string[];
  detectedHeaders: string[];
  missingColumns: string[];
};

function normalizeHeader(h: string) {
  return h
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^\w]/g, "");
}

export function xlsxToCsvMvp(params: {
  bytes: Buffer;
  preferredSheetName?: string;
}) {
  const wb = XLSX.read(params.bytes, { type: "buffer" });
  const available = wb.SheetNames ?? [];
  if (available.length === 0) {
    throw new Error("XLSX sem abas.");
  }

  const sheetName = (() => {
    if (!params.preferredSheetName) return available[0];
    const hit = available.find((n) => n === params.preferredSheetName);
    if (hit) return hit;
    throw new Error(
      `Aba "${params.preferredSheetName}" não encontrada no XLSX. ` +
        `Abas disponíveis: ${available.join(", ")}.`,
    );
  })();
  if (!sheetName) {
    throw new Error("XLSX sem abas.");
  }

  const ws = wb.Sheets[sheetName];
  if (!ws) {
    throw new Error("Aba XLSX não encontrada.");
  }

  // Converte para matriz (preserva header na primeira linha).
  const aoa = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: "",
    blankrows: false,
    raw: false,
  }) as unknown as string[][];

  if (!Array.isArray(aoa) || aoa.length === 0) {
    throw new Error("Aba XLSX vazia.");
  }

  const headerRow = (aoa[0] ?? []).map((v) => String(v ?? "").trim());
  const rows = aoa.slice(1);

  const normalized = headerRow.map((h) => normalizeHeader(h));
  const cols = Math.max(0, normalized.length);

  // Cabeçalhos esperados no MVP (ordem canônica).
  const expected = MVP_IMPORT_COLUMNS;

  // Mapeia colunas do XLSX para o schema canônico (best-effort).
  // - Primeiro tenta match exato pelo header normalizado.
  // - Depois tenta alguns aliases comuns.
  const alias: Record<string, (typeof expected)[number]> = {
    nome: "instituicao_nome",
    instituicao: "instituicao_nome",
    instituicao_nome: "instituicao_nome",
    cnpj: "instituicao_cnpj",
    instituicao_cnpj: "instituicao_cnpj",
    municipio: "instituicao_municipio",
    cidade: "instituicao_municipio",
    instituicao_municipio: "instituicao_municipio",
    uf: "instituicao_uf",
    estado: "instituicao_uf",
    instituicao_uf: "instituicao_uf",
    processo: "processo_numero",
    processo_numero: "processo_numero",
    numero_processo: "processo_numero",
    ano: "processo_ano",
    processo_ano: "processo_ano",
    status: "processo_status",
    processo_status: "processo_status",
    assunto: "processo_assunto",
    processo_assunto: "processo_assunto",
    ato: "ato_tipo",
    ato_tipo: "ato_tipo",
    ato_numero: "ato_numero",
    ato_data: "ato_data",
    ato_ementa: "ato_ementa",
    ato_descricao: "ato_descricao",
    evento_tipo: "evento_tipo",
    evento_data: "evento_data",
    evento_descricao: "evento_descricao",
    documento_tipo: "documento_tipo",
    documento_data: "documento_data",
    documento_titulo: "documento_titulo",
    titulo_documento: "documento_titulo",
  };

  const indexByExpected = new Map<(typeof expected)[number], number>();
  for (let i = 0; i < normalized.length; i++) {
    const key = normalized[i] ?? "";
    const direct = expected.includes(key as never) ? (key as (typeof expected)[number]) : null;
    const mapped = direct ?? alias[key] ?? null;
    if (!mapped) continue;
    if (!indexByExpected.has(mapped)) indexByExpected.set(mapped, i);
  }

  const missingColumns = expected.filter((c) => !indexByExpected.has(c));

  // Gera CSV canônico (delimiter vírgula para consistência interna).
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const lines: string[] = [];
  lines.push(expected.map(escape).join(","));

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const values = expected.map((col) => {
      const idx = indexByExpected.get(col);
      const raw = typeof idx === "number" ? (row[idx] ?? "") : "";
      return escape(String(raw ?? "").trim());
    });
    // Mantém linhas vazias fora (se tudo vazio)
    const allEmpty = values.every((v) => v === '""');
    if (allEmpty) continue;
    lines.push(values.join(","));
  }

  const csvText = lines.join("\r\n") + "\r\n";

  const info: XlsxSourceInfo = {
    kind: "xlsx",
    sheetName,
    rows: Math.max(0, rows.length),
    cols,
    availableSheets: available,
    detectedHeaders: headerRow.filter(Boolean),
    missingColumns: missingColumns as unknown as string[],
  };

  return { csvText, sourceInfo: info };
}

