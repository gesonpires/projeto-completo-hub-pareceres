import { prisma } from "@/server/db";
import { withPrismaRetry } from "@/server/dbRetry";
import type { ImportPreview } from "@/server/imports/csvMvpCore";
import { normalizeImportRow } from "./importacaoCsvMatching/importRowNormalize";

export {
  planDryRunInstituicaoBranch,
  type DryRunInstituicaoBranch,
} from "./importacaoCsvMatching/dryRunInstituicao";
import {
  INSTITUICAO_MATCH_POLICY_PREVIEW,
  resolveInstituicao,
} from "./importacaoCsvMatching/resolveInstituicao";
import {
  ATO_MATCH_POLICY_PREVIEW,
  resolveAto,
} from "./importacaoCsvMatching/resolveAto";
import { resolveDocumento } from "./importacaoCsvMatching/resolveDocumento";
import { resolveEvento } from "./importacaoCsvMatching/resolveEvento";
import { resolveProcesso } from "./importacaoCsvMatching/resolveProcesso";
import type { ImportacaoCsvDryRunImpact } from "./importacaoCsvPreviewTypes";

const DRY_RUN_ROW_LIMIT = 200;

/**
 * Estimativa determinística (não grava): analisa amostra do preview contra o banco.
 * Match keys compartilhados com o run ({@link importMatchWhere}).
 */
export async function buildImportacaoCsvDryRunImpact(
  preview: ImportPreview,
): Promise<ImportacaoCsvDryRunImpact> {
  const rows = preview.sample.slice(0, DRY_RUN_ROW_LIMIT);

  let instCreate = 0;
  let instUpdate = 0;
  let procCreate = 0;
  let procUpdate = 0;
  let atoCreate = 0;
  let atoUpdate = 0;
  let eventoCreate = 0;
  let eventoUpdate = 0;
  let docCreate = 0;
  let docUpdate = 0;

  const tipoDocCache = new Map<string, string>();

  for (const s of rows) {
    const row = normalizeImportRow(s.data);
    const instResolved = await withPrismaRetry(() =>
      resolveInstituicao({
        row,
        policy: INSTITUICAO_MATCH_POLICY_PREVIEW,
        findByCnpj: (cnpj) =>
          prisma.instituicao.findUnique({
            where: { cnpj },
            select: { id: true },
          }),
        findFirstSemCnpj: (where) =>
          prisma.instituicao.findFirst({
            where,
            select: { id: true },
          }),
      }),
    );

    if (
      instResolved.outcome === "skip" ||
      instResolved.outcome === "reject"
    ) {
      continue;
    }

    let instId: string | null = null;
    if (instResolved.outcome === "update") {
      instUpdate++;
      instId = instResolved.instituicaoId;
    } else if (instResolved.outcome === "create") {
      instCreate++;
    }

    if (row.hasProcesso) {
      const procResolved = await resolveProcesso({
        instituicaoId: instId,
        row,
        findExisting: instId
          ? (where) =>
              withPrismaRetry(() =>
                prisma.processo.findFirst({
                  where,
                  select: { id: true },
                }),
              )
          : undefined,
      });
      if (procResolved.outcome === "update") procUpdate++;
      else if (procResolved.outcome === "create") procCreate++;
    }

    const atoResolved = await resolveAto({
      instituicaoId: instId,
      row,
      policy: ATO_MATCH_POLICY_PREVIEW,
      findExisting: instId
        ? (where) =>
            withPrismaRetry(() =>
              prisma.atoAutorizativo.findFirst({
                where,
                select: { id: true },
              }),
            )
        : undefined,
    });
    if (atoResolved.outcome === "update") atoUpdate++;
    else if (atoResolved.outcome === "create") atoCreate++;

    const eventoResolved = await resolveEvento({
      instituicaoId: instId,
      row,
      findExisting: instId
        ? (where) =>
            withPrismaRetry(() =>
              prisma.eventoRegulatorio.findFirst({
                where,
                select: { id: true },
              }),
            )
        : undefined,
    });
    if (eventoResolved.outcome === "update") eventoUpdate++;
    else if (eventoResolved.outcome === "create") eventoCreate++;

    if (row.hasDocumento) {
      const docTipo = row.docTipo!;
      const tipoId =
        tipoDocCache.get(docTipo) ??
        (await withPrismaRetry(async () => {
          const t = await prisma.tipoDocumento.findUnique({
            where: { codigo: docTipo },
            select: { id: true },
          });
          if (t?.id) tipoDocCache.set(docTipo, t.id);
          return t?.id ?? null;
        }));

      const docResolved = await resolveDocumento({
        instituicaoId: instId,
        tipoDocumentoId: tipoId,
        row,
        findExisting: instId && tipoId
          ? (where) =>
              withPrismaRetry(() =>
                prisma.documento.findFirst({
                  where,
                  select: { id: true },
                }),
              )
          : undefined,
      });

      if (docResolved.outcome === "update") docUpdate++;
      else if (docResolved.outcome === "create") docCreate++;
    }
  }

  return {
    analyzedRows: rows.length,
    instituicoes: { created: instCreate, updated: instUpdate },
    processos: { created: procCreate, updated: procUpdate },
    atos: { created: atoCreate, updated: atoUpdate },
    eventos: { created: eventoCreate, updated: eventoUpdate },
    documentos: { created: docCreate, updated: docUpdate },
  };
}
