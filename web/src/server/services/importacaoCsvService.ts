import crypto from "node:crypto";
import { prisma } from "@/server/db";
import { auditLog } from "@/server/audit";
import { parseCsvSafe } from "@/server/imports/csvMvpCore";
import { normalizeImportRow } from "./importacaoCsvMatching/importRowNormalize";
import {
  INSTITUICAO_MATCH_POLICY_RUN,
  resolveInstituicao,
} from "./importacaoCsvMatching/resolveInstituicao";
import {
  ATO_MATCH_POLICY_RUN,
  resolveAto,
} from "./importacaoCsvMatching/resolveAto";
import { resolveDocumento } from "./importacaoCsvMatching/resolveDocumento";
import { resolveEvento } from "./importacaoCsvMatching/resolveEvento";
import { resolveProcesso } from "./importacaoCsvMatching/resolveProcesso";
import type { ImportacaoCsvRunInput, ImportacaoCsvRunResult } from "./importacaoCsvTypes";

export type { ImportacaoCsvRunInput, ImportacaoCsvRunResult } from "./importacaoCsvTypes";
export { ImportacaoCsvRunFormSchema } from "./importacaoCsvSchemas";
export type { ImportacaoCsvRunFormInput } from "./importacaoCsvSchemas";
export {
  assertCsvReadyForImport,
  parseImportSourceInfo,
  parseReconciliacoesJson,
} from "./importacaoCsvRunValidation";
export {
  previewImportacaoCsv,
  previewImportacaoCsvFromUpload,
} from "./importacaoCsvPreviewService";
export type { ImportacaoCsvPreviewResult } from "./importacaoCsvPreviewTypes";
export type {
  ImportacaoCsvRunGuardResult,
  ImportSourceInfoParsed,
  ReconciliacoesParsed,
} from "./importacaoCsvRunValidation";
export { normalizeImportRow, getInstituicaoCnpjRejectionMessage } from "./importacaoCsvMatching/importRowNormalize";
export type { NormalizedImportRow } from "./importacaoCsvMatching/importRowTypes";
export {
  buildAtoWhere,
  buildDocumentoWhere,
  buildEventoWhere,
  buildInstituicaoWhereSemCnpj,
  buildProcessoWhere,
  resolveProcessoMatchKind,
} from "./importacaoCsvMatching/importMatchWhere";
export {
  planProcessoMatch,
  resolveProcesso,
} from "./importacaoCsvMatching/resolveProcesso";
export type {
  PlanProcessoMatchResult,
  ProcessoCreateReason,
  ProcessoResolveResult,
} from "./importacaoCsvMatching/resolveProcesso";
export {
  planEventoMatch,
  resolveEvento,
} from "./importacaoCsvMatching/resolveEvento";
export type {
  EventoCreateReason,
  EventoResolveResult,
  PlanEventoMatchResult,
} from "./importacaoCsvMatching/resolveEvento";
export {
  planDocumentoMatch,
  resolveDocumento,
} from "./importacaoCsvMatching/resolveDocumento";
export type {
  DocumentoCreateReason,
  DocumentoResolveResult,
  PlanDocumentoMatchResult,
} from "./importacaoCsvMatching/resolveDocumento";
export {
  ATO_MATCH_POLICY_PREVIEW,
  ATO_MATCH_POLICY_RUN,
  atoMatchPolicyIncludesNumero,
  planAtoMatch,
  resolveAto,
} from "./importacaoCsvMatching/resolveAto";
export type {
  AtoCreateReason,
  AtoMatchPolicy,
  AtoResolveResult,
  PlanAtoMatchResult,
} from "./importacaoCsvMatching/resolveAto";
export {
  INSTITUICAO_MATCH_POLICY_PREVIEW,
  INSTITUICAO_MATCH_POLICY_RUN,
  pickInstituicaoSemCnpjCandidate,
  planInstituicaoSemCnpjMatch,
  resolveInstituicao,
} from "./importacaoCsvMatching/resolveInstituicao";
export type {
  InstituicaoCreateReason,
  InstituicaoMatchPolicy,
  InstituicaoResolveResult,
  InstituicaoUpdateReason,
} from "./importacaoCsvMatching/resolveInstituicao";

