import { describe, expect, test } from "vitest";
import {
  assertCsvReadyForImport,
  parseImportSourceInfo,
  parseReconciliacoesJson,
} from "../importacaoCsvRunValidation";

const VALID_HEADER =
  "instituicao_nome,instituicao_cnpj,instituicao_municipio,instituicao_uf\n" +
  "Escola Teste,,,\n";

describe("parseImportSourceInfo", () => {
  test("retorna CSV quando sourceInfo ausente", () => {
    const r = parseImportSourceInfo();
    expect(r).toEqual({ ok: true, value: { arquivoTipo: "CSV", arquivoMeta: null } });
  });

  test("rejeita metadados muito grandes", () => {
    const r = parseImportSourceInfo("x".repeat(200_001));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toContain("Metadados do arquivo muito grandes");
    }
  });

  test("interpreta kind xlsx", () => {
    const r = parseImportSourceInfo(
      JSON.stringify({ kind: "xlsx", sheetName: "Plan1", missingColumns: [] }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.arquivoTipo).toBe("XLSX");
      expect(r.value.arquivoMeta).toMatchObject({ kind: "xlsx" });
    }
  });

  test("JSON inválido segue como CSV", () => {
    const r = parseImportSourceInfo("{not-json");
    expect(r).toEqual({ ok: true, value: { arquivoTipo: "CSV", arquivoMeta: null } });
  });
});

describe("assertCsvReadyForImport", () => {
  test("aceita CSV com coluna crítica e linha válida", () => {
    const r = assertCsvReadyForImport(VALID_HEADER);
    expect(r).toEqual({ ok: true, value: undefined });
  });

  test("rejeita CSV sem instituicao_nome no header", () => {
    const r = assertCsvReadyForImport("foo,bar\na,b\n");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toContain("faltam colunas críticas");
      expect(r.message).toContain("instituicao_nome");
    }
  });

  test("rejeita quando meta do preview indica coluna crítica ausente", () => {
    const r = assertCsvReadyForImport(VALID_HEADER, {
      kind: "csv",
      missingColumns: ["instituicao_nome"],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toContain("faltam colunas críticas");
    }
  });

  test("rejeita linha sem nome (previewCsvMvp)", () => {
    const csv =
      "instituicao_nome,instituicao_cnpj\n" +
      ",\n";
    const r = assertCsvReadyForImport(csv);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toContain("erro(s) encontrado(s)");
    }
  });
});

describe("parseReconciliacoesJson", () => {
  test("retorna vazio quando ausente", () => {
    expect(parseReconciliacoesJson()).toEqual({ ok: true, value: {} });
  });

  test("aceita NEW e UUID válido", () => {
    const id = "00000000-0000-4000-8000-000000000099";
    const r = parseReconciliacoesJson(
      JSON.stringify({ "2": "NEW", "3": id, "4": "not-uuid", "x": "NEW" }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.reconciliacoes).toEqual({ 2: "NEW", 3: id });
    }
  });

  test("rejeita JSON inválido", () => {
    const r = parseReconciliacoesJson("{");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toContain("Reconciliações inválidas (JSON)");
    }
  });

  test("rejeita payload muito grande", () => {
    const r = parseReconciliacoesJson("x".repeat(200_001));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toContain("Reconciliações muito grandes");
    }
  });
});
