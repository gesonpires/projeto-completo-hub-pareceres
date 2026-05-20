import { prisma } from "@/server/db";
import { withPrismaRetry } from "@/server/dbRetry";
import { buildInstitutionalReportTimeline } from "./institutionalReportTimeline";
import {
  institutionalReportInclude,
  type InstitutionalReportCounts,
  type InstitutionalReportInstituicao,
  type InstitutionalReportProvenance,
  type LoadInstitutionalReportResult,
} from "./institutionalReportTypes";

export type {
  InstitutionalReport,
  InstitutionalReportCounts,
  InstitutionalReportInstituicao,
  InstitutionalReportProvenance,
  LoadInstitutionalReportResult,
} from "./institutionalReportTypes";

export type {
  InstitutionalReportTimelineItem,
  InstitutionalReportTimelineKind,
} from "./institutionalReportTimeline";

export { buildInstitutionalReportTimeline } from "./institutionalReportTimeline";

export function institutionalReportCounts(
  instituicao: InstitutionalReportInstituicao,
): InstitutionalReportCounts {
  return {
    processos: instituicao.processos.length,
    atos: instituicao.atos.length,
    eventos: instituicao.eventos.length,
    documentos: instituicao.documentos.length,
  };
}

async function loadInstitutionalReportProvenance(
  instituicao: Pick<
    InstitutionalReportInstituicao,
    "fonteDadosId" | "importacaoLoteId" | "sourceRef"
  >,
): Promise<InstitutionalReportProvenance> {
  try {
    const [fonte, lote] = await withPrismaRetry(() =>
      Promise.all([
        instituicao.fonteDadosId
          ? prisma.fonteDados.findUnique({
              where: { id: instituicao.fonteDadosId },
              select: { nome: true },
            })
          : Promise.resolve(null),
        instituicao.importacaoLoteId
          ? prisma.importacaoLote.findUnique({
              where: { id: instituicao.importacaoLoteId },
              select: { id: true, arquivoNome: true },
            })
          : Promise.resolve(null),
      ]),
    );

    const parts: string[] = [];
    if (fonte?.nome) parts.push(`Fonte: ${fonte.nome}`);
    if (lote?.arquivoNome) parts.push(`Lote: ${lote.arquivoNome}`);
    if (instituicao.sourceRef) parts.push(`Ref: ${instituicao.sourceRef}`);

    return {
      text: parts.join(" • "),
      loteId: lote?.id ?? null,
    };
  } catch {
    return { text: "", loteId: null };
  }
}

/**
 * Read model P1 — relatório institucional consolidado (instituição + histórico + proveniência).
 */
export async function loadInstitutionalReport(
  instituicaoId: string,
): Promise<LoadInstitutionalReportResult> {
  let instituicao: InstitutionalReportInstituicao | null = null;

  try {
    instituicao = await withPrismaRetry(() =>
      prisma.instituicao.findFirst({
        where: { id: instituicaoId, deletedAt: null },
        include: institutionalReportInclude,
      }),
    );
  } catch {
    return { status: "db_error" };
  }

  if (!instituicao) {
    return { status: "not_found" };
  }

  const provenance = await loadInstitutionalReportProvenance(instituicao);
  const timeline = buildInstitutionalReportTimeline(instituicao);
  const counts = institutionalReportCounts(instituicao);

  return {
    status: "ok",
    report: {
      instituicao,
      timeline,
      provenance,
      counts,
    },
  };
}
