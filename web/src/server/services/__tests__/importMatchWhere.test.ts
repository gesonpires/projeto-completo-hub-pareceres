import { describe, expect, test } from "vitest";
import {
  buildAtoWhere,
  buildDocumentoWhere,
  buildEventoWhere,
  buildInstituicaoWhereSemCnpj,
  buildProcessoWhere,
  resolveProcessoMatchKind,
} from "../importacaoCsvMatching/importMatchWhere";
import type { NormalizedImportRow } from "../importacaoCsvMatching/importRowTypes";

const baseRow = (): NormalizedImportRow => ({
  nome: "Escola",
  nomeNormalizado: "ESCOLA",
  cnpjDigits: "",
  municipio: "Florianópolis",
  uf: "SC",
  procNumero: "123",
  procAnoRaw: "2024",
  procAno: 2024,
  procStatus: "ABERTO",
  procAssunto: null,
  hasProcesso: true,
  atoTipo: "PARECER",
  atoNumero: "1",
  atoData: new Date("2024-01-15T00:00:00.000Z"),
  atoEmenta: null,
  atoDescricao: null,
  hasAto: true,
  eventoTipo: "PROTOCOLO",
  eventoData: new Date("2024-02-01T00:00:00.000Z"),
  eventoDescricao: "Desc",
  hasEvento: true,
  docTipo: "OFICIO",
  docData: null,
  docTitulo: "Título",
  hasDocumento: true,
});

describe("buildInstituicaoWhereSemCnpj", () => {
  test("inclui nomeNormalizado e filtros opcionais", () => {
    const where = buildInstituicaoWhereSemCnpj({
      nomeNormalizado: "ESCOLA ALFA",
      municipio: "São José",
      uf: "SC",
    });
    expect(where).toMatchObject({
      deletedAt: null,
      nomeNormalizado: "ESCOLA ALFA",
      municipio: { equals: "São José", mode: "insensitive" },
      uf: { equals: "SC", mode: "insensitive" },
    });
  });

  test("omite municipio e uf quando ausentes", () => {
    const where = buildInstituicaoWhereSemCnpj({
      nomeNormalizado: "ESCOLA",
      municipio: null,
      uf: null,
    });
    expect(where).toEqual({ deletedAt: null, nomeNormalizado: "ESCOLA" });
  });
});

describe("resolveProcessoMatchKind", () => {
  test("ano inválido usa numeroSemAno", () => {
    const row = { ...baseRow(), procAnoRaw: "abc", procAno: null };
    expect(resolveProcessoMatchKind(row)).toBe("numeroSemAno");
  });

  test("procAnoRaw vazio usa numeroSemAno", () => {
    const row = { ...baseRow(), procAnoRaw: "", procAno: null };
    expect(resolveProcessoMatchKind(row)).toBe("numeroSemAno");
  });
});

describe("buildProcessoWhere", () => {
  test("numeroAno", () => {
    const row = baseRow();
    expect(buildProcessoWhere("inst-1", row, "numeroAno")).toEqual({
      deletedAt: null,
      instituicaoId: "inst-1",
      numero: "123",
      ano: 2024,
    });
  });
});

describe("buildAtoWhere", () => {
  test("run inclui numero na chave", () => {
    const row = baseRow();
    expect(buildAtoWhere("inst-1", row, { includeNumero: true })).toMatchObject({
      deletedAt: null,
      instituicaoId: "inst-1",
      tipo: "PARECER",
      numero: "1",
    });
  });

  test("preview sem numero na chave", () => {
    const row = baseRow();
    const where = buildAtoWhere("inst-1", row);
    expect(where).toMatchObject({
      tipo: "PARECER",
      instituicaoId: "inst-1",
    });
    expect(where).not.toHaveProperty("numero");
  });
});

describe("buildEventoWhere", () => {
  test("monta chave completa", () => {
    const row = baseRow();
    expect(buildEventoWhere("inst-1", row)).toMatchObject({
      instituicaoId: "inst-1",
      tipo: "PROTOCOLO",
      descricao: "Desc",
    });
  });
});

describe("buildDocumentoWhere", () => {
  test("dataDocumento null quando ausente", () => {
    const row = baseRow();
    expect(buildDocumentoWhere("inst-1", "tipo-id", row)).toEqual({
      deletedAt: null,
      instituicaoId: "inst-1",
      tipoDocumentoId: "tipo-id",
      titulo: "Título",
      dataDocumento: null,
    });
  });
});
