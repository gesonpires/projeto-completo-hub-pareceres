import type { Prisma } from "@/generated/prisma/client";

export const INSTITUTION_DETAIL_TIMELINE_DISPLAY_LIMIT = 200;
export const INSTITUTION_DETAIL_DEFAULT_LIMIT = 200;
export const INSTITUTION_DETAIL_MIN_LIMIT = 50;
export const INSTITUTION_DETAIL_MAX_LIMIT = 500;
export const INSTITUTION_DETAIL_MANTENEDORA_OPTIONS_LIMIT = 200;

export const institutionDetailInclude = {
  mantenedora: true,
  processos: {
    include: { tramitacoes: true },
  },
  atos: true,
  eventos: true,
  documentos: {
    include: { tipoDocumento: true },
  },
} satisfies Prisma.InstituicaoInclude;

export type InstitutionDetailInstituicao = Prisma.InstituicaoGetPayload<{
  include: typeof institutionDetailInclude;
}>;

export type InstitutionDetailSearchParams = {
  showDeleted?: string;
  limit?: string;
  returnTo?: string;
};

export type ParsedInstitutionDetailQuery = {
  showDeleted: boolean;
  limit: number;
  returnToRaw: string;
  returnTo: string;
};

export type InstitutionDetailTimelineKind =
  | "processo"
  | "ato"
  | "evento"
  | "documento"
  | "tramitacao";

export type InstitutionDetailTimelineItem = {
  kind: InstitutionDetailTimelineKind;
  id: string;
  date: Date;
  title: string;
  subtitle?: string;
  href?: string;
  proveniencia?: string;
  importacaoLoteId?: string;
  deletedAt?: Date | null;
};

export type InstitutionDetailProvenance = {
  text: string;
  loteId: string | null;
};

export type InstitutionDetailLookupMaps = {
  processoById: Map<string, InstitutionDetailInstituicao["processos"][number]>;
  tramitacaoById: Map<
    string,
    InstitutionDetailInstituicao["processos"][number]["tramitacoes"][number]
  >;
  atoById: Map<string, InstitutionDetailInstituicao["atos"][number]>;
  eventoById: Map<string, InstitutionDetailInstituicao["eventos"][number]>;
  documentoById: Map<string, InstitutionDetailInstituicao["documentos"][number]>;
};

export type MantenedoraOption = {
  id: string;
  razaoSocial: string;
};

export type LoadInstitutionDetailResult =
  | {
      status: "ok";
      query: ParsedInstitutionDetailQuery;
      instituicao: InstitutionDetailInstituicao;
      timeline: InstitutionDetailTimelineItem[];
      lookups: InstitutionDetailLookupMaps;
      institutionProvenance: InstitutionDetailProvenance;
      mantenedoraOptions: MantenedoraOption[];
    }
  | { status: "not_found" }
  | { status: "db_error" };
