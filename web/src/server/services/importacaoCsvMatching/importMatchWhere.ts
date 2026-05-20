import type { Prisma } from "@/generated/prisma/client";
import type { NormalizedImportRow } from "./importRowTypes";

export type InstituicaoSemCnpjRow = Pick<
  NormalizedImportRow,
  "nomeNormalizado" | "municipio" | "uf"
>;

/** Match instituição sem CNPJ (nomeNormalizado + município/UF opcionais). */
export function buildInstituicaoWhereSemCnpj(
  row: InstituicaoSemCnpjRow,
): Prisma.InstituicaoWhereInput {
  return {
    deletedAt: null,
    nomeNormalizado: row.nomeNormalizado,
    ...(row.municipio
      ? { municipio: { equals: row.municipio, mode: "insensitive" } }
      : {}),
    ...(row.uf ? { uf: { equals: row.uf, mode: "insensitive" } } : {}),
  };
}

export type ProcessoMatchKind = "numeroAno" | "numeroSemAno" | null;

/**
 * Variante de match de processo (run e dry-run compartilham a mesma regra desde 3B.3).
 */
export function resolveProcessoMatchKind(
  row: NormalizedImportRow,
): ProcessoMatchKind {
  if (!row.procNumero) return null;
  if (row.procAno !== null) return "numeroAno";
  return "numeroSemAno";
}

export function buildProcessoWhere(
  instituicaoId: string,
  row: NormalizedImportRow,
  kind: ProcessoMatchKind,
): Prisma.ProcessoWhereInput | null {
  if (kind === "numeroAno") {
    return {
      deletedAt: null,
      instituicaoId,
      numero: row.procNumero,
      ano: row.procAno,
    };
  }
  if (kind === "numeroSemAno") {
    return {
      deletedAt: null,
      instituicaoId,
      numero: row.procNumero,
      ano: null,
    };
  }
  return null;
}

export type AtoMatchOptions = {
  /** Run inclui `numero` na chave; dry-run do MVP não (3B.3). */
  includeNumero?: boolean;
};

export function buildAtoWhere(
  instituicaoId: string,
  row: Pick<NormalizedImportRow, "atoTipo" | "atoData" | "atoNumero">,
  options?: AtoMatchOptions,
): Prisma.AtoAutorizativoWhereInput | null {
  if (!row.atoTipo || !row.atoData) return null;
  return {
    deletedAt: null,
    instituicaoId,
    tipo: row.atoTipo,
    dataAto: row.atoData,
    ...(options?.includeNumero
      ? row.atoNumero
        ? { numero: row.atoNumero }
        : { numero: null }
      : {}),
  };
}

export function buildEventoWhere(
  instituicaoId: string,
  row: Pick<NormalizedImportRow, "eventoTipo" | "eventoData" | "eventoDescricao">,
): Prisma.EventoRegulatorioWhereInput | null {
  if (!row.eventoTipo || !row.eventoData || !row.eventoDescricao) return null;
  return {
    deletedAt: null,
    instituicaoId,
    tipo: row.eventoTipo,
    dataEvento: row.eventoData,
    descricao: row.eventoDescricao,
  };
}

export function buildDocumentoWhere(
  instituicaoId: string,
  tipoDocumentoId: string,
  row: Pick<NormalizedImportRow, "docTitulo" | "docData">,
): Prisma.DocumentoWhereInput {
  return {
    deletedAt: null,
    instituicaoId,
    tipoDocumentoId,
    titulo: row.docTitulo!,
    ...(row.docData ? { dataDocumento: row.docData } : { dataDocumento: null }),
  };
}
