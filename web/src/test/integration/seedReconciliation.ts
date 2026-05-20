import { prisma } from "@/server/db";
import { INTEGRATION_ACTOR_USER_ID } from "./seedMinimal";

export type ReconciliationSeedResult = {
  /** Candidato que o auto-match sem CNPJ escolheria (mesma chave nome+município). */
  autoMatchId: string;
  /** Instituição canônica indicada manualmente no mapa `reconciliacoes`. */
  canonicalId: string;
};

/**
 * Duas instituições sem CNPJ: uma casa com a chave da linha CSV (auto-match),
 * outra distinta para receber reconciliação manual no run.
 */
export async function seedReconciliationCandidates(): Promise<ReconciliationSeedResult> {
  const auto = await prisma.instituicao.create({
    data: {
      nome: "Escola Alfa Candidata",
      nomeNormalizado: "ESCOLA ALFA",
      municipio: "Florianópolis",
      uf: "SC",
      cnpj: null,
      createdBy: INTEGRATION_ACTOR_USER_ID,
      updatedBy: INTEGRATION_ACTOR_USER_ID,
    },
  });

  const canonical = await prisma.instituicao.create({
    data: {
      nome: "Instituição Canônica Reconciliação",
      nomeNormalizado: "INSTITUICAO CANONICA RECONCILIACAO",
      municipio: "São José",
      uf: "SC",
      cnpj: null,
      createdBy: INTEGRATION_ACTOR_USER_ID,
      updatedBy: INTEGRATION_ACTOR_USER_ID,
    },
  });

  return { autoMatchId: auto.id, canonicalId: canonical.id };
}
