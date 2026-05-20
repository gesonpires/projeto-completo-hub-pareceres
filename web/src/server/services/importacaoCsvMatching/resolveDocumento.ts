import type { Prisma } from "@/generated/prisma/client";
import { buildDocumentoWhere } from "./importMatchWhere";
import type { NormalizedImportRow } from "./importRowTypes";

export type DocumentoCreateReason =
  | "missing_instituicao"
  | "not_found";

export type DocumentoResolveSkip = { outcome: "skip" };

export type DocumentoResolveUnknownTipo = { outcome: "unknown_tipo" };

export type DocumentoResolveCreate = {
  outcome: "create";
  reason: DocumentoCreateReason;
  /** Presente quando instituição e tipo estão disponíveis (match planificado). */
  where?: Prisma.DocumentoWhereInput;
};

export type DocumentoResolveUpdate<TExisting = { id: string }> = {
  outcome: "update";
  existing: TExisting;
  where: Prisma.DocumentoWhereInput;
};

export type DocumentoResolveResult<TExisting = { id: string }> =
  | DocumentoResolveSkip
  | DocumentoResolveUnknownTipo
  | DocumentoResolveCreate
  | DocumentoResolveUpdate<TExisting>;

export type PlanDocumentoMatchResult = {
  where: Prisma.DocumentoWhereInput;
};

/** Plano de match (sem I/O) compartilhado por run e dry-run. */
export function planDocumentoMatch(
  instituicaoId: string,
  tipoDocumentoId: string,
  row: NormalizedImportRow,
): PlanDocumentoMatchResult {
  return {
    where: buildDocumentoWhere(instituicaoId, tipoDocumentoId, row),
  };
}

export type ResolveDocumentoInput<TExisting = { id: string }> = {
  instituicaoId: string | null;
  tipoDocumentoId: string | null;
  row: NormalizedImportRow;
  findExisting?: (
    where: Prisma.DocumentoWhereInput,
  ) => Promise<TExisting | null>;
};

/**
 * Resolver read-only de documento na importação CSV.
 * `unknown_tipo`: run rejeita a linha; dry-run não incrementa contadores.
 */
export async function resolveDocumento<TExisting = { id: string }>(
  input: ResolveDocumentoInput<TExisting>,
): Promise<DocumentoResolveResult<TExisting>> {
  if (!input.row.hasDocumento) {
    return { outcome: "skip" };
  }

  if (!input.tipoDocumentoId) {
    return { outcome: "unknown_tipo" };
  }

  if (!input.instituicaoId) {
    return { outcome: "create", reason: "missing_instituicao" };
  }

  const { where } = planDocumentoMatch(
    input.instituicaoId,
    input.tipoDocumentoId,
    input.row,
  );

  const existing = input.findExisting
    ? await input.findExisting(where)
    : null;

  if (existing) {
    return { outcome: "update", existing, where };
  }

  return { outcome: "create", reason: "not_found", where };
}
