-- CreateEnum
CREATE TYPE "ExportJobStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'ERROR');

-- CreateEnum
CREATE TYPE "AuditExportFormat" AS ENUM ('CSV', 'JSON');

-- AlterTable
ALTER TABLE "ImportacaoLote" ADD COLUMN "arquivoTipo" "FonteDadosTipo" NOT NULL DEFAULT 'CSV',
ADD COLUMN "arquivoMeta" JSONB;

-- AlterTable
ALTER TABLE "Documento" ADD COLUMN "atoId" UUID,
ADD COLUMN "eventoId" UUID;

-- CreateIndex
CREATE INDEX "Instituicao_uf_idx" ON "Instituicao"("uf");

-- CreateIndex
CREATE INDEX "Documento_atoId_dataDocumento_idx" ON "Documento"("atoId", "dataDocumento");

-- CreateIndex
CREATE INDEX "Documento_eventoId_dataDocumento_idx" ON "Documento"("eventoId", "dataDocumento");

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_atoId_fkey" FOREIGN KEY ("atoId") REFERENCES "AtoAutorizativo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "EventoRegulatorio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "AuditoriaExportJob" (
    "id" UUID NOT NULL,
    "status" "ExportJobStatus" NOT NULL DEFAULT 'PENDING',
    "format" "AuditExportFormat" NOT NULL DEFAULT 'CSV',
    "filtros" JSONB,
    "limit" INTEGER NOT NULL DEFAULT 10000,
    "arquivoPath" TEXT,
    "error" TEXT,
    "criadoPor" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "AuditoriaExportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditoriaExportJob_status_createdAt_idx" ON "AuditoriaExportJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AuditoriaExportJob_criadoPor_createdAt_idx" ON "AuditoriaExportJob"("criadoPor", "createdAt");

-- AddForeignKey
ALTER TABLE "AuditoriaExportJob" ADD CONSTRAINT "AuditoriaExportJob_criadoPor_fkey" FOREIGN KEY ("criadoPor") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
