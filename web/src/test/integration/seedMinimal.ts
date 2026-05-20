import { prisma } from "@/server/db";

/** Usuário fixo para auditoria e `criadoPor` em lotes de importação. */
export const INTEGRATION_ACTOR_USER_ID = "a1000000-0000-4000-8000-000000000001";

export type IntegrationSeedOptions = {
  /** Tipos cadastrados em `TipoDocumento` (default: OFICIO e RESOLUCAO — sem PARECER). */
  tipoDocumentoCodigos?: Array<"OFICIO" | "PARECER" | "RESOLUCAO" | "OUTRO">;
};

/** Inclui OFICIO (cenário D — documento válido) e omite PARECER (cenário C — unknown_tipo). */
const DEFAULT_TIPOS: IntegrationSeedOptions["tipoDocumentoCodigos"] = [
  "OFICIO",
  "RESOLUCAO",
];

/**
 * Seed mínima: perfil, usuário ator e tipos de documento configuráveis.
 */
export async function seedIntegrationMinimal(
  options: IntegrationSeedOptions = {},
) {
  const tipos = options.tipoDocumentoCodigos ?? DEFAULT_TIPOS;

  const perfil = await prisma.perfil.upsert({
    where: { nome: "OPERADOR_DADOS" },
    create: { nome: "OPERADOR_DADOS", descricao: "Integração" },
    update: {},
  });

  await prisma.usuario.upsert({
    where: { email: "integration-test@cee-sc.local" },
    create: {
      id: INTEGRATION_ACTOR_USER_ID,
      email: "integration-test@cee-sc.local",
      nome: "Integration Test",
      ativo: true,
      perfilId: perfil.id,
    },
    update: {
      ativo: true,
      perfilId: perfil.id,
    },
  });

  const tipoDefs = [
    { codigo: "OFICIO" as const, nome: "Ofício" },
    { codigo: "PARECER" as const, nome: "Parecer" },
    { codigo: "RESOLUCAO" as const, nome: "Resolução" },
    { codigo: "OUTRO" as const, nome: "Outro" },
  ];

  for (const t of tipoDefs) {
    if (!tipos.includes(t.codigo)) continue;
    await prisma.tipoDocumento.upsert({
      where: { codigo: t.codigo },
      create: t,
      update: { nome: t.nome },
    });
  }
}
