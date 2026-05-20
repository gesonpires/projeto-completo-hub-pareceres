import type { Prisma } from "@/generated/prisma/client";
import { buildInstituicaoWhereSemCnpj } from "./importMatchWhere";
import { getInstituicaoCnpjRejectionMessage } from "./importRowNormalize";
import type { NormalizedImportRow } from "./importRowTypes";

/** Política de match de instituição na importação CSV (MVP). */
export const INSTITUICAO_MATCH_POLICY_RUN = "run" as const;
export const INSTITUICAO_MATCH_POLICY_PREVIEW = "preview" as const;

export type InstituicaoMatchPolicy =
  | typeof INSTITUICAO_MATCH_POLICY_RUN
  | typeof INSTITUICAO_MATCH_POLICY_PREVIEW;

export type InstituicaoMatchStrategy = "cnpj" | "reconciliation" | "nome_normalizado";

export type InstituicaoCreateReason = "new_cnpj" | "new_sem_cnpj";

export type InstituicaoUpdateReason =
  | "cnpj_existing"
  | "reconciliation_manual"
  | "match_sem_cnpj";

export type InstituicaoResolveSkip = {
  outcome: "skip";
  reason: "missing_nome";
};

export type InstituicaoResolveReject = {
  outcome: "reject";
  reason: "invalid_cnpj";
  message: string;
};

export type InstituicaoResolveCreate = {
  outcome: "create";
  reason: InstituicaoCreateReason;
  policy: InstituicaoMatchPolicy;
};

export type InstituicaoResolveUpdate<TExisting = { id: string }> = {
  outcome: "update";
  reason: InstituicaoUpdateReason;
  policy: InstituicaoMatchPolicy;
  matchStrategy: InstituicaoMatchStrategy;
  instituicaoId: string;
  existing: TExisting;
  /** Candidatos considerados no match sem CNPJ (até 5). */
  candidateIds?: string[];
};

export type InstituicaoResolveResult<TExisting = { id: string }> =
  | InstituicaoResolveSkip
  | InstituicaoResolveReject
  | InstituicaoResolveCreate
  | InstituicaoResolveUpdate<TExisting>;

export type InstituicaoSemCnpjCandidate = {
  id: string;
  cnpj: string | null;
};

/**
 * Desempate do run: preferir candidato com CNPJ; senão o primeiro retornado.
 */
export function pickInstituicaoSemCnpjCandidate<T extends InstituicaoSemCnpjCandidate>(
  candidates: T[],
): T | null {
  return candidates.find((c) => Boolean(c.cnpj)) ?? candidates[0] ?? null;
}

export type PlanInstituicaoSemCnpjMatchResult = {
  where: Prisma.InstituicaoWhereInput;
};

export function planInstituicaoSemCnpjMatch(
  row: NormalizedImportRow,
): PlanInstituicaoSemCnpjMatchResult {
  return { where: buildInstituicaoWhereSemCnpj(row) };
}

export type ResolveInstituicaoInput<TExisting = { id: string }> = {
  row: NormalizedImportRow;
  policy: InstituicaoMatchPolicy;
  rowNumber?: number;
  reconciliacoes?: Record<number, string>;
  findByCnpj?: (cnpj: string) => Promise<TExisting | null>;
  findById?: (id: string) => Promise<TExisting | null>;
  findCandidatesSemCnpj?: (
    where: Prisma.InstituicaoWhereInput,
  ) => Promise<InstituicaoSemCnpjCandidate[]>;
  /** Preview/dry-run: `findFirst` na chave sem CNPJ (sem desempate findMany). */
  findFirstSemCnpj?: (
    where: Prisma.InstituicaoWhereInput,
  ) => Promise<TExisting | null>;
};

async function resolveInstituicaoSemCnpjPreview<TExisting extends { id: string }>(
  input: ResolveInstituicaoInput<TExisting>,
): Promise<InstituicaoResolveResult<TExisting>> {
  const { where } = planInstituicaoSemCnpjMatch(input.row);
  const existing = input.findFirstSemCnpj
    ? await input.findFirstSemCnpj(where)
    : null;

  if (existing) {
    return {
      outcome: "update",
      reason: "match_sem_cnpj",
      policy: input.policy,
      matchStrategy: "nome_normalizado",
      instituicaoId: existing.id,
      existing,
    };
  }

  return {
    outcome: "create",
    reason: "new_sem_cnpj",
    policy: input.policy,
  };
}

async function resolveInstituicaoSemCnpjRun<TExisting extends { id: string }>(
  input: ResolveInstituicaoInput<TExisting>,
): Promise<InstituicaoResolveResult<TExisting>> {
  const chosen =
    input.rowNumber !== undefined
      ? input.reconciliacoes?.[input.rowNumber]
      : undefined;

  if (chosen && chosen !== "NEW" && input.findById) {
    const existing = await input.findById(chosen);
    if (existing) {
      return {
        outcome: "update",
        reason: "reconciliation_manual",
        policy: input.policy,
        matchStrategy: "reconciliation",
        instituicaoId: existing.id,
        existing,
      };
    }
  }

  const { where } = planInstituicaoSemCnpjMatch(input.row);
  const candidates = input.findCandidatesSemCnpj
    ? await input.findCandidatesSemCnpj(where)
    : [];
  const best = pickInstituicaoSemCnpjCandidate(candidates);

  if (best) {
    const existing = input.findById
      ? await input.findById(best.id)
      : null;

    return {
      outcome: "update",
      reason: "match_sem_cnpj",
      policy: input.policy,
      matchStrategy: "nome_normalizado",
      instituicaoId: best.id,
      existing: existing ?? ({ id: best.id } as TExisting),
      candidateIds: candidates.map((c) => c.id),
    };
  }

  return {
    outcome: "create",
    reason: "new_sem_cnpj",
    policy: input.policy,
  };
}

/**
 * Resolver read-only de instituição na importação CSV.
 * Persistência (upsert/create/update) fica no consumidor.
 */
export async function resolveInstituicao<TExisting extends { id: string } = { id: string }>(
  input: ResolveInstituicaoInput<TExisting>,
): Promise<InstituicaoResolveResult<TExisting>> {
  if (!input.row.nome) {
    return { outcome: "skip", reason: "missing_nome" };
  }

  const cnpjRejection = getInstituicaoCnpjRejectionMessage(input.row.cnpjDigits);
  if (cnpjRejection) {
    return {
      outcome: "reject",
      reason: "invalid_cnpj",
      message: cnpjRejection,
    };
  }

  if (input.row.cnpjDigits) {
    const existing = input.findByCnpj
      ? await input.findByCnpj(input.row.cnpjDigits)
      : null;
    if (existing) {
      return {
        outcome: "update",
        reason: "cnpj_existing",
        policy: input.policy,
        matchStrategy: "cnpj",
        instituicaoId: existing.id,
        existing,
      };
    }
    return {
      outcome: "create",
      reason: "new_cnpj",
      policy: input.policy,
    };
  }

  if (input.policy === INSTITUICAO_MATCH_POLICY_PREVIEW) {
    return resolveInstituicaoSemCnpjPreview(input);
  }

  if (input.policy === INSTITUICAO_MATCH_POLICY_RUN) {
    return resolveInstituicaoSemCnpjRun(input);
  }

  throw new Error(`Política de instituição não suportada: ${input.policy}`);
}
