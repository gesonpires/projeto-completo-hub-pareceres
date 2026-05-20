import type { Prisma } from "@/generated/prisma/client";
import { buildAtoWhere } from "./importMatchWhere";
import type { NormalizedImportRow } from "./importRowTypes";

/** Política de match de ato na importação CSV (MVP). */
export const ATO_MATCH_POLICY_RUN = "run" as const;
export const ATO_MATCH_POLICY_PREVIEW = "preview" as const;

export type AtoMatchPolicy =
  | typeof ATO_MATCH_POLICY_RUN
  | typeof ATO_MATCH_POLICY_PREVIEW;

/** Run inclui `numero` na chave; preview do MVP não (decisão de produto pendente). */
export function atoMatchPolicyIncludesNumero(policy: AtoMatchPolicy): boolean {
  return policy === ATO_MATCH_POLICY_RUN;
}

export type AtoCreateReason =
  | "missing_instituicao"
  | "no_match_key"
  | "not_found";

export type AtoResolveSkip = { outcome: "skip" };

export type AtoResolveCreate = {
  outcome: "create";
  reason: AtoCreateReason;
  policy: AtoMatchPolicy;
};

export type AtoResolveUpdate<TExisting = { id: string }> = {
  outcome: "update";
  policy: AtoMatchPolicy;
  existing: TExisting;
  where: Prisma.AtoAutorizativoWhereInput;
};

export type AtoResolveResult<TExisting = { id: string }> =
  | AtoResolveSkip
  | AtoResolveCreate
  | AtoResolveUpdate<TExisting>;

export type PlanAtoMatchResult = {
  policy: AtoMatchPolicy;
  includeNumeroInKey: boolean;
  where: Prisma.AtoAutorizativoWhereInput | null;
};

/** Plano de match (sem I/O) compartilhado por run e dry-run. */
export function planAtoMatch(
  instituicaoId: string,
  row: NormalizedImportRow,
  policy: AtoMatchPolicy,
): PlanAtoMatchResult {
  const includeNumeroInKey = atoMatchPolicyIncludesNumero(policy);
  return {
    policy,
    includeNumeroInKey,
    where: buildAtoWhere(instituicaoId, row, {
      includeNumero: includeNumeroInKey,
    }),
  };
}

export type ResolveAtoInput<TExisting = { id: string }> = {
  instituicaoId: string | null;
  row: NormalizedImportRow;
  policy: AtoMatchPolicy;
  findExisting?: (
    where: Prisma.AtoAutorizativoWhereInput,
  ) => Promise<TExisting | null>;
};

/**
 * Resolver read-only de ato autorizativo na importação CSV.
 * A política `preview` omite `numero` da chave de match (comportamento MVP do dry-run).
 */
export async function resolveAto<TExisting = { id: string }>(
  input: ResolveAtoInput<TExisting>,
): Promise<AtoResolveResult<TExisting>> {
  if (!input.row.hasAto) {
    return { outcome: "skip" };
  }

  if (!input.instituicaoId) {
    return {
      outcome: "create",
      reason: "missing_instituicao",
      policy: input.policy,
    };
  }

  const { where } = planAtoMatch(
    input.instituicaoId,
    input.row,
    input.policy,
  );

  if (!where) {
    return {
      outcome: "create",
      reason: "no_match_key",
      policy: input.policy,
    };
  }

  const existing = input.findExisting
    ? await input.findExisting(where)
    : null;

  if (existing) {
    return {
      outcome: "update",
      policy: input.policy,
      existing,
      where,
    };
  }

  return {
    outcome: "create",
    reason: "not_found",
    policy: input.policy,
  };
}
