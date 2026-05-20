import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { ErrorAlert } from "@/components/ErrorAlert";
import { prisma } from "@/server/db";
import { withPrismaRetry } from "@/server/dbRetry";
import { getSessionFromCookies } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { digitsOnly, formatCnpj, normalizeName } from "@/server/normalize";
import { UfInput } from "@/components/UfInput";

type SearchParams = {
  q?: string;
  cnpj?: string;
  tipo?: string;
  de?: string;
  ate?: string;
  uf?: string;
  sort?: string;
  dir?: string;
  page?: string;
};

export default async function EventosPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!hasPermission(session.perfil, "regulatory:read")) redirect("/");

  const sp = (await searchParams) ?? {};
  const qRaw = (sp.q ?? "").trim();
  const cnpjRaw = (sp.cnpj ?? "").trim();
  const tipo = (sp.tipo ?? "").trim();
  const de = (sp.de ?? "").trim();
  const ate = (sp.ate ?? "").trim();
  const ufRaw = (sp.uf ?? "").trim();
  const sort = (sp.sort ?? "").trim();
  const dirRaw = (sp.dir ?? "").trim();

  const qDigits = qRaw ? digitsOnly(qRaw) : "";
  const cnpjDigits = cnpjRaw ? digitsOnly(cnpjRaw) : "";
  const cnpj = cnpjDigits || (qDigits.length === 14 ? qDigits : "");
  const q = cnpj ? "" : qRaw;
  const qNorm = q ? normalizeName(q) : "";
  const qTerms = qNorm ? qNorm.split(" ").filter(Boolean).slice(0, 8) : [];

  const uf = ufRaw ? ufRaw.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2) : "";
  const from = de ? new Date(de) : null;
  const to = ate ? new Date(ate) : null;

  const dir: "asc" | "desc" = dirRaw === "asc" ? "asc" : "desc";

  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const pageSize = 25;
  const skip = (page - 1) * pageSize;

  const where = {
    deletedAt: null,
    ...(tipo ? { tipo: tipo as never } : {}),
    ...(from || to
      ? {
          dataEvento: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
    ...(uf || cnpj || qTerms.length
      ? {
          instituicao: {
            ...(uf ? { uf } : {}),
            ...(cnpj
              ? { cnpj }
              : qTerms.length
                ? { AND: qTerms.map((t) => ({ nomeNormalizado: { contains: t } })) }
                : {}),
          },
        }
      : {}),
  };

  let total = 0;
  let eventos: Array<{
    id: string;
    tipo: string;
    dataEvento: Date;
    descricao: string;
    instituicao: { id: string; nome: string; cnpj: string | null; municipio: string | null; uf: string | null };
  }> = [];
  let dbError: string | null = null;

  try {
    const orderBy = (() => {
      switch (sort) {
        case "instituicao":
          return [{ instituicao: { nomeNormalizado: dir } }, { dataEvento: "desc" as const }];
        case "tipo":
          return [{ tipo: dir }, { dataEvento: "desc" as const }];
        case "dataEvento":
        default:
          return [{ dataEvento: dir }];
      }
    })();

    [total, eventos] = await withPrismaRetry(() =>
      Promise.all([
        prisma.eventoRegulatorio.count({ where }),
        prisma.eventoRegulatorio.findMany({
          where,
          orderBy,
          take: pageSize,
          skip,
          select: {
            id: true,
            tipo: true,
            dataEvento: true,
            descricao: true,
            instituicao: {
              select: { id: true, nome: true, cnpj: true, municipio: true, uf: true },
            },
          },
        }),
      ]),
    );
  } catch {
    dbError = "Banco indisponível no momento. Tente novamente em instantes.";
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const queryBase = new URLSearchParams();
  if (qRaw) queryBase.set("q", qRaw);
  if (cnpjRaw) queryBase.set("cnpj", cnpjRaw);
  if (tipo) queryBase.set("tipo", tipo);
  if (de) queryBase.set("de", de);
  if (ate) queryBase.set("ate", ate);
  if (ufRaw) queryBase.set("uf", ufRaw);
  if (sort) queryBase.set("sort", sort);
  if (dirRaw) queryBase.set("dir", dirRaw);

  const fmtDate = (d: Date) =>
    new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(d);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <AppHeader />
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Eventos</h1>
            <p className="mt-1 text-sm text-zinc-700">Busca global com filtros (Épico 4).</p>
          </div>
          <Link
            href="/instituicoes"
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Ir para instituições
          </Link>
        </div>

        <form className="mt-6 grid grid-cols-1 gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-zinc-800" htmlFor="q">
              Instituição (nome)
            </label>
            <input
              id="q"
              name="q"
              defaultValue={qRaw}
              className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
              placeholder="Ex.: Escola / Instituto"
            />
            {qDigits.length === 14 && !cnpjRaw ? (
              <div className="mt-1 text-[11px] text-zinc-600">
                Detectado CNPJ (14 dígitos) em “q”. Buscando por CNPJ exato.
              </div>
            ) : null}
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-800" htmlFor="cnpj">
              CNPJ (exato)
            </label>
            <input
              id="cnpj"
              name="cnpj"
              defaultValue={cnpjRaw}
              className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
              placeholder="Somente números"
              inputMode="numeric"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-800" htmlFor="uf">
              UF
            </label>
            <UfInput
              id="uf"
              name="uf"
              defaultValue={ufRaw}
              className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
              placeholder="SC"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-800" htmlFor="tipo">
              Tipo
            </label>
            <select
              id="tipo"
              name="tipo"
              defaultValue={tipo}
              className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-zinc-400"
            >
              <option value="">(todos)</option>
              <option value="PROTOCOLO">PROTOCOLO</option>
              <option value="DILIGENCIA">DILIGENCIA</option>
              <option value="REUNIAO">REUNIAO</option>
              <option value="DECISAO">DECISAO</option>
              <option value="OUTRO">OUTRO</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-800" htmlFor="de">
              De
            </label>
            <input
              id="de"
              name="de"
              type="date"
              defaultValue={de}
              className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-zinc-900 outline-none focus:border-zinc-400"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-800" htmlFor="ate">
              Até
            </label>
            <input
              id="ate"
              name="ate"
              type="date"
              defaultValue={ate}
              className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-zinc-900 outline-none focus:border-zinc-400"
            />
          </div>
          <div className="flex items-end gap-2 sm:col-span-2">
            <div className="w-full">
              <label className="text-xs font-medium text-zinc-800" htmlFor="sort">
                Ordenar por
              </label>
              <select
                id="sort"
                name="sort"
                defaultValue={sort || "dataEvento"}
                className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-zinc-400"
              >
                <option value="dataEvento">Data</option>
                <option value="instituicao">Instituição</option>
                <option value="tipo">Tipo</option>
              </select>
            </div>
            <div className="w-full">
              <label className="text-xs font-medium text-zinc-800" htmlFor="dir">
                Direção
              </label>
              <select
                id="dir"
                name="dir"
                defaultValue={dir}
                className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-zinc-400"
              >
                <option value="desc">Desc</option>
                <option value="asc">Asc</option>
              </select>
            </div>
            <button className="h-10 w-full rounded-md bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-800">
              Buscar
            </button>
            <Link
              href="/eventos"
              className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-center text-xs font-medium leading-10 text-zinc-800 hover:bg-zinc-50"
            >
              Limpar
            </Link>
          </div>
        </form>

        {dbError ? (
          <ErrorAlert message={dbError} dismissHref={`/eventos?${queryBase.toString()}`} className="mt-6" />
        ) : null}

        <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 px-4 py-3 text-xs text-zinc-700">
            {total} resultado(s) • página {page} de {totalPages}
          </div>
          <ul className="divide-y divide-zinc-200">
            {eventos.map((e) => (
              <li key={e.id} className="px-4 py-3 hover:bg-zinc-50">
                <Link
                  href={`/instituicoes/${e.instituicao.id}?returnTo=${encodeURIComponent(
                    `/eventos?${queryBase.toString()}`,
                  )}#t-evento-${e.id}`}
                  className="block"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <div className="text-sm font-medium text-zinc-900">
                      {e.tipo}
                      <span className="text-zinc-500"> • </span>
                      {fmtDate(e.dataEvento)}
                    </div>
                    <div className="text-xs text-zinc-600">
                      {e.instituicao.cnpj ? `CNPJ ${formatCnpj(e.instituicao.cnpj)}` : "CNPJ não informado"}
                      {" • "}
                      {e.instituicao.municipio ? e.instituicao.municipio : "Município não informado"}
                      {e.instituicao.uf ? `/${e.instituicao.uf}` : ""}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-zinc-700">
                    <span className="font-medium">{e.instituicao.nome}</span>
                    <span className="text-zinc-500"> • {e.descricao}</span>
                  </div>
                </Link>
              </li>
            ))}
            {eventos.length === 0 ? (
              <li className="px-4 py-10 text-center text-sm text-zinc-700">Nenhum resultado. Ajuste os filtros.</li>
            ) : null}
          </ul>
          <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3 text-xs">
            <div className="text-zinc-600">Mostrando {eventos.length} de {total}</div>
            <div className="flex items-center gap-2">
              <Link
                aria-disabled={!hasPrev}
                href={
                  hasPrev
                    ? `/eventos?${(() => {
                        const p = new URLSearchParams(queryBase);
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
                    ? `/eventos?${(() => {
                        const p = new URLSearchParams(queryBase);
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

