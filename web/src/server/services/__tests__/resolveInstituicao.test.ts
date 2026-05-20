import { describe, expect, test } from "vitest";
import {
  INSTITUICAO_MATCH_POLICY_PREVIEW,
  INSTITUICAO_MATCH_POLICY_RUN,
  pickInstituicaoSemCnpjCandidate,
  planInstituicaoSemCnpjMatch,
  resolveInstituicao,
} from "../importacaoCsvMatching/resolveInstituicao";
import type { NormalizedImportRow } from "../importacaoCsvMatching/importRowTypes";

const VALID_CNPJ = "11222333000181";

const baseRow = (overrides: Partial<NormalizedImportRow> = {}): NormalizedImportRow => ({
  nome: "Escola Alfa",
  nomeNormalizado: "ESCOLA ALFA",
  cnpjDigits: "",
  municipio: "Florianópolis",
  uf: "SC",
  procNumero: null,
  procAnoRaw: "",
  procAno: null,
  procStatus: "ABERTO",
  procAssunto: null,
  hasProcesso: false,
  atoTipo: null,
  atoNumero: null,
  atoData: null,
  atoEmenta: null,
  atoDescricao: null,
  hasAto: false,
  eventoTipo: null,
  eventoData: null,
  eventoDescricao: null,
  hasEvento: false,
  docTipo: null,
  docData: null,
  docTitulo: null,
  hasDocumento: false,
  ...overrides,
});

describe("pickInstituicaoSemCnpjCandidate", () => {
  test("prefere candidato com CNPJ", () => {
    const picked = pickInstituicaoSemCnpjCandidate([
      { id: "a", cnpj: null },
      { id: "b", cnpj: VALID_CNPJ },
    ]);
    expect(picked?.id).toBe("b");
  });

  test("sem CNPJ nos candidatos usa o primeiro", () => {
    const picked = pickInstituicaoSemCnpjCandidate([
      { id: "a", cnpj: null },
      { id: "b", cnpj: null },
    ]);
    expect(picked?.id).toBe("a");
  });
});

describe("resolveInstituicao (policy RUN)", () => {
  test("skip sem nome", async () => {
    const result = await resolveInstituicao({
      row: baseRow({ nome: "" }),
      policy: INSTITUICAO_MATCH_POLICY_RUN,
    });
    expect(result).toEqual({ outcome: "skip", reason: "missing_nome" });
  });

  test("reject CNPJ inválido", async () => {
    const result = await resolveInstituicao({
      row: baseRow({ cnpjDigits: "123" }),
      policy: INSTITUICAO_MATCH_POLICY_RUN,
    });
    expect(result).toMatchObject({
      outcome: "reject",
      reason: "invalid_cnpj",
    });
  });

  test("create new_cnpj quando CNPJ não existe", async () => {
    const result = await resolveInstituicao({
      row: baseRow({ cnpjDigits: VALID_CNPJ }),
      policy: INSTITUICAO_MATCH_POLICY_RUN,
      findByCnpj: async () => null,
    });
    expect(result).toEqual({
      outcome: "create",
      reason: "new_cnpj",
      policy: INSTITUICAO_MATCH_POLICY_RUN,
    });
  });

  test("update cnpj_existing", async () => {
    const result = await resolveInstituicao({
      row: baseRow({ cnpjDigits: VALID_CNPJ }),
      policy: INSTITUICAO_MATCH_POLICY_RUN,
      findByCnpj: async () => ({ id: "inst-cnpj" }),
    });
    expect(result).toMatchObject({
      outcome: "update",
      reason: "cnpj_existing",
      matchStrategy: "cnpj",
      instituicaoId: "inst-cnpj",
    });
  });

  test("update reconciliation_manual", async () => {
    const result = await resolveInstituicao({
      row: baseRow(),
      rowNumber: 5,
      policy: INSTITUICAO_MATCH_POLICY_RUN,
      reconciliacoes: { 5: "inst-manual" },
      findById: async (id) => (id === "inst-manual" ? { id } : null),
    });
    expect(result).toMatchObject({
      outcome: "update",
      reason: "reconciliation_manual",
      matchStrategy: "reconciliation",
      instituicaoId: "inst-manual",
    });
  });

  test("reconciliation NEW cai no match automático", async () => {
    const { where } = planInstituicaoSemCnpjMatch(baseRow());
    const result = await resolveInstituicao({
      row: baseRow(),
      rowNumber: 5,
      policy: INSTITUICAO_MATCH_POLICY_RUN,
      reconciliacoes: { 5: "NEW" },
      findCandidatesSemCnpj: async (w) => {
        expect(w).toEqual(where);
        return [{ id: "inst-auto", cnpj: null }];
      },
    });
    expect(result).toMatchObject({
      outcome: "update",
      reason: "match_sem_cnpj",
      instituicaoId: "inst-auto",
    });
  });

  test("create new_sem_cnpj sem candidatos", async () => {
    const result = await resolveInstituicao({
      row: baseRow(),
      policy: INSTITUICAO_MATCH_POLICY_RUN,
      findCandidatesSemCnpj: async () => [],
    });
    expect(result).toEqual({
      outcome: "create",
      reason: "new_sem_cnpj",
      policy: INSTITUICAO_MATCH_POLICY_RUN,
    });
  });

  test("update match_sem_cnpj com candidateIds", async () => {
    const result = await resolveInstituicao({
      row: baseRow(),
      policy: INSTITUICAO_MATCH_POLICY_RUN,
      findCandidatesSemCnpj: async () => [
        { id: "i1", cnpj: null },
        { id: "i2", cnpj: VALID_CNPJ },
      ],
      findById: async (id) => ({ id }),
    });
    expect(result).toMatchObject({
      outcome: "update",
      reason: "match_sem_cnpj",
      instituicaoId: "i2",
      candidateIds: ["i1", "i2"],
    });
  });
});

