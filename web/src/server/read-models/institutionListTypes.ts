import type { Prisma } from "@/generated/prisma/client";

export const INSTITUTION_LIST_PAGE_SIZE = 25;

export type InstitutionListSearchParams = {
  q?: string;
  cnpj?: string;
  municipio?: string;
  uf?: string;
  situacao?: string;
  tem_processos?: string;
  eventos_de?: string;
  eventos_ate?: string;
  sort?: string;
  dir?: string;
  page?: string;
};

export type ParsedInstitutionListQuery = {
  qRaw: string;
  cnpjRaw: string;
  municipio: string;
  ufRaw: string;
  situacao: string;
  temProcessosRaw: string;
  eventosDeRaw: string;
  eventosAteRaw: string;
  sort: string;
  dirRaw: string;
  cnpj: string;
  q: string;
  qTerms: string[];
  uf: string;
  eventosDe: Date | null;
  eventosAte: Date | null;
  dir: "asc" | "desc";
  temProcessos: boolean | null;
  page: number;
  pageSize: number;
  skip: number;
};

/** Projeção resumida usada na listagem de instituições. */
export type InstitutionListItem = {
  id: string;
  nome: string;
  cnpj: string | null;
  municipio: string | null;
  uf: string | null;
  _count?: { processos: number };
};

export type InstitutionListWhere = Prisma.InstituicaoWhereInput;

export type LoadInstitutionListResult =
  | {
      status: "ok";
      items: InstitutionListItem[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
      query: ParsedInstitutionListQuery;
    }
  | { status: "db_error" };
