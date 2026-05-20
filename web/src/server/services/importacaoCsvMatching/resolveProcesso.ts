import type { Prisma } from "@/generated/prisma/client";
import {
  buildProcessoWhere,
  resolveProcessoMatchKind,
  type ProcessoMatchKind,
} from "./importMatchWhere";
import type { NormalizedImportRow } from "./importRowTypes";

export type ProcessoResolveSkip = { outcome: "skip" };

export type ProcessoCreateReason =
  | "missing_instituicao"
  | "no_match_key"
  | "not_found";

export type ProcessoResolveCreate = {
  outcome: "create";
  reason: ProcessoCreateReason;
  matchKind: ProcessoMatchKind;
};

export type ProcessoResolveUpdate<TExisting = { id: string }> = {
  outcome: "update";
  matchKind: ProcessoMatchKind;
  existing: TExisting;
  where: Prisma.ProcessoWhereInput;
};

export type ProcessoResolveResult<TExisting = { id: string }> =
  | ProcessoResolveSkip
  | ProcessoResolveCreate
  | ProcessoResolveUpdate<TExisting>;

export type PlanProcessoMatchResult = {
  matchKind: ProcessoMatchKind;
  where: Prisma.ProcessoWhereInput | null;
};

/** Plano de match (sem I/O) compartilhado por run e dry-run. */
export function planProcessoMatch(
  instituicaoId: string,
  row: NormalizedImportRow,
): PlanProcessoMatchResult {
  const matchKind = resolveProcessoMatchKind(row);
  const where = matchKind
    ? buildProcessoWhere(instituicaoId, row, matchKind)
    : null;
  return { matchKind, where };
}

export type ResolveProcessoInput<TExisting = { id: string }> = {
  instituicaoId: string | null;
  row: NormalizedImportRow;
  findExisting?: (
    where: Prisma.ProcessoWhereInput,
  ) => Promise<TExisting | null>;
};

/**
 * Resolver read-only de processo na importação CSV.
 * Run e dry-run devem usar o mesmo resultado antes de persistir ou contar impacto.
 */
export async function resolveProcesso<TExisting = { id: string }>(
  input: ResolveProcessoInput<TExisting>,
): Promise<ProcessoResolveResult<TExisting>> {
  if (!input.row.hasProcesso) {
    return { outcome: "skip" };
  }

  if (!input.instituicaoId) {
    return {
      outcome: "create",
      reason: "missing_instituicao",
      matchKind: resolveProcessoMatchKind(input.row),
    };
  }

  const { matchKind, where } = planProcessoMatch(
    input.instituicaoId,
    input.row,
  );

  if (!where || !matchKind) {
    return {
      outcome: "create",
      reason: "no_match_key",
      matchKind,
    };
  }

  const existing = input.findExisting
    ? await input.findExisting(where)
    : null;

  if (existing) {
    return {
      outcome: "update",
      matchKind,
      existing,
      where,
    };
  }

  return {
    outcome: "create",
    reason: "not_found",
    matchKind,
  };
}
