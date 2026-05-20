-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PerfilNome" AS ENUM ('ADMIN', 'OPERADOR_DADOS', 'ANALISTA', 'LEITOR');

-- CreateEnum
CREATE TYPE "ImportacaoStatus" AS ENUM ('CRIADO', 'VALIDADO', 'IMPORTADO', 'COM_PENDENCIAS', 'FALHOU');

-- CreateEnum
CREATE TYPE "AuditoriaAcao" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'RESTORE');

-- CreateEnum
CREATE TYPE "InstituicaoSituacao" AS ENUM ('ATIVA', 'INATIVA', 'EM_ANALISE');

-- CreateEnum
CREATE TYPE "ProcessoStatus" AS ENUM ('ABERTO', 'EM_TRAMITACAO', 'CONCLUIDO', 'ARQUIVADO');

-- CreateEnum
CREATE TYPE "ProcessoTipo" AS ENUM ('CREDENCIAMENTO', 'AUTORIZACAO', 'RENOVACAO', 'OUTRO');

-- CreateEnum
CREATE TYPE "TipoDocumentoCodigo" AS ENUM ('OFICIO', 'PARECER', 'RESOLUCAO', 'OUTRO');

-- CreateEnum
CREATE TYPE "FonteDadosTipo" AS ENUM ('ARQWORD', 'XLSX', 'CSV', 'GSHEET', 'OUTRO');

-- CreateEnum
CREATE TYPE "AtoTipo" AS ENUM ('PARECER', 'RESOLUCAO', 'PORTARIA', 'OUTRO');

-- CreateEnum
CREATE TYPE "EventoTipo" AS ENUM ('PROTOCOLO', 'DILIGENCIA', 'REUNIAO', 'DECISAO', 'OUTRO');

-- CreateEnum
CREATE TYPE "TramitacaoStatus" AS ENUM ('ENCAMINHADO', 'RECEBIDO', 'DEVOLVIDO', 'OUTRO');