/**
 * Executa a importação CSV/XLSX MVP: cria lote, persiste linhas e auditoria.
 * Fronteira: após parse/validação de entrada (responsabilidade da action).
 */
export async function runImportacaoCsv(
  input: ImportacaoCsvRunInput,
): Promise<ImportacaoCsvRunResult> {
  const { records, error } = parseCsvSafe(input.csvText);
  if (error) {
    throw new Error(`Falha ao ler CSV: ${error}`);
  }

  const arquivoHash = crypto
    .createHash("sha256")
    .update(input.csvText, "utf8")
    .digest("hex");

  const arquivoTipo = input.arquivoTipo ?? "CSV";
  const fonteNome = input.fonteNome ?? (arquivoTipo === "XLSX" ? "XLSX_MVP" : "CSV_MVP");
  const fonte = await prisma.fonteDados.upsert({
    where: { nome: fonteNome },
    create: {
      nome: fonteNome,
      tipo: arquivoTipo === "XLSX" ? "XLSX" : "CSV",
      descricao: arquivoTipo === "XLSX" ? "Importação XLSX (MVP)" : "Importação CSV (MVP)",
    },
    update: {},
  });

  const lote = await prisma.importacaoLote.create({
    data: {
      fonteDadosId: fonte.id,
      arquivoNome: input.arquivoNome,
      arquivoHash,
      arquivoTipo: arquivoTipo === "XLSX" ? "XLSX" : "CSV",
      arquivoMeta: (input.arquivoMeta ?? null) as never,
      status: "CRIADO",
      criadoPor: input.actorUserId,
      contagemLidas: records.length,
      reconciliacoes: (input.reconciliacoes ?? null) as never,
    },
  });

  await auditLog({
    entidade: "importacoes",
    entidadeId: lote.id,
    acao: "CREATE",
    actorUserId: input.actorUserId,
    depois: lote,
    metadata: { fonte: fonte.nome, arquivoNome: input.arquivoNome },
  });

  let imported = 0;
  let rejected = 0;
  let instCreated = 0;
  let instUpdated = 0;
  let procCreated = 0;
  let procUpdated = 0;
  let atoCreated = 0;
  let atoUpdated = 0;
  let eventoCreated = 0;
  let eventoUpdated = 0;
  let docCreated = 0;
  let docUpdated = 0;
  const errors: Array<{ rowNumber: number; message: string }> = [];

  for (let i = 0; i < records.length; i++) {
    const rowNumber = i + 2;
    const row = normalizeImportRow(records[i]);

    const instAuditSelect = {
      id: true,
      nome: true,
      nomeNormalizado: true,
      cnpj: true,
      municipio: true,
      uf: true,
      fonteDadosId: true,
      importacaoLoteId: true,
      sourceRef: true,
      deletedAt: true,
    } as const;

    const instResolved = await resolveInstituicao({
      row,
      rowNumber,
      policy: INSTITUICAO_MATCH_POLICY_RUN,
      reconciliacoes: input.reconciliacoes,
      findByCnpj: (cnpj) =>
        prisma.instituicao.findUnique({
          where: { cnpj },
          select: instAuditSelect,
        }),
      findById: (id) =>
        prisma.instituicao.findFirst({
          where: { id, deletedAt: null },
        }),
      findCandidatesSemCnpj: (where) =>
        prisma.instituicao.findMany({
          where,
          select: {
            id: true,
            cnpj: true,
            fonteDadosId: true,
            importacaoLoteId: true,
            sourceRef: true,
          },
          take: 5,
        }),
    });

    if (instResolved.outcome === "skip") {
      rejected++;
      errors.push({ rowNumber, message: "instituicao_nome é obrigatório" });
      continue;
    }
    if (instResolved.outcome === "reject") {
      rejected++;
      errors.push({ rowNumber, message: instResolved.message });
      continue;
    }

    const instituicao = await (async () => {
      if (instResolved.outcome === "create" && instResolved.reason === "new_cnpj") {
        const inst = await prisma.instituicao.upsert({
          where: { cnpj: row.cnpjDigits },
          create: {
            nome: row.nome,
            nomeNormalizado: row.nomeNormalizado,
            cnpj: row.cnpjDigits,
            municipio: row.municipio,
            uf: row.uf,
            fonteDadosId: fonte.id,
            importacaoLoteId: lote.id,
            sourceRef: `row:${rowNumber}`,
            createdBy: input.actorUserId,
            updatedBy: input.actorUserId,
          },
          update: {
            nome: row.nome,
            nomeNormalizado: row.nomeNormalizado,
            municipio: row.municipio,
            uf: row.uf,
            updatedBy: input.actorUserId,
          },
        });
        instCreated++;
        await auditLog({
          entidade: "instituicoes",
          entidadeId: inst.id,
          acao: "CREATE",
          actorUserId: input.actorUserId,
          depois: inst,
          metadata: { source: "import", loteId: lote.id, rowNumber },
        });
        return inst;
      }

      if (instResolved.outcome === "update" && instResolved.reason === "cnpj_existing") {
        const existed = instResolved.existing;
        const inst = await prisma.instituicao.upsert({
          where: { cnpj: row.cnpjDigits },
          create: {
            nome: row.nome,
            nomeNormalizado: row.nomeNormalizado,
            cnpj: row.cnpjDigits,
            municipio: row.municipio,
            uf: row.uf,
            fonteDadosId: fonte.id,
            importacaoLoteId: lote.id,
            sourceRef: `row:${rowNumber}`,
            createdBy: input.actorUserId,
            updatedBy: input.actorUserId,
          },
          update: {
            nome: row.nome,
            nomeNormalizado: row.nomeNormalizado,
            municipio: row.municipio,
            uf: row.uf,
            updatedBy: input.actorUserId,
          },
        });
        instUpdated++;
        await auditLog({
          entidade: "instituicoes",
          entidadeId: inst.id,
          acao: "UPDATE",
          actorUserId: input.actorUserId,
          antes: existed,
          depois: inst,
          metadata: { source: "import", loteId: lote.id, rowNumber },
        });
        return inst;
      }

      if (
        instResolved.outcome === "update" &&
        instResolved.reason === "reconciliation_manual"
      ) {
        const existing = instResolved.existing;
        instUpdated++;
        const updated = await prisma.instituicao.update({
          where: { id: existing.id },
          data: {
            nome: row.nome,
            nomeNormalizado: row.nomeNormalizado,
            municipio: row.municipio,
            uf: row.uf,
            updatedBy: input.actorUserId,
            fonteDadosId: existing.fonteDadosId ?? fonte.id,
            importacaoLoteId: existing.importacaoLoteId ?? lote.id,
            sourceRef: existing.sourceRef ?? `row:${rowNumber}`,
          },
        });
        await auditLog({
          entidade: "instituicoes",
          entidadeId: updated.id,
          acao: "UPDATE",
          actorUserId: input.actorUserId,
          antes: existing,
          depois: updated,
          metadata: {
            source: "import",
            loteId: lote.id,
            rowNumber,
            reconciliadoPara: existing.id,
          },
        });
        return updated;
      }

      if (instResolved.outcome === "update" && instResolved.reason === "match_sem_cnpj") {
        const before = await prisma.instituicao.findUnique({
          where: { id: instResolved.instituicaoId },
        });
        instUpdated++;
        const updated = await prisma.instituicao.update({
          where: { id: instResolved.instituicaoId },
          data: {
            nome: row.nome,
            nomeNormalizado: row.nomeNormalizado,
            municipio: row.municipio,
            uf: row.uf,
            updatedBy: input.actorUserId,
            fonteDadosId: before?.fonteDadosId ?? fonte.id,
            importacaoLoteId: before?.importacaoLoteId ?? lote.id,
            sourceRef: before?.sourceRef ?? `row:${rowNumber}`,
          },
        });
        await auditLog({
          entidade: "instituicoes",
          entidadeId: updated.id,
          acao: "UPDATE",
          actorUserId: input.actorUserId,
          antes: before ?? instResolved.existing,
          depois: updated,
          metadata: { source: "import", loteId: lote.id, rowNumber, match: "nomeNormalizado" },
        });
        return updated;
      }

      if (instResolved.outcome === "create" && instResolved.reason === "new_sem_cnpj") {
        const created = await prisma.instituicao.create({
          data: {
            nome: row.nome,
            nomeNormalizado: row.nomeNormalizado,
            cnpj: null,
            municipio: row.municipio,
            uf: row.uf,
            fonteDadosId: fonte.id,
            importacaoLoteId: lote.id,
            sourceRef: `row:${rowNumber}`,
            createdBy: input.actorUserId,
            updatedBy: input.actorUserId,
          },
        });
        instCreated++;
        await auditLog({
          entidade: "instituicoes",
          entidadeId: created.id,
          acao: "CREATE",
          actorUserId: input.actorUserId,
          depois: created,
          metadata: { source: "import", loteId: lote.id, rowNumber },
        });
        return created;
      }

      throw new Error(
        `Resolução de instituição não suportada: ${JSON.stringify(instResolved)}`,
      );
    })();

    if (row.hasProcesso) {
      const procResolved = await resolveProcesso({
        instituicaoId: instituicao.id,
        row,
        findExisting: (where) =>
          prisma.processo.findFirst({
            where,
            select: {
              id: true,
              numero: true,
              ano: true,
              status: true,
              assunto: true,
              fonteDadosId: true,
              importacaoLoteId: true,
              sourceRef: true,
              deletedAt: true,
            },
          }),
      });

      if (procResolved.outcome === "update") {
        const existingProc = procResolved.existing;
        procUpdated++;
        const updatedProc = await prisma.processo.update({
          where: { id: existingProc.id },
          data: {
            status: row.procStatus,
            assunto: row.procAssunto,
            updatedBy: input.actorUserId,
            fonteDadosId: existingProc.fonteDadosId ?? fonte.id,
            importacaoLoteId: existingProc.importacaoLoteId ?? lote.id,
            sourceRef: existingProc.sourceRef ?? `row:${rowNumber}`,
          },
        });
        await auditLog({
          entidade: "processos",
          entidadeId: updatedProc.id,
          acao: "UPDATE",
          actorUserId: input.actorUserId,
          antes: existingProc,
          depois: updatedProc,
          metadata: { source: "import", loteId: lote.id, rowNumber },
        });
      } else if (procResolved.outcome === "create") {
        procCreated++;
        const createdProc = await prisma.processo.create({
          data: {
            instituicaoId: instituicao.id,
            numero: row.procNumero,
            ano: row.procAno,
            status: row.procStatus,
            assunto: row.procAssunto,
            fonteDadosId: fonte.id,
            importacaoLoteId: lote.id,
            sourceRef: `row:${rowNumber}`,
            createdBy: input.actorUserId,
            updatedBy: input.actorUserId,
          },
        });
        await auditLog({
          entidade: "processos",
          entidadeId: createdProc.id,
          acao: "CREATE",
          actorUserId: input.actorUserId,
          depois: createdProc,
          metadata: { source: "import", loteId: lote.id, rowNumber },
        });
      }
    }

    const atoResolved = await resolveAto({
      instituicaoId: instituicao.id,
      row,
      policy: ATO_MATCH_POLICY_RUN,
      findExisting: (where) =>
        prisma.atoAutorizativo.findFirst({
          where,
          select: {
            id: true,
            tipo: true,
            numero: true,
            dataAto: true,
            ementa: true,
            descricao: true,
            fonteDadosId: true,
            importacaoLoteId: true,
            sourceRef: true,
            deletedAt: true,
          },
        }),
    });

    if (atoResolved.outcome === "update") {
      const existingAto = atoResolved.existing;
      atoUpdated++;
      const updatedAto = await prisma.atoAutorizativo.update({
        where: { id: existingAto.id },
        data: {
          ementa: row.atoEmenta,
          descricao: row.atoDescricao,
          updatedBy: input.actorUserId,
          fonteDadosId: existingAto.fonteDadosId ?? fonte.id,
          importacaoLoteId: existingAto.importacaoLoteId ?? lote.id,
          sourceRef: existingAto.sourceRef ?? `row:${rowNumber}`,
        },
      });
      await auditLog({
        entidade: "atos_autorizativos",
        entidadeId: updatedAto.id,
        acao: "UPDATE",
        actorUserId: input.actorUserId,
        antes: existingAto,
        depois: updatedAto,
        metadata: { source: "import", loteId: lote.id, rowNumber },
      });
    } else if (atoResolved.outcome === "create") {
      atoCreated++;
      const createdAto = await prisma.atoAutorizativo.create({
        data: {
          instituicaoId: instituicao.id,
          tipo: row.atoTipo!,
          numero: row.atoNumero,
          dataAto: row.atoData!,
          ementa: row.atoEmenta,
          descricao: row.atoDescricao,
          fonteDadosId: fonte.id,
          importacaoLoteId: lote.id,
          sourceRef: `row:${rowNumber}`,
          createdBy: input.actorUserId,
          updatedBy: input.actorUserId,
        },
      });
      await auditLog({
        entidade: "atos_autorizativos",
        entidadeId: createdAto.id,
        acao: "CREATE",
        actorUserId: input.actorUserId,
        depois: createdAto,
        metadata: { source: "import", loteId: lote.id, rowNumber },
      });
    }

    const eventoResolved = await resolveEvento({
      instituicaoId: instituicao.id,
      row,
      findExisting: (where) =>
        prisma.eventoRegulatorio.findFirst({
          where,
          select: {
            id: true,
            tipo: true,
            dataEvento: true,
            descricao: true,
            fonteDadosId: true,
            importacaoLoteId: true,
            sourceRef: true,
            deletedAt: true,
          },
        }),
    });

    if (eventoResolved.outcome === "update") {
      const existingEvento = eventoResolved.existing;
      eventoUpdated++;
      const updatedEvento = await prisma.eventoRegulatorio.update({
        where: { id: existingEvento.id },
        data: {
          updatedBy: input.actorUserId,
          fonteDadosId: existingEvento.fonteDadosId ?? fonte.id,
          importacaoLoteId: existingEvento.importacaoLoteId ?? lote.id,
          sourceRef: existingEvento.sourceRef ?? `row:${rowNumber}`,
        },
      });
      await auditLog({
        entidade: "eventos_regulatorios",
        entidadeId: updatedEvento.id,
        acao: "UPDATE",
        actorUserId: input.actorUserId,
        antes: existingEvento,
        depois: updatedEvento,
        metadata: { source: "import", loteId: lote.id, rowNumber },
      });
    } else if (eventoResolved.outcome === "create") {
      eventoCreated++;
      const createdEvento = await prisma.eventoRegulatorio.create({
        data: {
          instituicaoId: instituicao.id,
          tipo: row.eventoTipo!,
          dataEvento: row.eventoData!,
          descricao: row.eventoDescricao!,
          fonteDadosId: fonte.id,
          importacaoLoteId: lote.id,
          sourceRef: `row:${rowNumber}`,
          createdBy: input.actorUserId,
          updatedBy: input.actorUserId,
        },
      });
      await auditLog({
        entidade: "eventos_regulatorios",
        entidadeId: createdEvento.id,
        acao: "CREATE",
        actorUserId: input.actorUserId,
        depois: createdEvento,
        metadata: { source: "import", loteId: lote.id, rowNumber },
      });
    }

    if (row.hasDocumento) {
      const tipoDocumento = await prisma.tipoDocumento.findUnique({
        where: { codigo: row.docTipo! },
        select: { id: true },
      });

      const docResolved = await resolveDocumento({
        instituicaoId: instituicao.id,
        tipoDocumentoId: tipoDocumento?.id ?? null,
        row,
        findExisting: (where) =>
          prisma.documento.findFirst({
            where,
            select: {
              id: true,
              titulo: true,
              dataDocumento: true,
              tipoDocumentoId: true,
              fonteDadosId: true,
              importacaoLoteId: true,
              sourceRef: true,
              deletedAt: true,
            },
          }),
      });

      if (docResolved.outcome === "unknown_tipo") {
        rejected++;
        errors.push({ rowNumber, message: "documento_tipo não cadastrado no sistema" });
      } else if (docResolved.outcome === "update") {
        const existingDoc = docResolved.existing;
        docUpdated++;
        const updatedDoc = await prisma.documento.update({
          where: { id: existingDoc.id },
          data: {
            dataDocumento: row.docData,
            updatedBy: input.actorUserId,
            fonteDadosId: existingDoc.fonteDadosId ?? fonte.id,
            importacaoLoteId: existingDoc.importacaoLoteId ?? lote.id,
            sourceRef: existingDoc.sourceRef ?? `row:${rowNumber}`,
          },
        });
        await auditLog({
          entidade: "documentos",
          entidadeId: updatedDoc.id,
          acao: "UPDATE",
          actorUserId: input.actorUserId,
          antes: existingDoc,
          depois: updatedDoc,
          metadata: { source: "import", loteId: lote.id, rowNumber },
        });
      } else if (docResolved.outcome === "create") {
        docCreated++;
        const createdDoc = await prisma.documento.create({
          data: {
            instituicaoId: instituicao.id,
            tipoDocumentoId: tipoDocumento!.id,
            titulo: row.docTitulo!,
            dataDocumento: row.docData,
            fonteDadosId: fonte.id,
            importacaoLoteId: lote.id,
            sourceRef: `row:${rowNumber}`,
            createdBy: input.actorUserId,
            updatedBy: input.actorUserId,
          },
        });
        await auditLog({
          entidade: "documentos",
          entidadeId: createdDoc.id,
          acao: "CREATE",
          actorUserId: input.actorUserId,
          depois: createdDoc,
          metadata: { source: "import", loteId: lote.id, rowNumber },
        });
      }
    }

    imported++;
  }

  const status = errors.length > 0 ? "COM_PENDENCIAS" : "IMPORTADO";
  const loteFinal = await prisma.importacaoLote.update({
    where: { id: lote.id },
    data: {
      status,
      contagemImportadas: imported,
      contagemRejeitadas: rejected,
      relatorioErros: errors as never,
      relatorioImpacto: {
        instituicoes: { created: instCreated, updated: instUpdated },
        processos: { created: procCreated, updated: procUpdated },
        atos: { created: atoCreated, updated: atoUpdated },
        eventos: { created: eventoCreated, updated: eventoUpdated },
        documentos: { created: docCreated, updated: docUpdated },
      } as never,
    },
  });

  await auditLog({
    entidade: "importacoes",
    entidadeId: loteFinal.id,
    acao: "UPDATE",
    actorUserId: input.actorUserId,
    antes: lote,
    depois: loteFinal,
    metadata: {
      source: "import",
      result: {
        imported,
        rejected,
        errorsCount: errors.length,
        impacto: {
          instituicoes: { created: instCreated, updated: instUpdated },
          processos: { created: procCreated, updated: procUpdated },
          atos: { created: atoCreated, updated: atoUpdated },
          eventos: { created: eventoCreated, updated: eventoUpdated },
          documentos: { created: docCreated, updated: docUpdated },
        },
      },
    },
  });

  return { loteId: lote.id, imported, rejected, errorsCount: errors.length };
}

