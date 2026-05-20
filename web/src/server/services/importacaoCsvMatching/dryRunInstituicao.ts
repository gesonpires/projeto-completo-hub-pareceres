import { getInstituicaoCnpjRejectionMessage } from "./importRowNormalize";
import type { NormalizedImportRow } from "./importRowTypes";

export type DryRunInstituicaoBranch =
  | { kind: "skip"; reason: "missing_nome" }
  | { kind: "skip"; reason: "invalid_cnpj"; message: string }
  | { kind: "cnpj" }
  | { kind: "sem_cnpj" };

/**
 * Pré-classificação legada (3B.4-2A); o dry-run usa `resolveInstituicao` (3B.4-2B).
 * Mantido para testes de contrato da validação de CNPJ.
 */
export function planDryRunInstituicaoBranch(
  row: NormalizedImportRow,
): DryRunInstituicaoBranch {
  if (!row.nome) {
    return { kind: "skip", reason: "missing_nome" };
  }

  const cnpjRejection = getInstituicaoCnpjRejectionMessage(row.cnpjDigits);
  if (cnpjRejection) {
    return { kind: "skip", reason: "invalid_cnpj", message: cnpjRejection };
  }

  if (row.cnpjDigits) {
    return { kind: "cnpj" };
  }

  return { kind: "sem_cnpj" };
}
