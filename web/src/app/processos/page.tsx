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
  numero?: string;
  assunto?: string;
  ano?: string;
  status?: string;
  tipo?: string;
  uf?: string;
  de?: string;
  ate?: string;
  instituicao_id?: string;
  sort?: string;
  dir?: string;
  page?: string;
};

function parseDateOnly(raw: string) {
  const v = raw.trim();
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default async function ProcessosPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!hasPermission(session.perfil, "processes:read")) redirect("/");

  const sp = (await searchParams) ?? {};
  const qRaw = (sp.q ?? "").trim();
  const cnpjRaw = (sp.cnpj ?? "").trim();
  const numero = (sp.numero ?? "").trim();
  const assunto = (sp.assunto ?? "").trim();
  const ufRaw = (sp.uf ?? "").trim();
  const status = (sp.status ?? "").trim();
  const tipo = (sp.tipo ?? "").trim();
  const ano = (sp.ano ?? "").trim();
  const deRaw = (sp.de ?? "").trim();
  const ateRaw = (sp.ate ?? "").trim();
  const instituicaoId = (sp.instituicao_id ?? "").trim();
  const sort = (sp.sort ?? "").trim();
  const dirRaw = (sp.dir ?? "").trim();

  const qDigits = qRaw ? digitsOnly(qRaw) : "";
  const cnpjDigits = cnpjRaw ? digitsOnly(cnpjRaw) : "";
  const cnpj = cnpjDigits || (qDigits.length === 14 ? qDigits : "");
  const q = cnpj ? "" : qRaw;
  const qNorm = q ? normalizeName(q) : "";
  const qTerms = qNorm ? qNorm.split(" ").filter(Boolean).slice(0, 8) : [];

  const uf = ufRaw ? ufRaw.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2) : "";
  const anoInt = Number.parseInt(ano, 10);
  const anoParsed = Number.isFinite(anoInt) ? anoInt : null;

  const de = parseDateOnly(deRaw);
  const ate = parseDateOnly(ateRaw);

  const dir: "asc" | "desc" = dirRaw === "asc" ? "asc" : "desc";

  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const pageSize = 25;
  const skip = (page - 1) * pageSize;

  const where = {
    deletedAt: null,
    ...(status ? { status: status as never } : {}),
    ...(tipo ? { tipo: tipo as never } : {}),
    ...(anoParsed ? { ano: anoParsed } : {}),
    ...(numero ? { numero: { contains: numero, mode: "insensitive" as const } } : {}),
    ...(assunto ? { assunto: { contains: assunto, mode: "insensitive" as const } } : {}),
    ...(instituicaoId ? { instituicaoId } : {}),
    ...(de || ate
      ? {
          dataAbertura: {
            ...(de ? { gte: de } : {}),
            ...(ate ? { lte: ate } : {}),
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
  let processos: Array<{
    id: string;
    numero: string | null;
    ano: number | null;
    status: string;
    tipo: string | null;
    assunto: string | null;
    instituicao: { id: string; nome: string; cnpj: string | null; municipio: string | null; uf: string | null };
  }> = [];
  let dbError: string | null = null;

  try {
    const orderBy = (() => {
      switch (sort) {
        case "recentes":
          return [
            { dataAbertura: "desc" as const },
            { createdAt: "desc" as const },
          ];
        case "ano":
          return [{ ano: dir }, { numero: "asc" as const }];
        case "numero":
          return [{ numero: dir }, { ano: "desc" as const }];
        case "instituicao":
          return [
            { instituicao: { nomeNormalizado: dir } },
            { updatedAt: "desc" as const },
          ];
        case "createdAt":
          return [{ createdAt: dir }, { updatedAt: "desc" as const }];
        case "updatedAt":
        default:
          return [{ updatedAt: dir }, { createdAt: "desc" as const }];
      }
    })();

    [total, processos] = await withPrismaRetry(() =>
      Promise.all([
        prisma.processo.count({ where }),
        prisma.processo.findMany({
          where,
          orderBy,
          take: pageSize,
          skip,
          select: {
            id: true,
            numero: true,
            ano: true,
            status: true,
            tipo: true,
            assunto: true,
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
  if (numero) queryBase.set("numero", numero);
  if (assunto) queryBase.set("assunto", assunto);
  if (ano) queryBase.set("ano", ano);
  if (status) queryBase.set("status", status);
  if (tipo) queryBase.set("tipo", tipo);
  if (ufRaw) queryBase.set("uf", ufRaw);
  if (deRaw) queryBase.set("de", deRaw);
  if (ateRaw) queryBase.set("ate", ateRaw);
  if (instituicaoId) queryBase.set("instituicao_id", instituicaoId);
  if (sort) queryBase.set("sort", sort);
  if (dirRaw) queryBase.set("dir", dirRaw);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <AppHeader />
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Processos</h1>
            <p className="mt-1 text-sm text-zinc-700">Busca global com filtros (Épico 4).</p>
          </div>
          <Link
            href="/instituicoes"
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Ir para instituições
          </Link>
        </div>

        <form className="mt-6 grid grid-cols-1 gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:grid-cols-8">
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
            <label className="text-xs font-medium text-zinc-800" htmlFor="numero">
              Nº processo
            </label>
            <input
              id="numero"
              name="numero"
              defaultValue={numero}
              className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
              placeholder="Ex.: 123/2024"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-800" htmlFor="ano">
              Ano
            </label>
            <input
              id="ano"
              name="ano"
              defaultValue={ano}
              className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
              placeholder="2026"
              inputMode="numeric"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-800" htmlFor="de">
              Abertura de
            </label>
            <input
              id="de"
              name="de"
              type="date"
              defaultValue={deRaw}
              className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-zinc-400"
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
              defaultValue={ateRaw}
              className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-zinc-400"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-zinc-800" htmlFor="assunto">
              Assunto
            </label>
            <input
              id="assunto"
              name="assunto"
              defaultValue={assunto}
              className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
              placeholder="Ex.: credenciamento"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-800" htmlFor="status">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={status}
              className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-zinc-400"
            >
              <option value="">(todos)</option>
              <option value="ABERTO">ABERTO</option>
              <option value="EM_TRAMITACAO">EM_TRAMITACAO</option>
              <option value="CONCLUIDO">CONCLUIDO</option>
              <option value="ARQUIVADO">ARQUIVADO</option>
            </select>
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
              <option value="CREDENCIAMENTO">CREDENCIAMENTO</option>
              <option value="AUTORIZACAO">AUTORIZACAO</option>
              <option value="RENOVACAO">RENOVACAO</option>
              <option value="OUTRO">OUTRO</option>
            </select>
          </div>
          <div className="flex items-end gap-2 sm:col-span-2">
            <div className="w-full">
              <label className="text-xs font-medium text-zinc-800" htmlFor="sort">
                Ordenar por
              </label>
              <select
                id="sort"
                name="sort"
                defaultValue={sort || "recentes"}
                className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-zinc-400"
              >
                <option value="recentes">Mais recentes (abertura)</option>
                <option value="updatedAt">Atualização</option>
                <option value="createdAt">Criação</option>
                <option value="instituicao">Instituição</option>
                <option value="numero">Número</option>
                <option value="ano">Ano</option>
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
              href="/processos"
              className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-center text-xs font-medium leading-10 text-zinc-800 hover:bg-zinc-50"
            >
              Limpar
            </Link>
          </div>
        </form>

        {dbError ? (
          <ErrorAlert message={dbError} dismissHref={`/processos?${queryBase.toString()}`} className="mt-6" />
        ) : null}

        <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 px-4 py-3 text-xs text-zinc-700">
            {total} resultado(s) • página {page} de {totalPages}
          </div>
          <ul className="divide-y divide-zinc-200">
            {processos.map((p) => (
              <li key={p.id} className="px-4 py-3 hover:bg-zinc-50">
                <Link
                  href={`/instituicoes/${p.instituicao.id}?returnTo=${encodeURIComponent(
                    `/processos?${queryBase.toString()}`,
                  )}#t-processo-${p.id}`}
                  className="block"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <div className="text-sm font-medium text-zinc-900">
                      {p.numero ? p.numero : "Processo sem número"}
                      {p.ano ? `/${p.ano}` : ""}
                      <span className="text-zinc-500"> • </span>
                      <span className="text-zinc-800">{p.status}</span>
                      {p.tipo ? <span className="text-zinc-500"> • {p.tipo}</span> : null}
                    </div>
                    <div className="text-xs text-zinc-600">
                      {p.instituicao.cnpj ? `CNPJ ${formatCnpj(p.instituicao.cnpj)}` : "CNPJ não informado"}
                      {" • "}
                      {p.instituicao.municipio ? p.instituicao.municipio : "Município não informado"}
                      {p.instituicao.uf ? `/${p.instituicao.uf}` : ""}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-zinc-700">
                    <span className="font-medium">{p.instituicao.nome}</span>
                    {p.assunto ? <span className="text-zinc-500"> • {p.assunto}</span> : null}
                  </div>
                </Link>
              </li>
            ))}
            {processos.length === 0 ? (
              <li className="px-4 py-10 text-center text-sm text-zinc-700">Nenhum resultado. Ajuste os filtros.</li>
            ) : null}
          </ul>
          <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3 text-xs">
            <div className="text-zinc-600">
              Mostrando {processos.length} de {total}
            </div>
            <div className="flex items-center gap-2">
              <Link
                aria-disabled={!hasPrev}
                href={
                  hasPrev
                    ? `/processos?${(() => {
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
                    ? `/processos?${(() => {
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

