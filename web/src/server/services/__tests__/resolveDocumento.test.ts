import { describe, expect, test } from "vitest";
import {
  planDocumentoMatch,
  resolveDocumento,
} from "../importacaoCsvMatching/resolveDocumento";
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
  eventoTipo: null,
  eventoData: null,
  eventoDescricao: null,
  hasEvento: false,
  docTipo: "OFICIO",
  docData: null,
  docTitulo: "Ofício 01",
  hasDocumento: true,
  ...overrides,
});

describe("planDocumentoMatch", () => {
  test("dataDocumento null quando ausente", () => {
    const row = baseRow();
    expect(planDocumentoMatch("inst-1", "tipo-id", row).where).toEqual({
      deletedAt: null,
      instituicaoId: "inst-1",
      tipoDocumentoId: "tipo-id",
      titulo: "Ofício 01",
      dataDocumento: null,
    });
  });

  test("inclui dataDocumento quando presente", () => {
    const data = new Date("2024-03-01T00:00:00.000Z");
    const row = baseRow({ docData: data });
    expect(planDocumentoMatch("inst-1", "tipo-id", row).where.dataDocumento).toEqual(
      data,
    );
  });
});

describe("resolveDocumento", () => {
  test("skip quando linha sem documento", async () => {
    const result = await resolveDocumento({
      instituicaoId: "inst-1",
      tipoDocumentoId: "tipo-id",
      row: baseRow({ hasDocumento: false }),
    });
    expect(result).toEqual({ outcome: "skip" });
  });

  test("unknown_tipo sem consulta ao banco", async () => {
    let called = false;
    const result = await resolveDocumento({
      instituicaoId: "inst-1",
      tipoDocumentoId: null,
      row: baseRow(),
      findExisting: async () => {
        called = true;
        return { id: "d1" };
      },
    });
    expect(result).toEqual({ outcome: "unknown_tipo" });
    expect(called).toBe(false);
  });

  test("create missing_instituicao", async () => {
    const result = await resolveDocumento({
      instituicaoId: null,
      tipoDocumentoId: "tipo-id",
      row: baseRow(),
    });
    expect(result).toEqual({
      outcome: "create",
      reason: "missing_instituicao",
    });
  });

  test("update quando findExisting retorna registro", async () => {
    const row = baseRow();
    const { where } = planDocumentoMatch("inst-1", "tipo-id", row);
    const result = await resolveDocumento({
      instituicaoId: "inst-1",
      tipoDocumentoId: "tipo-id",
      row,
      findExisting: async (w) => {
        expect(w).toEqual(where);
        return { id: "doc-1" };
      },
    });
    expect(result).toMatchObject({
      outcome: "update",
      existing: { id: "doc-1" },
    });
  });

  test("create not_found com where planificado", async () => {
    const row = baseRow();
    const { where } = planDocumentoMatch("inst-1", "tipo-id", row);
    const result = await resolveDocumento({
      instituicaoId: "inst-1",
      tipoDocumentoId: "tipo-id",
      row,
      findExisting: async (w) => {
        expect(w).toEqual(where);
        return null;
      },
    });
    expect(result).toMatchObject({
      outcome: "create",
      reason: "not_found",
    });
  });

  test("paridade: mesmo where em plan e resolve", async () => {
    const row = baseRow({ docData: new Date("2024-01-10T00:00:00.000Z") });
    const plan = planDocumentoMatch("inst-1", "tipo-id", row);
    const resolved = await resolveDocumento({
      instituicaoId: "inst-1",
      tipoDocumentoId: "tipo-id",
      row,
      findExisting: async (where) => {
        expect(where).toEqual(plan.where);
        return null;
      },
    });
    expect(resolved).toMatchObject({ outcome: "create", reason: "not_found" });
  });
});
