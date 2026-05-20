import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { ErrorAlert } from "@/components/ErrorAlert";
import { getSessionFromCookies } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { formatCnpj } from "@/server/normalize";
import {
  buildGlobalSearchQueryString,
  buildGlobalSearchReturnTo,
  buildGlobalSearchTabHref,
  loadGlobalSearch,
  type GlobalSearchSearchParams,
  type GlobalSearchTabKey,
} from "@/server/read-models/globalSearch";

function BuscaTabButton(props: {
  href: string;
  label: string;
  enabled: boolean;
  active: boolean;
  hasQuery: boolean;
  count: number;
}) {
  if (!props.enabled) return null;
  return (
    <Link
      href={props.href}
      className={[
        "rounded-md border px-3 py-2 text-xs font-medium",
        props.active
          ? "border-zinc-900 bg-zinc-900 text-white"
          : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50",
      ].join(" ")}
    >
      {props.label}
      {props.hasQuery ? (
        <span className={props.active ? "text-white/80" : "text-zinc-500"}>
          {" "}
          • {props.count.toString()}
        </span>
      ) : null}
    </Link>
  );
}

export default async function BuscaGlobalPage({
  searchParams,
}: {
  searchParams?: Promise<GlobalSearchSearchParams>;
}) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");

  const canInst = hasPermission(session.perfil, "institutions:read");
  const canProc = hasPermission(session.perfil, "processes:read");
  const canReg = hasPermission(session.perfil, "regulatory:read");
  const canDocs = hasPermission(session.perfil, "documents:read");
  if (!canInst && !canProc && !canReg && !canDocs) redirect("/");

  const sp = (await searchParams) ?? {};
  const loaded = await loadGlobalSearch(sp, {
    canInst,
    canProc,
    canReg,
    canDocs,
  });

  const qRaw = (sp.q ?? "").trim();
  const dbError =
    loaded.status === "db_error"
      ? "Banco indisponível no momento. Tente novamente em instantes."
      : null;

  const query = loaded.status === "ok" ? loaded.query : null;
  const hasQuery = query?.hasQuery ?? qRaw.length > 0;
  const qIsCnpj = query?.qIsCnpj ?? false;
  const effectiveTab: GlobalSearchTabKey =
    loaded.status === "ok" ? loaded.effectiveTab : "instituicoes";
  const counts = loaded.status === "ok" ? loaded.counts : {};
  const { instituicoes, processos, atos, eventos, documentos } =
    loaded.status === "ok"
      ? loaded.results
      : {
          instituicoes: [],
          processos: [],
          atos: [],
          eventos: [],
          documentos: [],
        };

  const qs = query
    ? buildGlobalSearchQueryString(query)
    : (() => {
        const p = new URLSearchParams();
        if (qRaw) p.set("q", qRaw);
        return p;
      })();

  const tabHref = (t: GlobalSearchTabKey) =>
    query ? buildGlobalSearchTabHref(query, t) : `/busca?tab=${t}`;

  const returnToBusca = query
    ? buildGlobalSearchReturnTo(query, effectiveTab)
    : `/busca?tab=${effectiveTab}`;

  const fmtDate = (d: Date) =>
    new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(d);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <AppHeader />
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Busca global</h1>
            <p className="mt-1 text-sm text-zinc-700">
              Uma busca rápida com abas (Épico 4).
            </p>
          </div>
          <Link
            href="/"
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Voltar
          </Link>
        </div>

        <form className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4">
          <label className="text-xs font-medium text-zinc-800" htmlFor="q">
            Pesquisar
          </label>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row">
            <input
              id="q"
              name="q"
              defaultValue={qRaw}
              className="h-10 w-full rounded-md border border-zinc-200 px-3 text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
              placeholder="Nome da instituição, CNPJ (14 dígitos) ou termos do título"
            />
            <input type="hidden" name="tab" value={effectiveTab} />
            <button className="h-10 rounded-md bg-zinc-900 px-4 text-xs font-medium text-white hover:bg-zinc-800">
              Buscar
            </button>
            <Link
              href="/busca"
              className="h-10 rounded-md border border-zinc-200 bg-white px-4 text-center text-xs font-medium leading-10 text-zinc-800 hover:bg-zinc-50"
            >
              Limpar
            </Link>
          </div>
          {qIsCnpj ? (
            <div className="mt-2 text-[11px] text-zinc-600">
              Detectado CNPJ (14 dígitos). Buscando por CNPJ exato quando aplicável.
            </div>
          ) : null}
        </form>

        {dbError ? (
          <ErrorAlert message={dbError} dismissHref={`/busca?${qs.toString()}`} className="mt-6" />
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          <BuscaTabButton
            href={tabHref("instituicoes")}
            label="Instituições"
            enabled={canInst}
            active={effectiveTab === "instituicoes"}
            hasQuery={hasQuery}
            count={counts.instituicoes ?? 0}
          />
          <BuscaTabButton
            href={tabHref("processos")}
            label="Processos"
            enabled={canProc}
            active={effectiveTab === "processos"}
            hasQuery={hasQuery}
            count={counts.processos ?? 0}
          />
          <BuscaTabButton
            href={tabHref("atos")}
            label="Atos"
            enabled={canReg}
            active={effectiveTab === "atos"}
            hasQuery={hasQuery}
            count={counts.atos ?? 0}
          />
          <BuscaTabButton
            href={tabHref("eventos")}
            label="Eventos"
            enabled={canReg}
            active={effectiveTab === "eventos"}
            hasQuery={hasQuery}
            count={counts.eventos ?? 0}
          />
          <BuscaTabButton
            href={tabHref("documentos")}
            label="Documentos"
            enabled={canDocs}
            active={effectiveTab === "documentos"}
            hasQuery={hasQuery}
            count={counts.documentos ?? 0}
          />
        </div>

        {!hasQuery ? (
          <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-700">
            Digite um termo e clique em <span className="font-medium">Buscar</span>.
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            <div className="border-b border-zinc-200 px-4 py-3 text-xs text-zinc-700">
              Mostrando até 25 resultado(s) •{" "}
              <span className="font-medium">{effectiveTab}</span>
            </div>

            {effectiveTab === "instituicoes" ? (
              <ul className="divide-y divide-zinc-200">
                {instituicoes.map((i) => (
                  <li key={i.id} className="px-4 py-3 hover:bg-zinc-50">
                    <Link
                      href={`/instituicoes/${i.id}?returnTo=${encodeURIComponent(returnToBusca)}`}
                      className="block"
                    >
                      <div className="text-sm font-medium text-zinc-900">{i.nome}</div>
                      <div className="mt-0.5 text-xs text-zinc-700">
                        {i.cnpj ? `CNPJ ${formatCnpj(i.cnpj)}` : "CNPJ não informado"}
                        {" • "}
                        {i.municipio ? i.municipio : "Município não informado"}
                        {i.uf ? `/${i.uf}` : ""}
                      </div>
                    </Link>
                  </li>
                ))}
                {instituicoes.length === 0 ? (
                  <li className="px-4 py-10 text-center text-sm text-zinc-700">
                    Nenhum resultado.
                  </li>
                ) : null}
              </ul>
            ) : null}

            {effectiveTab === "processos" ? (
              <ul className="divide-y divide-zinc-200">
                {processos.map((p) => (
                  <li key={p.id} className="px-4 py-3 hover:bg-zinc-50">
                    <Link
                      href={`/instituicoes/${p.instituicao.id}?returnTo=${encodeURIComponent(
                        returnToBusca,
                      )}#t-processo-${p.id}`}
                      className="block"
                    >
                      <div className="text-sm font-medium text-zinc-900">
                        {p.numero ?? "Processo sem número"}
                        {p.ano ? `/${p.ano}` : ""} • {p.status}
                        {p.tipo ? ` • ${p.tipo}` : ""}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-700">
                        <span className="font-medium">{p.instituicao.nome}</span>
                        <span className="text-zinc-500"> • </span>
                        {p.instituicao.cnpj
                          ? `CNPJ ${formatCnpj(p.instituicao.cnpj)}`
                          : "CNPJ não informado"}
                        <span className="text-zinc-500"> • </span>
                        {p.instituicao.municipio ?? "Município não informado"}
                        {p.instituicao.uf ? `/${p.instituicao.uf}` : ""}
                      </div>
                    </Link>
                  </li>
                ))}
                {processos.length === 0 ? (
                  <li className="px-4 py-10 text-center text-sm text-zinc-700">
                    Nenhum resultado.
                  </li>
                ) : null}
              </ul>
            ) : null}

            {effectiveTab === "atos" ? (
              <ul className="divide-y divide-zinc-200">
                {atos.map((a) => (
                  <li key={a.id} className="px-4 py-3 hover:bg-zinc-50">
                    <Link
                      href={`/instituicoes/${a.instituicao.id}?returnTo=${encodeURIComponent(
                        returnToBusca,
                      )}#t-ato-${a.id}`}
                      className="block"
                    >
                      <div className="text-sm font-medium text-zinc-900">
                        {a.tipo}
                        {a.numero ? ` ${a.numero}` : ""} • {fmtDate(a.dataAto)}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-700">
                        <span className="font-medium">{a.instituicao.nome}</span>
                        <span className="text-zinc-500"> • </span>
                        {a.instituicao.cnpj
                          ? `CNPJ ${formatCnpj(a.instituicao.cnpj)}`
                          : "CNPJ não informado"}
                        <span className="text-zinc-500"> • </span>
                        {a.instituicao.municipio ?? "Município não informado"}
                        {a.instituicao.uf ? `/${a.instituicao.uf}` : ""}
                      </div>
                    </Link>
                  </li>
                ))}
                {atos.length === 0 ? (
                  <li className="px-4 py-10 text-center text-sm text-zinc-700">
                    Nenhum resultado.
                  </li>
                ) : null}
              </ul>
            ) : null}

            {effectiveTab === "eventos" ? (
              <ul className="divide-y divide-zinc-200">
                {eventos.map((e) => (
                  <li key={e.id} className="px-4 py-3 hover:bg-zinc-50">
                    <Link
                      href={`/instituicoes/${e.instituicao.id}?returnTo=${encodeURIComponent(
                        returnToBusca,
                      )}#t-evento-${e.id}`}
                      className="block"
                    >
                      <div className="text-sm font-medium text-zinc-900">
                        {e.tipo} • {fmtDate(e.dataEvento)}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-700">
                        <span className="font-medium">{e.instituicao.nome}</span>
                        <span className="text-zinc-500"> • </span>
                        {e.descricao}
                      </div>
                    </Link>
                  </li>
                ))}
                {eventos.length === 0 ? (
                  <li className="px-4 py-10 text-center text-sm text-zinc-700">
                    Nenhum resultado.
                  </li>
                ) : null}
              </ul>
            ) : null}

            {effectiveTab === "documentos" ? (
              <ul className="divide-y divide-zinc-200">
                {documentos.map((d) => (
                  <li key={d.id} className="px-4 py-3 hover:bg-zinc-50">
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        href={
                          d.instituicao
                            ? `/instituicoes/${d.instituicao.id}?returnTo=${encodeURIComponent(
                                returnToBusca,
                              )}#t-documento-${d.id}`
                            : "#"
                        }
                        className="block min-w-0 flex-1"
                      >
                        <div className="text-sm font-medium text-zinc-900">
                          {d.tipoDocumento.codigo} • {d.titulo}
                        </div>
                        <div className="mt-0.5 text-xs text-zinc-700">
                          {d.dataDocumento ? fmtDate(d.dataDocumento) : "Data não informada"}
                          {" • "}
                          {d.instituicao ? (
                            <>
                              <span className="font-medium">{d.instituicao.nome}</span>
                              <span className="text-zinc-500"> • </span>
                              {d.instituicao.cnpj
                                ? `CNPJ ${formatCnpj(d.instituicao.cnpj)}`
                                : "CNPJ não informado"}
                            </>
                          ) : (
                            "Instituição não informada"
                          )}
                        </div>
                      </Link>
                      {d.storagePath ? (
                        <Link
                          href={`/api/documentos/${d.id}/download`}
                          className="shrink-0 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                        >
                          Download
                        </Link>
                      ) : (
                        <span className="shrink-0 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-500">
                          Sem arquivo
                        </span>
                      )}
                    </div>
                  </li>
                ))}
                {documentos.length === 0 ? (
                  <li className="px-4 py-10 text-center text-sm text-zinc-700">
                    Nenhum resultado.
                  </li>
                ) : null}
              </ul>
            ) : null}

            <div className="border-t border-zinc-200 px-4 py-3 text-xs text-zinc-700">
              Refine com filtros avançados em:{" "}
              {canInst ? <Link className="underline" href="/instituicoes">Instituições</Link> : null}
              {canProc ? (
                <>
                  {" "}
                  • <Link className="underline" href="/processos">Processos</Link>
                </>
              ) : null}
              {canReg ? (
                <>
                  {" "}
                  • <Link className="underline" href="/atos">Atos</Link> •{" "}
                  <Link className="underline" href="/eventos">Eventos</Link>
                </>
              ) : null}
              {canDocs ? (
                <>
                  {" "}
                  • <Link className="underline" href="/documentos">Documentos</Link>
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
