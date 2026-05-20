import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db";
import { withPrismaRetry } from "@/server/dbRetry";
import {
  buildInstitutionListOrderBy,
  buildInstitutionListWhere,
  institutionListSummarySelect,
  parseInstitutionListQuery,
} from "./institutionListQuery";
import type { ParsedInstitutionListQuery } from "./institutionListTypes";
import type {
  InstitutionListItem,
  InstitutionListSearchParams,
  LoadInstitutionListResult,
} from "./institutionListTypes";

export type {
  InstitutionListItem,
  InstitutionListSearchParams,
  InstitutionListWhere,
  LoadInstitutionListResult,
  ParsedInstitutionListQuery,
} from "./institutionListTypes";

export {
  INSTITUTION_LIST_PAGE_SIZE,
} from "./institutionListTypes";

export {
  buildInstitutionListOrderBy,
  buildInstitutionListSearchParams,
  buildInstitutionListWhere,
  parseDateOnly,
  parseInstitutionListQuery,
} from "./institutionListQuery";

/** Condições SQL para ordenação por atividade recente (`sort=mais_recentes`). */
function buildInstitutionListRecentSortConditions(
  query: ParsedInstitutionListQuery,
): Prisma.Sql[] {
  const { cnpj, qTerms, municipio, uf, situacao, temProcessos, eventosDe, eventosAte } =
    query;

  const conditions: Prisma.Sql[] = [Prisma.sql`i."deletedAt" IS NULL`];

  if (cnpj) conditions.push(Prisma.sql`i.cnpj = ${cnpj}`);
  if (!cnpj && qTerms.length) {
    for (const t of qTerms) {
      conditions.push(Prisma.sql`i."nomeNormalizado" LIKE ${"%" + t + "%"}`);
    }
  }
  if (municipio) conditions.push(Prisma.sql`i.municipio ILIKE ${"%" + municipio + "%"}`);
  if (uf) conditions.push(Prisma.sql`i.uf = ${uf}`);
  if (situacao) conditions.push(Prisma.sql`i.situacao = ${situacao}::"InstituicaoSituacao"`);
  if (temProcessos === true) {
    conditions.push(
      Prisma.sql`EXISTS (SELECT 1 FROM "Processo" p WHERE p."instituicaoId" = i.id AND p."deletedAt" IS NULL)`,
    );
  } else if (temProcessos === false) {
    conditions.push(
      Prisma.sql`NOT EXISTS (SELECT 1 FROM "Processo" p WHERE p."instituicaoId" = i.id AND p."deletedAt" IS NULL)`,
    );
  }

  if (eventosDe || eventosAte) {
    const atosDate = [
      Prisma.sql`a."deletedAt" IS NULL`,
      eventosDe ? Prisma.sql`a."dataAto" >= ${eventosDe}` : null,
      eventosAte ? Prisma.sql`a."dataAto" <= ${eventosAte}` : null,
    ].filter(Boolean) as Prisma.Sql[];

    const eventosDate = [
      Prisma.sql`e."deletedAt" IS NULL`,
      eventosDe ? Prisma.sql`e."dataEvento" >= ${eventosDe}` : null,
      eventosAte ? Prisma.sql`e."dataEvento" <= ${eventosAte}` : null,
    ].filter(Boolean) as Prisma.Sql[];

    conditions.push(
      Prisma.sql`(
        EXISTS (SELECT 1 FROM "AtoAutorizativo" a WHERE a."instituicaoId" = i.id AND ${Prisma.join(atosDate, " AND ")})
        OR
        EXISTS (SELECT 1 FROM "EventoRegulatorio" e WHERE e."instituicaoId" = i.id AND ${Prisma.join(eventosDate, " AND ")})
      )`,
    );
  }

  return conditions;
}

/**
 * Read model P2 — lista paginada de instituições com filtros, ordenação e projeção resumida.
 */
export async function loadInstitutionList(
  searchParams: InstitutionListSearchParams = {},
): Promise<LoadInstitutionListResult> {
  const query = parseInstitutionListQuery(searchParams);
  const where = buildInstitutionListWhere(query);

  try {
    const total = await withPrismaRetry(() => prisma.instituicao.count({ where }));

    let items: InstitutionListItem[];

    if (query.sort === "mais_recentes") {
      const conditions = buildInstitutionListRecentSortConditions(query);
      const ids = await withPrismaRetry(() =>
        prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT i.id
          FROM "Instituicao" i
          WHERE ${Prisma.join(conditions, " AND ")}
          ORDER BY
            GREATEST(
              COALESCE((SELECT MAX(a."dataAto") FROM "AtoAutorizativo" a WHERE a."instituicaoId" = i.id AND a."deletedAt" IS NULL), DATE '0001-01-01'),
              COALESCE((SELECT MAX(e."dataEvento") FROM "EventoRegulatorio" e WHERE e."instituicaoId" = i.id AND e."deletedAt" IS NULL), DATE '0001-01-01')
            ) ${query.dir === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`},
            i."nomeNormalizado" ASC,
            i.id ASC
          LIMIT ${query.pageSize}
          OFFSET ${query.skip}
        `),
      );

      const idList = ids.map((r) => r.id);
      if (idList.length === 0) {
        items = [];
      } else {
        const rows = await withPrismaRetry(() =>
          prisma.instituicao.findMany({
            where: { id: { in: idList } },
            select: institutionListSummarySelect,
          }),
        );
        const byId = new Map(rows.map((r) => [r.id, r]));
        items = idList
          .map((id) => byId.get(id))
          .filter(Boolean) as InstitutionListItem[];
      }
    } else {
      items = await withPrismaRetry(() =>
        prisma.instituicao.findMany({
          where,
          orderBy: buildInstitutionListOrderBy(query),
          take: query.pageSize,
          skip: query.skip,
          select: institutionListSummarySelect,
        }),
      );
    }

    const totalPages = Math.max(1, Math.ceil(total / query.pageSize));

    return {
      status: "ok",
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages,
      query,
    };
  } catch {
    return { status: "db_error" };
  }
}
