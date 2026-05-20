import { describe, expect, test } from "vitest";
import { resolveProcessoMatchKind } from "../importacaoCsvMatching/importMatchWhere";
import {
  planProcessoMatch,
  resolveProcesso,
} from "../importacaoCsvMatching/resolveProcesso";
import type { NormalizedImportRow } from "../importacaoCsvMatching/importRowTypes";

const baseRow = (overrides: Partial<NormalizedImportRow> = {}): NormalizedImportRow => ({
  nome: "Escola",
  nomeNormalizado: "ESCOLA",
  cnpjDigits: "",
  municipio: null,
  uf: null,
  procNumero: "123",
  procAnoRaw: "2024",
  procAno: 2024,
  procStatus: "ABERTO",
  procAssunto: null,
  hasProcesso: true,
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

describe("resolveProcessoMatchKind (paridade run/dry-run)", () => {
  test("ano inválido usa numeroSemAno", () => {
    const row = baseRow({ procAnoRaw: "abc", procAno: null });
    expect(resolveProcessoMatchKind(row)).toBe("numeroSemAno");
  });

  test("sem procAnoRaw usa numeroSemAno", () => {
    const row = baseRow({ procAnoRaw: "", procAno: null });
    expect(resolveProcessoMatchKind(row)).toBe("numeroSemAno");
  });

  test("sem procNumero não gera chave", () => {
    const row = baseRow({
      procNumero: null,
      procAnoRaw: "2024",
      procAno: 2024,
    });
    expect(resolveProcessoMatchKind(row)).toBeNull();
  });
});

describe("planProcessoMatch", () => {
  test("monta where numeroAno", () => {
    const row = baseRow();
    expect(planProcessoMatch("inst-1", row)).toEqual({
      matchKind: "numeroAno",
      where: {
        deletedAt: null,
        instituicaoId: "inst-1",
        numero: "123",
        ano: 2024,
      },
    });
  });
});

describe("resolveProcesso", () => {
  test("skip quando linha sem processo", async () => {
    const result = await resolveProcesso({
      instituicaoId: "inst-1",
      row: baseRow({ hasProcesso: false }),
    });
    expect(result).toEqual({ outcome: "skip" });
  });

  test("create missing_instituicao sem consulta ao banco", async () => {
    let called = false;
    const result = await resolveProcesso({
      instituicaoId: null,
      row: baseRow(),
      findExisting: async () => {
        called = true;
        return { id: "p1" };
      },
    });
    expect(result).toEqual({
      outcome: "create",
      reason: "missing_instituicao",
      matchKind: "numeroAno",
    });
    expect(called).toBe(false);
  });

  test("create no_match_key sem procNumero", async () => {
    const result = await resolveProcesso({
      instituicaoId: "inst-1",
      row: baseRow({ procNumero: null }),
    });
    expect(result).toMatchObject({
      outcome: "create",
      reason: "no_match_key",
      matchKind: null,
    });
  });

  test("update quando findExisting retorna registro", async () => {
    const row = baseRow();
    const { where } = planProcessoMatch("inst-1", row);
    const result = await resolveProcesso({
      instituicaoId: "inst-1",
      row,
      findExisting: async (w) => {
        expect(w).toEqual(where);
        return { id: "proc-existing" };
      },
    });
    expect(result).toMatchObject({
      outcome: "update",
      matchKind: "numeroAno",
      existing: { id: "proc-existing" },
    });
  });

  test("create not_found quando chave existe mas banco vazio", async () => {
    const result = await resolveProcesso({
      instituicaoId: "inst-1",
      row: baseRow({ procAnoRaw: "abc", procAno: null }),
      findExisting: async () => null,
    });
    expect(result).toMatchObject({
      outcome: "create",
      reason: "not_found",
      matchKind: "numeroSemAno",
    });
  });

  test("paridade: ano inválido gera mesmo where em plan e resolve", async () => {
    const row = baseRow({ procAnoRaw: "abc", procAno: null });
    const plan = planProcessoMatch("inst-1", row);
    expect(plan.matchKind).toBe("numeroSemAno");
    const resolved = await resolveProcesso({
      instituicaoId: "inst-1",
      row,
      findExisting: async (where) => {
        expect(where).toEqual(plan.where);
        return null;
      },
    });
    expect(resolved).toMatchObject({
      outcome: "create",
      reason: "not_found",
      matchKind: "numeroSemAno",
    });
  });
});
