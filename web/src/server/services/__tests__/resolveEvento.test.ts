import { describe, expect, test } from "vitest";
import {
  planEventoMatch,
  resolveEvento,
} from "../importacaoCsvMatching/resolveEvento";
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
  atoTipo: null,
  atoNumero: null,
  atoData: null,
  atoEmenta: null,
  atoDescricao: null,
  hasAto: false,
  eventoTipo: "PROTOCOLO",
  eventoData: new Date("2024-02-01T00:00:00.000Z"),
  eventoDescricao: "Protocolo inicial",
  hasEvento: true,
  docTipo: null,
  docData: null,
  docTitulo: null,
  hasDocumento: false,
  ...overrides,
});

describe("planEventoMatch", () => {
  test("monta chave completa", () => {
    const row = baseRow();
    expect(planEventoMatch("inst-1", row)).toEqual({
      where: {
        deletedAt: null,
        instituicaoId: "inst-1",
        tipo: "PROTOCOLO",
        dataEvento: row.eventoData,
        descricao: "Protocolo inicial",
      },
    });
  });
});

describe("resolveEvento", () => {
  test("skip quando linha sem evento", async () => {
    const result = await resolveEvento({
      instituicaoId: "inst-1",
      row: baseRow({ hasEvento: false }),
    });
    expect(result).toEqual({ outcome: "skip" });
  });

  test("create missing_instituicao sem consulta ao banco", async () => {
    let called = false;
    const result = await resolveEvento({
      instituicaoId: null,
      row: baseRow(),
      findExisting: async () => {
        called = true;
        return { id: "e1" };
      },
    });
    expect(result).toEqual({
      outcome: "create",
      reason: "missing_instituicao",
    });
    expect(called).toBe(false);
  });

  test("update quando findExisting retorna registro", async () => {
    const row = baseRow();
    const { where } = planEventoMatch("inst-1", row);
    const result = await resolveEvento({
      instituicaoId: "inst-1",
      row,
      findExisting: async (w) => {
        expect(w).toEqual(where);
        return { id: "evt-1" };
      },
    });
    expect(result).toMatchObject({
      outcome: "update",
      existing: { id: "evt-1" },
    });
  });

  test("create not_found quando banco vazio", async () => {
    const result = await resolveEvento({
      instituicaoId: "inst-1",
      row: baseRow(),
      findExisting: async () => null,
    });
    expect(result).toEqual({ outcome: "create", reason: "not_found" });
  });

  test("paridade: campos parciais sem hasEvento → skip (não conta create)", async () => {
    const result = await resolveEvento({
      instituicaoId: null,
      row: baseRow({
        hasEvento: false,
        eventoTipo: "PROTOCOLO",
        eventoData: null,
        eventoDescricao: null,
      }),
    });
    expect(result).toEqual({ outcome: "skip" });
  });
});
