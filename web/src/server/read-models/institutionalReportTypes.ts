import type { Prisma } from "@/generated/prisma/client";
import type { InstitutionalReportTimelineItem } from "./institutionalReportTimeline";

export const institutionalReportInclude = {
  processos: {
    where: { deletedAt: null },
    orderBy: [{ dataAbertura: "desc" as const }, { createdAt: "desc" as const }],
  },
  atos: { where: { deletedAt: null }, orderBy: [{ dataAto: "desc" as const }] },
  eventos: { where: { deletedAt: null }, orderBy: [{ dataEvento: "desc" as const }] },
  documentos: {
    where: { deletedAt: null },
    include: { tipoDocumento: true },
    orderBy: [{ dataDocumento: "desc" as const }],
  },
} satisfies Prisma.InstituicaoInclude;

export type InstitutionalReportInstituicao = Prisma.InstituicaoGetPayload<{
  include: typeof institutionalReportInclude;
}>;

export type InstitutionalReportCounts = {
  processos: number;
  atos: number;
  eventos: number;
  documentos: number;
};

export type InstitutionalReportProvenance = {
  text: string;
  loteId: string | null;
};

export type InstitutionalReport = {
  instituicao: InstitutionalReportInstituicao;
  timeline: InstitutionalReportTimelineItem[];
  provenance: InstitutionalReportProvenance;
  counts: InstitutionalReportCounts;
};

export type LoadInstitutionalReportResult =
  | { status: "ok"; report: InstitutionalReport }
  | { status: "not_found" }
  | { status: "db_error" };
