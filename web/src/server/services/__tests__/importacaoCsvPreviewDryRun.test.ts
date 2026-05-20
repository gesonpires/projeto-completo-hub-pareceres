import { describe, expect, test } from "vitest";
import {
  getInstituicaoCnpjRejectionMessage,
  normalizeImportRow,
} from "../importacaoCsvMatching/importRowNormalize";
import { planDryRunInstituicaoBranch } from "../importacaoCsvMatching/dryRunInstituicao";
import type { CsvMvpRow } from "../../imports/csvMvpCore";

const VALID_CNPJ = "11222333000181";

function rowFromCsv(partial: Partial<CsvMvpRow>) {
  return normalizeImportRow({
    instituicao_nome: "Escola",
    instituicao_cnpj: "",
    instituicao_municipio: "",
    instituicao_uf: "",
    ...partial,
  } as CsvMvpRow);
}

describe("planDryRunInstituicaoBranch (paridade CNPJ com run)", () => {
  test("skip sem nome", () => {
    const row = rowFromCsv({ instituicao_nome: "" });
    expect(planDryRunInstituicaoBranch(row)).toEqual({
      kind: "skip",
      reason: "missing_nome",
    });
  });

  test("skip CNPJ com comprimento inválido (não cai em sem_cnpj)", () => {
    const row = rowFromCsv({ instituicao_cnpj: "123" });
    const branch = planDryRunInstituicaoBranch(row);
    expect(branch).toEqual({
      kind: "skip",
      reason: "invalid_cnpj",
      message: "instituicao_cnpj inválido (precisa 14 dígitos)",
    });
    expect(getInstituicaoCnpjRejectionMessage(row.cnpjDigits)).toBe(
      "instituicao_cnpj inválido (precisa 14 dígitos)",
    );
  });

  test("skip CNPJ com dígitos verificadores inválidos", () => {
    const row = rowFromCsv({ instituicao_cnpj: "12345678901234" });
    const branch = planDryRunInstituicaoBranch(row);
    expect(branch).toMatchObject({
      kind: "skip",
      reason: "invalid_cnpj",
    });
    expect(getInstituicaoCnpjRejectionMessage(row.cnpjDigits)).toContain(
      "dígitos verificadores",
    );
  });

  test("ramo cnpj quando CNPJ válido", () => {
    const row = rowFromCsv({ instituicao_cnpj: "11.222.333/0001-81" });
    expect(row.cnpjDigits).toBe(VALID_CNPJ);
    expect(planDryRunInstituicaoBranch(row)).toEqual({ kind: "cnpj" });
  });

  test("ramo sem_cnpj quando CNPJ ausente", () => {
    const row = rowFromCsv({
      instituicao_municipio: "Florianópolis",
      instituicao_uf: "SC",
    });
    expect(planDryRunInstituicaoBranch(row)).toEqual({ kind: "sem_cnpj" });
  });

  test("paridade: mesma mensagem de rejeição que o run usaria", () => {
    const row = rowFromCsv({ instituicao_cnpj: "00000000000000" });
    const rejection = getInstituicaoCnpjRejectionMessage(row.cnpjDigits);
    expect(rejection).not.toBeNull();
    expect(planDryRunInstituicaoBranch(row)).toEqual({
      kind: "skip",
      reason: "invalid_cnpj",
      message: rejection!,
    });
  });
});
