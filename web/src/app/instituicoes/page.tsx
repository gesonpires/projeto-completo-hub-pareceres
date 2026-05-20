import Link from "next/link";
import { digitsOnly, formatCnpj } from "@/server/normalize";
import { AppHeader } from "@/components/AppHeader";
import { ErrorAlert } from "@/components/ErrorAlert";
import { CnpjInput } from "@/components/CnpjInput";
import { UfInput } from "@/components/UfInput";
import { getSessionFromCookies } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { redirect } from "next/navigation";
import {
  buildInstitutionListSearchParams,
  loadInstitutionList,
  parseInstitutionListQuery,
  type InstitutionListSearchParams,
} from "@/server/read-models/institutionList";

export default async function InstituicoesPage({
  searchParams,
}: {
  searchParams?: Promise<InstitutionListSearchParams>;
}) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!hasPermission(session.perfil, "institutions:read")) redirect("/");
  const canCreate = hasPermission(session.perfil, "institutions:write");

  const sp = (await searchParams) ?? {};
  const loaded = await loadInstitutionList(sp);

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

  const dbError =
    loaded.status === "db_error"
      ? "Banco indisponível no momento (conexão fechada). Reinicie o banco/Postgres e o `npm run dev`."
      : null;

  const instituicoes = loaded.status === "ok" ? loaded.items : [];
  const total = loaded.status === "ok" ? loaded.total : 0;
  const page = loaded.status === "ok" ? loaded.page : 1;
  const totalPages = loaded.status === "ok" ? loaded.totalPages : 1;
  const dir = loaded.status === "ok" ? loaded.query.dir : ("asc" as const);

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const listQuery = loaded.status === "ok" ? loaded.query : parseInstitutionListQuery(sp);
  const queryBase = buildInstitutionListSearchParams(listQuery);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <AppHeader />
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Instituições</h1>
          <p className="mt-1 text-sm text-zinc-700">
            Busca com filtros (MVP).
          </p>
        </div>
        <Link
          href={canCreate ? "/instituicoes/nova" : "#"}
          aria-disabled={!canCreate}
          title={!canCreate ? "Sem permissão para criar instituição." : undefined}
          className={`rounded-md px-3 py-2 text-xs font-medium ${
            canCreate
              ? "bg-zinc-900 text-white hover:bg-zinc-800"
              : "pointer-events-none bg-zinc-200 text-zinc-500"
          }`}
        >
          Nova instituição
        </Link>
      </div>

      <form className="mt-6 grid grid-cols-1 gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:grid-cols-6">
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-zinc-800" htmlFor="q">
            Texto (nome)
          </label>
          <input
            id="q"
            name="q"
            defaultValue={qRaw}
            className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
            placeholder="Ex.: Escola X / Instituto Y"
          />
          {qDigits.length === 14 && !cnpjRaw ? (
            <div className="mt-1 text-[11px] text-zinc-600">
              Detectado CNPJ (14 dígitos). Buscando por CNPJ exato.
            </div>
          ) : null}
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-800" htmlFor="cnpj">
            CNPJ (exato)
          </label>
          <CnpjInput
            id="cnpj"
            name="cnpj"
            defaultValue={cnpjRaw}
            className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
          />
        </div>
        <div className="sm:col-span-2">
          <label
            className="text-xs font-medium text-zinc-800"
            htmlFor="municipio"
          >
            Município
          </label>
          <input
            id="municipio"
            name="municipio"
            defaultValue={municipio}
            className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
            placeholder="Ex.: Florianópolis"
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
          <label className="text-xs font-medium text-zinc-800" htmlFor="situacao">
            Situação
          </label>
          <select
            id="situacao"
            name="situacao"
            defaultValue={situacao}
            className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-zinc-400"
          >
            <option value="">(todas)</option>
            <option value="ATIVA">ATIVA</option>
            <option value="INATIVA">INATIVA</option>
            <option value="EM_ANALISE">EM_ANALISE</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-800" htmlFor="tem_processos">
            Tem processos
          </label>
          <select
            id="tem_processos"
            name="tem_processos"
            defaultValue={temProcessosRaw}
            className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-zinc-400"
          >
            <option value="">(indiferente)</option>
            <option value="1">Sim</option>
            <option value="0">Não</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-800" htmlFor="eventos_de">
            Eventos/Atos de
          </label>
          <input
            id="eventos_de"
            name="eventos_de"
            type="date"
            defaultValue={eventosDeRaw}
            className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-zinc-400"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-800" htmlFor="eventos_ate">
            Até
          </label>
          <input
            id="eventos_ate"
            name="eventos_ate"
            type="date"
            defaultValue={eventosAteRaw}
            className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-zinc-400"
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
              defaultValue={sort || "nome"}
              className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-zinc-400"
            >
              <option value="nome">Nome</option>
              <option value="mais_recentes">Mais recentes</option>
              <option value="mais_processos">Mais processos</option>
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
              <option value="asc">Asc</option>
              <option value="desc">Desc</option>
            </select>
          </div>
          <div className="w-full" />
          <div className="w-full" />
          <button
            type="submit"
            className="h-10 w-full rounded-md bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-800"
          >
            Buscar
          </button>
          <Link
            href="/instituicoes"
            className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-center text-xs font-medium leading-10 text-zinc-800 hover:bg-zinc-50"
          >
            Limpar
          </Link>
        </div>
      </form>

      {dbError ? (
        <ErrorAlert
          message={dbError}
          dismissHref={`/instituicoes?${(() => {
            const p = new URLSearchParams(queryBase);
            return p.toString();
          })()}`}
          className="mt-6"
        />
      ) : null}

      <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-4 py-3 text-xs text-zinc-700">
          {total} resultado(s) • página {page} de {totalPages}
        </div>
        <ul className="divide-y divide-zinc-200">
          {instituicoes.map((i) => (
            <li key={i.id} className="px-4 py-3 hover:bg-zinc-50">
              <Link
                href={`/instituicoes/${i.id}?returnTo=${encodeURIComponent(
                  `/instituicoes?${queryBase.toString()}`,
                )}`}
                className="block"
              >
                <div className="text-sm font-medium text-zinc-900">
                  {i.nome}
                </div>
                <div className="mt-0.5 text-xs text-zinc-700">
                  {i.cnpj ? `CNPJ ${formatCnpj(i.cnpj)}` : "CNPJ não informado"}
                  {" • "}
                  {i.municipio ? i.municipio : "Município não informado"}
                  {i.uf ? `/${i.uf}` : ""}
                  {" • "}
                  {i._count?.processos ?? 0} processo(s)
                </div>
              </Link>
            </li>
          ))}
          {instituicoes.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-zinc-700">
              Nenhum resultado. Ajuste os filtros.
            </li>
          ) : null}
        </ul>
        <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3 text-xs">
          <div className="text-zinc-600">
            Mostrando {instituicoes.length} de {total}
          </div>
          <div className="flex items-center gap-2">
            <Link
              aria-disabled={!hasPrev}
              href={
                hasPrev
                  ? `/instituicoes?${buildInstitutionListSearchParams(listQuery, {
                      page: page - 1,
                    }).toString()}`
                  : "#"
              }
              className={`rounded-md border border-zinc-200 bg-white px-3 py-2 font-medium text-zinc-800 hover:bg-zinc-50 ${!hasPrev ? "pointer-events-none opacity-50" : ""}`}
            >
              Anterior
            </Link>
            <Link
              aria-disabled={!hasNext}
              href={
                hasNext
                  ? `/instituicoes?${buildInstitutionListSearchParams(listQuery, {
                      page: page + 1,
                    }).toString()}`
                  : "#"
              }
              className={`rounded-md border border-zinc-200 bg-white px-3 py-2 font-medium text-zinc-800 hover:bg-zinc-50 ${!hasNext ? "pointer-events-none opacity-50" : ""}`}
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
