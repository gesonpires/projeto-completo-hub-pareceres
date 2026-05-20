import { describe, expect, test } from "vitest";
import {
  ATO_MATCH_POLICY_PREVIEW,
  ATO_MATCH_POLICY_RUN,
  atoMatchPolicyIncludesNumero,
  planAtoMatch,
  resolveAto,
} from "../importacaoCsvMatching/resolveAto";
import type { NormalizedImportRow } from "../importacaoCsvMatching/importRowTypes";

const baseRow = (overrides: Partial<NormalizedImportRow> = {}): NormalizedImportRow => ({
  nome: "Escola",
  nomeNormalizado: "ESCOLA",
  cnpjDigits: "",
  municipio: null,
  uf: null,
  procNumero: null,
  procAnoRaw: "",
  procAno: null,
  procStatus: "ABERTO",
  procAssunto: null,
  hasProcesso: false,
  atoTipo: "PARECER",
  atoNumero: "42",
  atoData: new Date("2024-01-15T00:00:00.000Z"),
  atoEmenta: "Ementa",
  atoDescricao: null,
  hasAto: true,
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

describe("atoMatchPolicyIncludesNumero", () => {
  test("run inclui numero; preview não", () => {
    expect(atoMatchPolicyIncludesNumero(ATO_MATCH_POLICY_RUN)).toBe(true);
    expect(atoMatchPolicyIncludesNumero(ATO_MATCH_POLICY_PREVIEW)).toBe(false);
  });
});

describe("planAtoMatch", () => {
  test("run inclui numero na chave", () => {
    const row = baseRow();
    const plan = planAtoMatch("inst-1", row, ATO_MATCH_POLICY_RUN);
    expect(plan.includeNumeroInKey).toBe(true);
    expect(plan.where).toMatchObject({
      instituicaoId: "inst-1",
      tipo: "PARECER",
      numero: "42",
    });
  });

  test("preview omite numero na chave", () => {
    const row = baseRow();
    const plan = planAtoMatch("inst-1", row, ATO_MATCH_POLICY_PREVIEW);
    expect(plan.includeNumeroInKey).toBe(false);
    expect(plan.where).toMatchObject({
      instituicaoId: "inst-1",
      tipo: "PARECER",
    });
    expect(plan.where).not.toHaveProperty("numero");
  });

  test("run com numero ausente usa numero null na chave", () => {
    const row = baseRow({ atoNumero: null });
    const plan = planAtoMatch("inst-1", row, ATO_MATCH_POLICY_RUN);
    expect(plan.where).toMatchObject({ numero: null });
  });
});

describe("resolveAto", () => {
  test("skip quando linha sem ato", async () => {
    const result = await resolveAto({
      instituicaoId: "inst-1",
      row: baseRow({ hasAto: false }),
      policy: ATO_MATCH_POLICY_RUN,
    });
    expect(result).toEqual({ outcome: "skip" });
  });

  test("create missing_instituicao sem consulta ao banco", async () => {
    let called = false;
    const result = await resolveAto({
      instituicaoId: null,
      row: baseRow(),
      policy: ATO_MATCH_POLICY_PREVIEW,
      findExisting: async () => {
        called = true;
        return { id: "a1" };
      },
    });
    expect(result).toEqual({
      outcome: "create",
      reason: "missing_instituicao",
      policy: ATO_MATCH_POLICY_PREVIEW,
    });
    expect(called).toBe(false);
  });

  test("contrato: mesma estrutura de decisão, políticas distintas de where", async () => {
    const row = baseRow();
    const runPlan = planAtoMatch("inst-1", row, ATO_MATCH_POLICY_RUN);
    const previewPlan = planAtoMatch("inst-1", row, ATO_MATCH_POLICY_PREVIEW);

    const runResolved = await resolveAto({
      instituicaoId: "inst-1",
      row,
      policy: ATO_MATCH_POLICY_RUN,
      findExisting: async (where) => {
        expect(where).toEqual(runPlan.where);
        return null;
      },
    });
    const previewResolved = await resolveAto({
      instituicaoId: "inst-1",
      row,
      policy: ATO_MATCH_POLICY_PREVIEW,
      findExisting: async (where) => {
        expect(where).toEqual(previewPlan.where);
        return { id: "ato-preview" };
      },
    });

    expect(runResolved).toMatchObject({
      outcome: "create",
      reason: "not_found",
      policy: ATO_MATCH_POLICY_RUN,
    });
    expect(previewResolved).toMatchObject({
      outcome: "update",
      policy: ATO_MATCH_POLICY_PREVIEW,
      existing: { id: "ato-preview" },
    });
    expect(runPlan.where).not.toEqual(previewPlan.where);
  });

  test("update propaga policy no resultado", async () => {
    const result = await resolveAto({
      instituicaoId: "inst-1",
      row: baseRow(),
      policy: ATO_MATCH_POLICY_RUN,
      findExisting: async () => ({ id: "ato-1" }),
    });
    expect(result).toMatchObject({
      outcome: "update",
      policy: ATO_MATCH_POLICY_RUN,
      existing: { id: "ato-1" },
    });
  });
});
