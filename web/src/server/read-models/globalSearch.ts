import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db";
import { withPrismaRetry } from "@/server/dbRetry";
import {
  buildGlobalSearchWhereClauses,
  parseGlobalSearchQuery,
  resolveGlobalSearchEffectiveTab,
} from "./globalSearchQuery";
import {
  GLOBAL_SEARCH_RESULT_LIMIT,
  type GlobalSearchCounts,
  type GlobalSearchPermissions,
  type GlobalSearchResults,
  type GlobalSearchSearchParams,
  type GlobalSearchTabKey,
  type LoadGlobalSearchResult,
} from "./globalSearchTypes";

export type {
  GlobalSearchAtoRow,
  GlobalSearchCounts,
  GlobalSearchDocumentoRow,
  GlobalSearchEventoRow,
  GlobalSearchInstituicaoRef,
  GlobalSearchInstituicaoSummary,
  GlobalSearchPermissions,
  GlobalSearchProcessoRow,
  GlobalSearchResults,
  GlobalSearchSearchParams,
  GlobalSearchTabKey,
  LoadGlobalSearchResult,
} from "./globalSearchTypes";

export type { ParsedGlobalSearchQuery } from "./globalSearchTypes";

export {
  GLOBAL_SEARCH_RESULT_LIMIT,
} from "./globalSearchTypes";

export {
  buildGlobalSearchQueryString,
  buildGlobalSearchReturnTo,
  buildGlobalSearchTabHref,
  buildGlobalSearchWhereClauses,
  isTabAllowedForPermissions,
  parseGlobalSearchQuery,
  pickGlobalSearchTab,
  resolveGlobalSearchEffectiveTab,
} from "./globalSearchQuery";

const instituicaoRefSelect = {
  id: true,
  nome: true,
  cnpj: true,
  uf: true,
  municipio: true,
} as const;

/**
 * Read model P3 — busca global com abas, contagens e resultados da aba ativa.
 */
export async function loadGlobalSearch(
  searchParams: GlobalSearchSearchParams,
  permissions: GlobalSearchPermissions,
): Promise<LoadGlobalSearchResult> {
  const query = parseGlobalSearchQuery(searchParams);
  const effectiveTab = resolveGlobalSearchEffectiveTab(query, permissions);
  const { instWhere, procWhere, atoWhere, eventoWhere, docWhere } =
    buildGlobalSearchWhereClauses(query);

  const { canInst, canProc, canReg, canDocs } = permissions;
  const { hasQuery } = query;

  const emptyResults: GlobalSearchResults = {
    instituicoes: [],
    processos: [],
    atos: [],
    eventos: [],
    documentos: [],
  };

  try {
    const counts: GlobalSearchCounts = {};

    const countPairs = await withPrismaRetry(() =>
      Promise.all([
        canInst && hasQuery
          ? prisma.instituicao.count({ where: instWhere as Prisma.InstituicaoWhereInput })
          : Promise.resolve(undefined),
        canProc && hasQuery
          ? prisma.processo.count({ where: procWhere as Prisma.ProcessoWhereInput })
          : Promise.resolve(undefined),
        canReg && hasQuery
          ? prisma.atoAutorizativo.count({
              where: atoWhere as Prisma.AtoAutorizativoWhereInput,
            })
          : Promise.resolve(undefined),
        canReg && hasQuery
          ? prisma.eventoRegulatorio.count({
              where: eventoWhere as Prisma.EventoRegulatorioWhereInput,
            })
          : Promise.resolve(undefined),
        canDocs && hasQuery
          ? prisma.documento.count({ where: docWhere as Prisma.DocumentoWhereInput })
          : Promise.resolve(undefined),
      ]),
    );

    Object.assign(counts, {
      instituicoes: countPairs[0] ?? 0,
      processos: countPairs[1] ?? 0,
      atos: countPairs[2] ?? 0,
      eventos: countPairs[3] ?? 0,
      documentos: countPairs[4] ?? 0,
    });

    const results: GlobalSearchResults = { ...emptyResults };

    if (hasQuery) {
      switch (effectiveTab) {
        case "instituicoes":
          if (canInst) {
            results.instituicoes = await withPrismaRetry(() =>
              prisma.instituicao.findMany({
                where: instWhere as Prisma.InstituicaoWhereInput,
                orderBy: [{ nomeNormalizado: "asc" }],
                take: GLOBAL_SEARCH_RESULT_LIMIT,
                select: {
                  id: true,
                  nome: true,
                  cnpj: true,
                  municipio: true,
                  uf: true,
                },
              }),
            );
          }
          break;
        case "processos":
          if (canProc) {
            results.processos = await withPrismaRetry(() =>
              prisma.processo.findMany({
                where: procWhere as Prisma.ProcessoWhereInput,
                orderBy: [{ updatedAt: "desc" }],
                take: GLOBAL_SEARCH_RESULT_LIMIT,
                select: {
                  id: true,
                  numero: true,
                  ano: true,
                  status: true,
                  tipo: true,
                  instituicao: { select: instituicaoRefSelect },
                },
              }),
            );
          }
          break;
        case "atos":
          if (canReg) {
            results.atos = await withPrismaRetry(() =>
              prisma.atoAutorizativo.findMany({
                where: atoWhere as Prisma.AtoAutorizativoWhereInput,
                orderBy: [{ dataAto: "desc" }],
                take: GLOBAL_SEARCH_RESULT_LIMIT,
                select: {
                  id: true,
                  tipo: true,
                  numero: true,
                  dataAto: true,
                  instituicao: { select: instituicaoRefSelect },
                },
              }),
            );
          }
          break;
        case "eventos":
          if (canReg) {
            results.eventos = await withPrismaRetry(() =>
              prisma.eventoRegulatorio.findMany({
                where: eventoWhere as Prisma.EventoRegulatorioWhereInput,
                orderBy: [{ dataEvento: "desc" }],
                take: GLOBAL_SEARCH_RESULT_LIMIT,
                select: {
                  id: true,
                  tipo: true,
                  dataEvento: true,
                  descricao: true,
                  instituicao: { select: instituicaoRefSelect },
                },
              }),
            );
          }
          break;
        case "documentos":
          if (canDocs) {
            results.documentos = await withPrismaRetry(() =>
              prisma.documento.findMany({
                where: docWhere as Prisma.DocumentoWhereInput,
                orderBy: [{ updatedAt: "desc" }],
                take: GLOBAL_SEARCH_RESULT_LIMIT,
                select: {
                  id: true,
                  titulo: true,
                  dataDocumento: true,
                  storagePath: true,
                  tipoDocumento: { select: { codigo: true } },
                  instituicao: { select: instituicaoRefSelect },
                },
              }),
            );
          }
          break;
      }
    }

    return {
      status: "ok",
      query,
      effectiveTab,
      counts,
      results,
    };
  } catch {
    return { status: "db_error" };
  }
}
