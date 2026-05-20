import type { Prisma } from "@/generated/prisma/client";
import { buildEventoWhere } from "./importMatchWhere";
import type { NormalizedImportRow } from "./importRowTypes";

export type EventoCreateReason =
  | "missing_instituicao"
  | "no_match_key"
  | "not_found";

export type EventoResolveSkip = { outcome: "skip" };

export type EventoResolveCreate = {
  outcome: "create";
  reason: EventoCreateReason;
};

export type EventoResolveUpdate<TExisting = { id: string }> = {
  outcome: "update";
  existing: TExisting;
  where: Prisma.EventoRegulatorioWhereInput;
};

export type EventoResolveResult<TExisting = { id: string }> =
  | EventoResolveSkip
  | EventoResolveCreate
  | EventoResolveUpdate<TExisting>;

export type PlanEventoMatchResult = {
  where: Prisma.EventoRegulatorioWhereInput | null;
};

/** Plano de match (sem I/O) compartilhado por run e dry-run. */
export function planEventoMatch(
  instituicaoId: string,
  row: NormalizedImportRow,
): PlanEventoMatchResult {
  return { where: buildEventoWhere(instituicaoId, row) };
}

export type ResolveEventoInput<TExisting = { id: string }> = {
  instituicaoId: string | null;
  row: NormalizedImportRow;
  findExisting?: (
    where: Prisma.EventoRegulatorioWhereInput,
  ) => Promise<TExisting | null>;
};

/**
 * Resolver read-only de evento regulatório na importação CSV.
 */
export async function resolveEvento<TExisting = { id: string }>(
  input: ResolveEventoInput<TExisting>,
): Promise<EventoResolveResult<TExisting>> {
  if (!input.row.hasEvento) {
    return { outcome: "skip" };
  }

  if (!input.instituicaoId) {
    return { outcome: "create", reason: "missing_instituicao" };
  }

  const { where } = planEventoMatch(input.instituicaoId, input.row);

  if (!where) {
    return { outcome: "create", reason: "no_match_key" };
  }

  const existing = input.findExisting
    ? await input.findExisting(where)
    : null;

  if (existing) {
    return { outcome: "update", existing, where };
  }

  return { outcome: "create", reason: "not_found" };
}
