import { prisma } from "@/server/db";
import { INTEGRATION_CNPJ_B2 } from "./csvFixtures";
import { INTEGRATION_ACTOR_USER_ID } from "./seedMinimal";

export type B2SeedResult = {
  /** Inserido primeiro; sem CNPJ (preview `findFirst` pegaria este). */
  semCnpjId: string;
  /** Segundo candidato na mesma chave; RUN prefere por ter CNPJ. */
  comCnpjId: string;
};

/**
 * B2: dois candidatos para `nomeNormalizado` + município + UF iguais.
 * `pickInstituicaoSemCnpjCandidate` no run escolhe o que possui CNPJ.
 */
export async function seedB2DualSemCnpjCandidates(): Promise<B2SeedResult> {
  const semCnpj = await prisma.instituicao.create({
    data: {
      nome: "Escola Alfa Primeira Sem Cnpj",
      nomeNormalizado: "ESCOLA ALFA",
      municipio: "Florianópolis",
      uf: "SC",
      cnpj: null,
      createdBy: INTEGRATION_ACTOR_USER_ID,
      updatedBy: INTEGRATION_ACTOR_USER_ID,
    },
  });

  const comCnpj = await prisma.instituicao.create({
    data: {
      nome: "Escola Alfa Com Cnpj Preferida",
      nomeNormalizado: "ESCOLA ALFA",
      municipio: "Florianópolis",
      uf: "SC",
      cnpj: INTEGRATION_CNPJ_B2,
      createdBy: INTEGRATION_ACTOR_USER_ID,
      updatedBy: INTEGRATION_ACTOR_USER_ID,
    },
  });

  return { semCnpjId: semCnpj.id, comCnpjId: comCnpj.id };
}