describe("resolveInstituicao (policy PREVIEW)", () => {
  test("reject CNPJ inválido (paridade com run)", async () => {
    const result = await resolveInstituicao({
      row: baseRow({ cnpjDigits: "123" }),
      policy: INSTITUICAO_MATCH_POLICY_PREVIEW,
    });
    expect(result).toMatchObject({
      outcome: "reject",
      reason: "invalid_cnpj",
    });
  });

  test("sem_cnpj usa findFirstSemCnpj, não findCandidatesSemCnpj", async () => {
    const { where } = planInstituicaoSemCnpjMatch(baseRow());
    let findManyCalled = false;
    const result = await resolveInstituicao({
      row: baseRow(),
      policy: INSTITUICAO_MATCH_POLICY_PREVIEW,
      findFirstSemCnpj: async (w) => {
        expect(w).toEqual(where);
        return { id: "inst-first" };
      },
      findCandidatesSemCnpj: async () => {
        findManyCalled = true;
        return [{ id: "other", cnpj: VALID_CNPJ }];
      },
    });
    expect(findManyCalled).toBe(false);
    expect(result).toMatchObject({
      outcome: "update",
      reason: "match_sem_cnpj",
      instituicaoId: "inst-first",
      policy: INSTITUICAO_MATCH_POLICY_PREVIEW,
    });
    expect(result).not.toHaveProperty("candidateIds");
  });

  test("ignora reconciliação manual no preview", async () => {
    let findFirstCalled = false;
    const result = await resolveInstituicao({
      row: baseRow(),
      rowNumber: 5,
      policy: INSTITUICAO_MATCH_POLICY_PREVIEW,
      reconciliacoes: { 5: "inst-manual" },
      findById: async (id) => ({ id }),
      findFirstSemCnpj: async () => {
        findFirstCalled = true;
        return null;
      },
    });
    expect(findFirstCalled).toBe(true);
    expect(result).toEqual({
      outcome: "create",
      reason: "new_sem_cnpj",
      policy: INSTITUICAO_MATCH_POLICY_PREVIEW,
    });
  });

  test("create new_sem_cnpj quando findFirst vazio", async () => {
    const result = await resolveInstituicao({
      row: baseRow(),
      policy: INSTITUICAO_MATCH_POLICY_PREVIEW,
      findFirstSemCnpj: async () => null,
    });
    expect(result).toEqual({
      outcome: "create",
      reason: "new_sem_cnpj",
      policy: INSTITUICAO_MATCH_POLICY_PREVIEW,
    });
  });
});
