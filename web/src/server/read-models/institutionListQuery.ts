import { digitsOnly, normalizeName } from "../normalize";
import type {
  InstitutionListSearchParams,
  InstitutionListWhere,
  ParsedInstitutionListQuery,
} from "./institutionListTypes";
import { INSTITUTION_LIST_PAGE_SIZE } from "./institutionListTypes";

export function parseDateOnly(raw: string): Date | null {
  const v = raw.trim();
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Normaliza query string da listagem de instituições. */
export function parseInstitutionListQuery(
  sp: InstitutionListSearchParams = {},
): ParsedInstitutionListQuery {
  const qRaw = (sp.q ?? "").trim();
  const cnpjRaw = (sp.cnpj ?? "").trim();
  const municipio = (sp.municipio ?? "").trim();
  const ufRaw = (sp.uf ?? "").trim();
  const situacao = (sp.situacao ?? "").trim();
  const temProcessosRaw = (sp.tem_processos ?? "").trim();
  const eventosDeRaw = (sp.eventos_de ?? "").trim();
  const eventosAteRaw = (sp.eventos_ate ?? "").trim();
  const sort = (sp.sort ?? "").trim();
  const dirRaw = (sp.dir ?? "").trim();

  const qDigits = qRaw ? digitsOnly(qRaw) : "";
  const cnpjDigits = cnpjRaw ? digitsOnly(cnpjRaw) : "";
  const cnpj = cnpjDigits || (qDigits.length === 14 ? qDigits : "");
  const q = cnpj ? "" : qRaw;
  const qNorm = q ? normalizeName(q) : "";
  const qTerms = qNorm ? qNorm.split(" ").filter(Boolean).slice(0, 8) : [];
  const uf = ufRaw ? ufRaw.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2) : "";

  const eventosDe = parseDateOnly(eventosDeRaw);
  const eventosAte = parseDateOnly(eventosAteRaw);
  const dir: "asc" | "desc" = dirRaw === "desc" ? "desc" : "asc";
  const temProcessos =
    temProcessosRaw === "1" ? true : temProcessosRaw === "0" ? false : null;

  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const pageSize = INSTITUTION_LIST_PAGE_SIZE;
  const skip = (page - 1) * pageSize;

  return {
    qRaw,
    cnpjRaw,
    municipio,
    ufRaw,
    situacao,
    temProcessosRaw,
    eventosDeRaw,
    eventosAteRaw,
    sort,
    dirRaw,
    cnpj,
    q,
    qTerms,
    uf,
    eventosDe,
    eventosAte,
    dir,
    temProcessos,
    page,
    pageSize,
    skip,
  };
}

/** Monta o `where` Prisma da listagem (filtros compartilhados). */
export function buildInstitutionListWhere(query: ParsedInstitutionListQuery): InstitutionListWhere {
  const {
    cnpj,
    qTerms,
    municipio,
    uf,
    situacao,
    temProcessos,
    eventosDe,
    eventosAte,
  } = query;

  return {
    deletedAt: null,
    ...(cnpj
      ? { cnpj }
      : qTerms.length
        ? {
            AND: qTerms.map((t) => ({ nomeNormalizado: { contains: t } })),
          }
        : {}),
    ...(municipio
      ? { municipio: { contains: municipio, mode: "insensitive" as const } }
      : {}),
    ...(uf ? { uf } : {}),
    ...(situacao ? { situacao: situacao as never } : {}),
    ...(temProcessos === true
      ? { processos: { some: { deletedAt: null } } }
      : temProcessos === false
        ? { processos: { none: { deletedAt: null } } }
        : {}),
    ...(eventosDe || eventosAte
      ? {
          OR: [
            {
              atos: {
                some: {
                  deletedAt: null,
                  ...(eventosDe ? { dataAto: { gte: eventosDe } } : {}),
                  ...(eventosAte ? { dataAto: { lte: eventosAte } } : {}),
                },
              },
            },
            {
              eventos: {
                some: {
                  deletedAt: null,
                  ...(eventosDe ? { dataEvento: { gte: eventosDe } } : {}),
                  ...(eventosAte ? { dataEvento: { lte: eventosAte } } : {}),
                },
              },
            },
          ],
        }
      : {}),
  };
}

export const institutionListSummarySelect = {
  id: true,
  nome: true,
  cnpj: true,
  municipio: true,
  uf: true,
  _count: { select: { processos: { where: { deletedAt: null } } } },
} as const;

export function buildInstitutionListOrderBy(query: ParsedInstitutionListQuery) {
  const { sort, dir } = query;
  switch (sort) {
    case "mais_processos":
      return [
        { processos: { _count: dir } },
        { nomeNormalizado: "asc" as const },
        { id: "asc" as const },
      ];
    case "nome":
      return [{ nomeNormalizado: dir }, { id: "asc" as const }];
    default:
      return [{ nomeNormalizado: "asc" as const }, { id: "asc" as const }];
  }
}

/** Preserva filtros/ordenação na URL (paginação e links de retorno). */
export function buildInstitutionListSearchParams(
  query: ParsedInstitutionListQuery,
  overrides: { page?: number } = {},
): URLSearchParams {
  const p = new URLSearchParams();
  if (query.qRaw) p.set("q", query.qRaw);
  if (query.cnpjRaw) p.set("cnpj", query.cnpjRaw);
  if (query.municipio) p.set("municipio", query.municipio);
  if (query.ufRaw) p.set("uf", query.ufRaw);
  if (query.situacao) p.set("situacao", query.situacao);
  if (query.temProcessosRaw) p.set("tem_processos", query.temProcessosRaw);
  if (query.eventosDeRaw) p.set("eventos_de", query.eventosDeRaw);
  if (query.eventosAteRaw) p.set("eventos_ate", query.eventosAteRaw);
  if (query.sort) p.set("sort", query.sort);
  if (query.dirRaw) p.set("dir", query.dirRaw);
  if (overrides.page !== undefined) p.set("page", String(overrides.page));
  else if (query.page > 1) p.set("page", String(query.page));
  return p;
}
