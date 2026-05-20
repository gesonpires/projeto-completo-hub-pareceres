import { prisma } from "@/server/db";

/**
 * Limpa dados de domínio entre testes (preserva enums de referência recriados no seed).
 * Usa CASCADE para respeitar FKs sem ordem manual frágil.
 */
export async function resetIntegrationDatabase() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "LogAuditoria",
      "AuditoriaExportJob",
      "Tramitacao",
      "Documento",
      "EventoRegulatorio",
      "AtoAutorizativo",
      "Processo",
      "Instituicao",
      "Mantenedora",
      "ImportacaoLote",
      "FonteDados",
      "Comissao",
      "Usuario",
      "Perfil",
      "TipoDocumento"
    RESTART IDENTITY CASCADE
  `);
}