-- CreateTable
CREATE TABLE "Perfil" (
    "id" UUID NOT NULL,
    "nome" "PerfilNome" NOT NULL,
    "descricao" TEXT,

    CONSTRAINT "Perfil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "perfilId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comissao" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Comissao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mantenedora" (
    "id" UUID NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "cnpj" TEXT,
    "nomeNormalizado" TEXT NOT NULL,
    "observacoes" TEXT,
    "fonteDadosId" UUID,
    "importacaoLoteId" UUID,
    "sourceRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" UUID,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Mantenedora_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Instituicao" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "nomeNormalizado" TEXT NOT NULL,
    "cnpj" TEXT,
    "municipio" TEXT,
    "uf" TEXT,
    "situacao" "InstituicaoSituacao",
    "endereco" TEXT,
    "mantenedoraId" UUID,
    "fonteDadosId" UUID,
    "importacaoLoteId" UUID,
    "sourceRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" UUID,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Instituicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Processo" (
    "id" UUID NOT NULL,
    "instituicaoId" UUID NOT NULL,
    "numero" TEXT,
    "ano" INTEGER,
    "tipo" "ProcessoTipo",
    "status" "ProcessoStatus" NOT NULL DEFAULT 'ABERTO',
    "dataAbertura" DATE,
    "dataConclusao" DATE,
    "assunto" TEXT,
    "fonteDadosId" UUID,
    "importacaoLoteId" UUID,
    "sourceRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" UUID,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Processo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TipoDocumento" (
    "id" UUID NOT NULL,
    "codigo" "TipoDocumentoCodigo" NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "TipoDocumento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Documento" (
    "id" UUID NOT NULL,
    "tipoDocumentoId" UUID NOT NULL,
    "instituicaoId" UUID,
    "processoId" UUID,
    "titulo" TEXT NOT NULL,
    "dataDocumento" DATE,
    "arquivoNome" TEXT,
    "arquivoMime" TEXT,
    "arquivoTamanho" INTEGER,
    "storagePath" TEXT,
    "textoExtraido" TEXT,
    "fonteDadosId" UUID,
    "importacaoLoteId" UUID,
    "sourceRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" UUID,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AtoAutorizativo" (
    "id" UUID NOT NULL,
    "instituicaoId" UUID NOT NULL,
    "processoId" UUID,
    "tipo" "AtoTipo" NOT NULL,
    "numero" TEXT,
    "dataAto" DATE NOT NULL,
    "ementa" TEXT,
    "descricao" TEXT,
    "fonteDadosId" UUID,
    "importacaoLoteId" UUID,
    "sourceRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" UUID,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AtoAutorizativo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoRegulatorio" (
    "id" UUID NOT NULL,
    "instituicaoId" UUID NOT NULL,
    "processoId" UUID,
    "tipo" "EventoTipo" NOT NULL,
    "dataEvento" DATE NOT NULL,
    "descricao" TEXT NOT NULL,
    "fonteDadosId" UUID,
    "importacaoLoteId" UUID,
    "sourceRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" UUID,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EventoRegulatorio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tramitacao" (
    "id" UUID NOT NULL,
    "processoId" UUID NOT NULL,
    "dataMovimento" DATE NOT NULL,
    "deSetor" TEXT,
    "paraSetor" TEXT,
    "status" "TramitacaoStatus",
    "observacao" TEXT,
    "fonteDadosId" UUID,
    "importacaoLoteId" UUID,
    "sourceRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" UUID,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Tramitacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FonteDados" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "FonteDadosTipo" NOT NULL,
    "descricao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FonteDados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportacaoLote" (
    "id" UUID NOT NULL,
    "fonteDadosId" UUID NOT NULL,
    "arquivoNome" TEXT NOT NULL,
    "arquivoHash" TEXT,
    "status" "ImportacaoStatus" NOT NULL DEFAULT 'CRIADO',
    "contagemLidas" INTEGER NOT NULL DEFAULT 0,
    "contagemImportadas" INTEGER NOT NULL DEFAULT 0,
    "contagemRejeitadas" INTEGER NOT NULL DEFAULT 0,
    "relatorioErros" JSONB,
    "reconciliacoes" JSONB,
    "relatorioImpacto" JSONB,
    "criadoPor" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "ImportacaoLote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogAuditoria" (
    "id" UUID NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" UUID NOT NULL,
    "acao" "AuditoriaAcao" NOT NULL,
    "actorUserId" UUID NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "antes" JSONB,
    "depois" JSONB,
    "metadata" JSONB,

    CONSTRAINT "LogAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Perfil_nome_key" ON "Perfil"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Comissao_nome_key" ON "Comissao"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Mantenedora_cnpj_key" ON "Mantenedora"("cnpj");

-- CreateIndex
CREATE INDEX "Mantenedora_nomeNormalizado_idx" ON "Mantenedora"("nomeNormalizado");

-- CreateIndex
CREATE UNIQUE INDEX "Instituicao_cnpj_key" ON "Instituicao"("cnpj");

-- CreateIndex
CREATE INDEX "Instituicao_nomeNormalizado_idx" ON "Instituicao"("nomeNormalizado");

-- CreateIndex
CREATE INDEX "Instituicao_municipio_idx" ON "Instituicao"("municipio");

-- CreateIndex
CREATE INDEX "Processo_instituicaoId_status_idx" ON "Processo"("instituicaoId", "status");

-- CreateIndex
CREATE INDEX "Processo_numero_idx" ON "Processo"("numero");

-- CreateIndex
CREATE INDEX "Processo_ano_idx" ON "Processo"("ano");

-- CreateIndex
CREATE UNIQUE INDEX "TipoDocumento_codigo_key" ON "TipoDocumento"("codigo");

-- CreateIndex
CREATE INDEX "Documento_instituicaoId_dataDocumento_idx" ON "Documento"("instituicaoId", "dataDocumento");

-- CreateIndex
CREATE INDEX "Documento_processoId_dataDocumento_idx" ON "Documento"("processoId", "dataDocumento");

-- CreateIndex
CREATE INDEX "AtoAutorizativo_instituicaoId_dataAto_idx" ON "AtoAutorizativo"("instituicaoId", "dataAto");

-- CreateIndex
CREATE INDEX "EventoRegulatorio_instituicaoId_dataEvento_idx" ON "EventoRegulatorio"("instituicaoId", "dataEvento");

-- CreateIndex
CREATE INDEX "Tramitacao_processoId_dataMovimento_idx" ON "Tramitacao"("processoId", "dataMovimento");

-- CreateIndex
CREATE UNIQUE INDEX "FonteDados_nome_key" ON "FonteDados"("nome");

-- CreateIndex
CREATE INDEX "LogAuditoria_entidade_entidadeId_idx" ON "LogAuditoria"("entidade", "entidadeId");

-- CreateIndex
CREATE INDEX "LogAuditoria_actorUserId_timestamp_idx" ON "LogAuditoria"("actorUserId", "timestamp");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_perfilId_fkey" FOREIGN KEY ("perfilId") REFERENCES "Perfil"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instituicao" ADD CONSTRAINT "Instituicao_mantenedoraId_fkey" FOREIGN KEY ("mantenedoraId") REFERENCES "Mantenedora"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Processo" ADD CONSTRAINT "Processo_instituicaoId_fkey" FOREIGN KEY ("instituicaoId") REFERENCES "Instituicao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_tipoDocumentoId_fkey" FOREIGN KEY ("tipoDocumentoId") REFERENCES "TipoDocumento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_instituicaoId_fkey" FOREIGN KEY ("instituicaoId") REFERENCES "Instituicao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "Processo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtoAutorizativo" ADD CONSTRAINT "AtoAutorizativo_instituicaoId_fkey" FOREIGN KEY ("instituicaoId") REFERENCES "Instituicao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtoAutorizativo" ADD CONSTRAINT "AtoAutorizativo_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "Processo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoRegulatorio" ADD CONSTRAINT "EventoRegulatorio_instituicaoId_fkey" FOREIGN KEY ("instituicaoId") REFERENCES "Instituicao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoRegulatorio" ADD CONSTRAINT "EventoRegulatorio_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "Processo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tramitacao" ADD CONSTRAINT "Tramitacao_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "Processo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportacaoLote" ADD CONSTRAINT "ImportacaoLote_fonteDadosId_fkey" FOREIGN KEY ("fonteDadosId") REFERENCES "FonteDados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportacaoLote" ADD CONSTRAINT "ImportacaoLote_criadoPor_fkey" FOREIGN KEY ("criadoPor") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogAuditoria" ADD CONSTRAINT "LogAuditoria_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
