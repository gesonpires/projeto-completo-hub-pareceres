import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { prisma } from "@/server/db";
import { withPrismaRetry } from "@/server/dbRetry";
import { getSessionFromCookies } from "@/server/auth";
import { canGenerateReports } from "@/server/permissions";
import { digitsOnly, formatCnpj, normalizeName } from "@/server/normalize";
import { buildReportHistoryWhere } from "@/server/reports/historyWhere";

type SearchParams = { page?: string; q?: string; from?: string; tipo?: string };

export default async function RelatoriosHistoricoPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!canGenerateReports(session.perfil)) redirect("/");

  const sp = (await searchParams) ?? {};
  const qRaw = (sp.q ?? "").trim();
  const fromFilter = (sp.from ?? "").trim().slice(0, 32);
  const tipo = (sp.tipo ?? "").trim(); // gerar|baixar|todos

  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const pageSize = 30;
  const skip = (page - 1) * pageSize;

  const qDigits = qRaw ? digitsOnly(qRaw) : "";
  const cnpj = qDigits.length === 14 ? qDigits : "";
  const q = cnpj ? "" : qRaw;
  const qNorm = q ? normalizeName(q) : "";
  const qTerms = qNorm ? qNorm.split(" ").filter(Boolean).slice(0, 8) : [];

  const instituicaoIdsFilter = (() => {
    if (!cnpj && qTerms.length === 0) return null;
    return withPrismaRetry(() =>
      prisma.instituicao
        .findMany({
          where: {
            deletedAt: null,
            ...(cnpj
              ? { cnpj }
              : {
                  AND: qTerms.map((t) => ({ nomeNormalizado: { contains: t } })),
                }),
          },
          take: 200,
          select: { id: true },
        })
        .then((xs) => xs.map((x) => x.id)),
    );
  })();

  const ids = await (instituicaoIdsFilter ?? Promise.resolve(null));

  const baseWhere = buildReportHistoryWhere({
    tipo: (tipo as never) || "",
    fromFilter,
    entidadeIds: ids,
    qRaw,
    idsResolved: Boolean(ids),
  });

  const [total, rows] = await withPrismaRetry(() =>
    Promise.all([
      prisma.logAuditoria.count({ where: baseWhere }),
      prisma.logAuditoria.findMany({
        where: baseWhere,
        orderBy: [{ timestamp: "desc" }],
        take: pageSize,
        skip,
        select: {
          id: true,
          entidadeId: true,
          timestamp: true,
          actor: { select: { nome: true, email: true } },
          metadata: true,
        },
      }),
    ]),
  );

  const instituicaoIds = Array.from(new Set(rows.map((r) => r.entidadeId)));
  const instituicoes = instituicaoIds.length
    ? await withPrismaRetry(() =>
        prisma.instituicao.findMany({
          where: { id: { in: instituicaoIds }, deletedAt: null },
          select: { id: true, nome: true, cnpj: true, municipio: true, uf: true },
        }),
      )
    : [];
  const instById = new Map(instituicoes.map((i) => [i.id, i] as const));

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(d);

  const qp = new URLSearchParams();
  if (qRaw) qp.set("q", qRaw);
  if (fromFilter) qp.set("from", fromFilter);
  if (tipo) qp.set("tipo", tipo);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <AppHeader />
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Relatórios • Histórico</h1>
            <p className="mt-1 text-sm text-zinc-700">Gerações recentes de relatório institucional em PDF.</p>
          </div>
          <Link
            href="/relatorios"
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Voltar
          </Link>
        </div>

        <form className="mt-6 grid grid-cols-1 gap-2 rounded-2xl border border-zinc-200 bg-white p-4 sm:grid-cols-6">
          <div className="sm:col-span-4">
            <label className="text-[11px] font-medium text-zinc-700" htmlFor="q">
              Buscar (instituição, CNPJ ou usuário)
            </label>
            <input
              id="q"
              name="q"
              defaultValue={qRaw}
              placeholder="Ex.: Escola / 12345678000199 / fulano@"
              className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-xs text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[11px] font-medium text-zinc-700" htmlFor="from">
              Origem
            </label>
            <select
              id="from"
              name="from"
              defaultValue={fromFilter}
              className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-zinc-400"
            >
              <option value="">(todas)</option>
              <option value="hub">hub</option>
              <option value="historico">historico</option>
              <option value="ficha">ficha</option>
              <option value="unknown">unknown</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-[11px] font-medium text-zinc-700" htmlFor="tipo">
              Tipo
            </label>
            <select
              id="tipo"
              name="tipo"
              defaultValue={tipo}
              className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-zinc-400"
            >
              <option value="">Gerar (PDF)</option>
              <option value="baixar">Baixar</option>
              <option value="todos">Todos</option>
            </select>
          </div>
          <div className="sm:col-span-6 flex items-center justify-end gap-2">
            <button className="h-10 rounded-md bg-zinc-900 px-4 text-xs font-medium text-white hover:bg-zinc-800">
              Filtrar
            </button>
            <Link
              href="/relatorios/historico"
              className="h-10 rounded-md border border-zinc-200 bg-white px-4 text-center text-xs font-medium leading-10 text-zinc-800 hover:bg-zinc-50"
            >
              Limpar
            </Link>
          </div>
        </form>

        <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 px-4 py-3 text-xs text-zinc-700">
            {total} evento(s) • página {page} de {totalPages}
          </div>
          <ul className="divide-y divide-zinc-200">
            {rows.map((r) => {
              const meta = (r.metadata ?? {}) as { from?: string; evento?: string };
              const inst = instById.get(r.entidadeId) ?? null;
              const label = meta.evento === "BAIXAR_RELATORIO_PDF" ? "Baixou" : "Gerou";
              return (
                <li key={r.id} className="px-4 py-3 hover:bg-zinc-50">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-zinc-900">
                        <Link
                          href={`/instituicoes/${r.entidadeId}`}
                          className="hover:underline"
                        >
                          {inst ? inst.nome : `Instituição ${r.entidadeId}`}
                        </Link>
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-700">
                        {fmt(r.timestamp)} • {label} • {r.actor.nome} ({r.actor.email})
                        {meta.from ? ` • origem: ${meta.from}` : ""}
                      </div>
                      {inst ? (
                        <div className="mt-0.5 text-[11px] text-zinc-600">
                          {inst.cnpj ? `CNPJ ${formatCnpj(inst.cnpj)}` : "CNPJ —"}
                          {" • "}
                          {inst.municipio ?? "Município não informado"}
                          {inst.uf ? `/${inst.uf}` : ""}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/api/instituicoes/${r.entidadeId}/relatorio.pdf?from=historico&dl=1`}
                        className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                      >
                        Baixar PDF
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
            {rows.length === 0 ? (
              <li className="px-4 py-10 text-center text-sm text-zinc-700">Sem eventos ainda.</li>
            ) : null}
          </ul>
          <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3 text-xs">
            <div className="text-zinc-600">Mostrando {rows.length} de {total}</div>
            <div className="flex items-center gap-2">
              <Link
                aria-disabled={!hasPrev}
                href={
                  hasPrev
                    ? `/relatorios/historico?${(() => {
                        const p = new URLSearchParams(qp);
                        p.set("page", String(page - 1));
                        return p.toString();
                      })()}`
                    : "#"
                }
                className={`rounded-md border border-zinc-200 bg-white px-3 py-2 font-medium text-zinc-800 hover:bg-zinc-50 ${
                  !hasPrev ? "pointer-events-none opacity-50" : ""
                }`}
              >
                Anterior
              </Link>
              <Link
                aria-disabled={!hasNext}
                href={
                  hasNext
                    ? `/relatorios/historico?${(() => {
                        const p = new URLSearchParams(qp);
                        p.set("page", String(page + 1));
                        return p.toString();
                      })()}`
                    : "#"
                }
                className={`rounded-md border border-zinc-200 bg-white px-3 py-2 font-medium text-zinc-800 hover:bg-zinc-50 ${
                  !hasNext ? "pointer-events-none opacity-50" : ""
                }`}
              >
                Próxima
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

