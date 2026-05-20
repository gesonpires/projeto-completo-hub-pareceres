import { prisma } from "@/server/db";
import { withPrismaRetry } from "@/server/dbRetry";
import { parseInstitutionDetailQuery } from "./institutionDetailQuery";
import {
  collectProvenanceIds,
  createProvenanceFormatter,
  formatInstitutionProvenance,
  type ProvenanceIndex,
} from "./institutionDetailProvenance";
import {
  buildInstitutionDetailLookupMaps,
  buildInstitutionDetailTimeline,
} from "./institutionDetailTimeline";
import {
  institutionDetailInclude,
  INSTITUTION_DETAIL_MANTENEDORA_OPTIONS_LIMIT,
  type InstitutionDetailInstituicao,
  type InstitutionDetailSearchParams,
  type LoadInstitutionDetailResult,
  type MantenedoraOption,
} from "./institutionDetailTypes";

export type {
  InstitutionDetailInstituicao,
  InstitutionDetailLookupMaps,
  InstitutionDetailProvenance,
  InstitutionDetailSearchParams,
  InstitutionDetailTimelineItem,
  InstitutionDetailTimelineKind,
  LoadInstitutionDetailResult,
  MantenedoraOption,
  ParsedInstitutionDetailQuery,
} from "./institutionDetailTypes";

export {
  INSTITUTION_DETAIL_DEFAULT_LIMIT,
  INSTITUTION_DETAIL_MAX_LIMIT,
  INSTITUTION_DETAIL_MIN_LIMIT,
  INSTITUTION_DETAIL_TIMELINE_DISPLAY_LIMIT,
} from "./institutionDetailTypes";

export {
  buildInstitutionDetailDismissHref,
  buildInstitutionDetailReturnTo,
  parseInstitutionDetailQuery,
} from "./institutionDetailQuery";

export {
  buildInstitutionDetailLookupMaps,
  buildInstitutionDetailTimeline,
} from "./institutionDetailTimeline";

async function loadProvenanceIndex(
  instituicao: InstitutionDetailInstituicao,
): Promise<ProvenanceIndex> {
  const { fonteIds, loteIds } = collectProvenanceIds(instituicao);

  try {
    const [fontes, lotes] = await withPrismaRetry(() =>
      Promise.all([
        fonteIds.size
          ? prisma.fonteDados.findMany({
              where: { id: { in: Array.from(fonteIds) } },
              select: { id: true, nome: true },
            })
          : Promise.resolve([]),
        loteIds.size
          ? prisma.importacaoLote.findMany({
              where: { id: { in: Array.from(loteIds) } },
              select: { id: true, arquivoNome: true, createdAt: true },
            })
          : Promise.resolve([]),
      ]),
    );

    return {
      fonteById: new Map(fontes.map((f) => [f.id, { nome: f.nome }])),
      loteById: new Map(
        lotes.map((l) => [l.id, { arquivoNome: l.arquivoNome, createdAt: l.createdAt }]),
      ),
    };
  } catch {
    return { fonteById: new Map(), loteById: new Map() };
  }
}

async function loadMantenedoraOptions(
  includeOptions: boolean,
): Promise<MantenedoraOption[]> {
  if (!includeOptions) return [];

  return withPrismaRetry(() =>
    prisma.mantenedora.findMany({
      where: { deletedAt: null },
      orderBy: [{ nomeNormalizado: "asc" }],
      take: INSTITUTION_DETAIL_MANTENEDORA_OPTIONS_LIMIT,
      select: { id: true, razaoSocial: true },
    }),
  );
}

/**
 * Read model P4 — detalhe institucional (ficha, timeline, tramitações, proveniência por item).
 */
export async function loadInstitutionDetail(
  instituicaoId: string,
  searchParams: InstitutionDetailSearchParams = {},
  options: { includeMantenedoraOptions?: boolean } = {},
): Promise<LoadInstitutionDetailResult> {
  const query = parseInstitutionDetailQuery(searchParams, instituicaoId);
  const processTake = Math.min(200, query.limit);
  const tramTake = Math.min(200, query.limit);

  let instituicao: InstitutionDetailInstituicao | null = null;

  try {
    instituicao = await withPrismaRetry(() =>
      prisma.instituicao.findFirst({
        where: { id: instituicaoId, deletedAt: null },
        include: {
          mantenedora: institutionDetailInclude.mantenedora,
          processos: {
            where: query.showDeleted ? {} : { deletedAt: null },
            orderBy: [{ dataAbertura: "desc" }, { createdAt: "desc" }],
            take: processTake,
            include: {
              tramitacoes: {
                where: query.showDeleted ? {} : { deletedAt: null },
                orderBy: [{ dataMovimento: "desc" }],
                take: tramTake,
              },
            },
          },
          atos: {
            where: query.showDeleted ? {} : { deletedAt: null },
            orderBy: [{ dataAto: "desc" }],
            take: query.limit,
          },
          eventos: {
            where: query.showDeleted ? {} : { deletedAt: null },
            orderBy: [{ dataEvento: "desc" }],
            take: query.limit,
          },
          documentos: {
            where: query.showDeleted ? {} : { deletedAt: null },
            include: { tipoDocumento: institutionDetailInclude.documentos.include.tipoDocumento },
            orderBy: [{ dataDocumento: "desc" }],
            take: query.limit,
          },
        },
      }),
    );
  } catch {
    return { status: "db_error" };
  }

  if (!instituicao) {
    return { status: "not_found" };
  }

  try {
    const [provenanceIndex, mantenedoraOptions] = await Promise.all([
      loadProvenanceIndex(instituicao),
      loadMantenedoraOptions(options.includeMantenedoraOptions ?? false),
    ]);

    const formatProveniencia = createProvenanceFormatter(provenanceIndex);
    const timeline = buildInstitutionDetailTimeline(instituicao, formatProveniencia);
    const lookups = buildInstitutionDetailLookupMaps(instituicao);
    const institutionProvenance = formatInstitutionProvenance(
      instituicao,
      formatProveniencia,
    );

    return {
      status: "ok",
      query,
      instituicao,
      timeline,
      lookups,
      institutionProvenance,
      mantenedoraOptions,
    };
  } catch {
    return { status: "db_error" };
  }
}
