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
  q?: string; // instituição (nome)
  cnpj?: string;
  uf?: string;
  titulo?: string;
  conteudo?: string; // textoExtraido
  tipo?: string;
  de?: string;
  ate?: string;
  comArquivo?: string;
  processoNumero?: string;
  processoAno?: string;
  sort?: string;
  dir?: string;
  page?: string;
};

export default async function DocumentosPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!hasPermission(session.perfil, "documents:read")) redirect("/");
  const canUploadBatch = hasPermission(session.perfil, "documents:write");

  const sp = (await searchParams) ?? {};
  const qRaw = (sp.q ?? "").trim();
  const cnpjRaw = (sp.cnpj ?? "").trim();
  const ufRaw = (sp.uf ?? "").trim();
  const titulo = (sp.titulo ?? "").trim();
  const conteudo = (sp.conteudo ?? "").trim();
  const tipo = (sp.tipo ?? "").trim();
  const de = (sp.de ?? "").trim();
  const ate = (sp.ate ?? "").trim();
  const comArquivo = (sp.comArquivo ?? "").trim();
  const processoNumero = (sp.processoNumero ?? "").trim();
  const processoAno = (sp.processoAno ?? "").trim();
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

  const procAnoInt = Number.parseInt(processoAno, 10);
  const procAnoParsed = Number.isFinite(procAnoInt) ? procAnoInt : null;

  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const pageSize = 25;
  const skip = (page - 1) * pageSize;

  const where = {
    deletedAt: null,
    ...(titulo ? { titulo: { contains: titulo, mode: "insensitive" as const } } : {}),
    ...(conteudo ? { textoExtraido: { contains: conteudo, mode: "insensitive" as const } } : {}),
    ...(tipo ? { tipoDocumento: { codigo: tipo as never } } : {}),
    ...(comArquivo === "1" ? { storagePath: { not: null } } : {}),
    ...(from || to
      ? {
          dataDocumento: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
    ...(processoNumero || procAnoParsed
      ? {
          processo: {
            ...(processoNumero
              ? { numero: { contains: processoNumero, mode: "insensitive" as const } }
              : {}),
            ...(procAnoParsed ? { ano: procAnoParsed } : {}),
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
  let docs: Array<{
    id: string;
    titulo: string;
    dataDocumento: Date | null;
    storagePath: string | null;
    arquivoNome: string | null;
    textoExtraido: string | null;
    tipoDocumento: { codigo: string };
    instituicao: { id: string; nome: string; cnpj: string | null; municipio: string | null; uf: string | null } | null;
    processo: { id: string; numero: string | null; ano: number | null } | null;
    ato: { id: string; tipo: string; numero: string | null; dataAto: Date } | null;
    evento: { id: string; tipo: string; dataEvento: Date; descricao: string } | null;
  }> = [];
  let tipos: Array<{ codigo: string; nome: string }> = [];
  let dbError: string | null = null;

  try {
    const orderBy = (() => {
      switch (sort) {
        case "dataDocumento":
          return [{ dataDocumento: dir }, { updatedAt: "desc" as const }];
        case "titulo":
          return [{ titulo: dir }, { updatedAt: "desc" as const }];
        case "instituicao":
          return [
            { instituicao: { nomeNormalizado: dir } },
            { updatedAt: "desc" as const },
          ];
        case "updatedAt":
        default:
          return [{ updatedAt: dir }];
      }
    })();

    const result = await withPrismaRetry(() =>
      Promise.all([
        prisma.documento.count({ where }),
        prisma.documento.findMany({
          where,
          orderBy,
          take: pageSize,
          skip,
          select: {
            id: true,
            titulo: true,
            dataDocumento: true,
            storagePath: true,
            arquivoNome: true,
            textoExtraido: true,
            tipoDocumento: { select: { codigo: true } },
            instituicao: {
              select: { id: true, nome: true, cnpj: true, municipio: true, uf: true },
            },
            processo: { select: { id: true, numero: true, ano: true } },
            ato: { select: { id: true, tipo: true, numero: true, dataAto: true } },
            evento: { select: { id: true, tipo: true, dataEvento: true, descricao: true } },
          },
        }),
        prisma.tipoDocumento.findMany({
          orderBy: [{ codigo: "asc" }],
          select: { codigo: true, nome: true },
        }),
      ]),
    );
    total = result[0];
    docs = result[1];
    tipos = result[2];
  } catch {
    dbError = "Banco indisponível no momento. Tente novamente em instantes.";
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const queryBase = new URLSearchParams();
  if (qRaw) queryBase.set("q", qRaw);
  if (cnpjRaw) queryBase.set("cnpj", cnpjRaw);
  if (ufRaw) queryBase.set("uf", ufRaw);
  if (titulo) queryBase.set("titulo", titulo);
  if (conteudo) queryBase.set("conteudo", conteudo);
  if (tipo) queryBase.set("tipo", tipo);
  if (de) queryBase.set("de", de);
  if (ate) queryBase.set("ate", ate);
  if (comArquivo) queryBase.set("comArquivo", comArquivo);
  if (processoNumero) queryBase.set("processoNumero", processoNumero);
  if (processoAno) queryBase.set("processoAno", processoAno);
  if (sort) queryBase.set("sort", sort);
  if (dirRaw) queryBase.set("dir", dirRaw);

  const fmtDate = (d: Date) =>
    new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(d);

  const makeSnippet = (text: string, query: string) => {
    const q = query.trim();
    if (!q) return "";
    const t = text || "";
    const idx = t.toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) return "";
    const start = Math.max(0, idx - 60);
    const end = Math.min(t.length, idx + q.length + 120);
    const raw = t.slice(start, end).replaceAll(/\s+/g, " ").trim();
    return (start > 0 ? "…" : "") + raw + (end < t.length ? "…" : "");
  };

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <AppHeader />
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Documentos</h1>
            <p className="mt-1 text-sm text-zinc-700">Busca global com filtros (Épico 4).</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={canUploadBatch ? "/documentos/lote" : "#"}
              aria-disabled={!canUploadBatch}
              title={!canUploadBatch ? "Sem permissão para enviar documentos." : undefined}
              className={`rounded-md px-3 py-2 text-xs font-medium ${
                canUploadBatch
                  ? "bg-zinc-900 text-white hover:bg-zinc-800"
                  : "pointer-events-none bg-zinc-200 text-zinc-500"
              }`}
            >
              Upload em lote
            </Link>
            <Link
              href="/instituicoes"
              className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Ir para instituições
            </Link>
          </div>
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
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-zinc-800" htmlFor="titulo">
              Título (contém)
            </label>
            <input
              id="titulo"
              name="titulo"
              defaultValue={titulo}
              className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
              placeholder="Ex.: Parecer / Ofício / Anexo"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-zinc-800" htmlFor="conteudo">
              Conteúdo (texto extraído contém)
            </label>
            <input
              id="conteudo"
              name="conteudo"
              defaultValue={conteudo}
              className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
              placeholder="Ex.: credenciamento / diligência"
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
              {tipos.map((t) => (
                <option key={t.codigo} value={t.codigo}>
                  {t.codigo}
                </option>
              ))}
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
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-zinc-800" htmlFor="processoNumero">
              Processo (número contém)
            </label>
            <input
              id="processoNumero"
              name="processoNumero"
              defaultValue={processoNumero}
              className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
              placeholder="Ex.: 123"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-800" htmlFor="processoAno">
              Ano proc.
            </label>
            <input
              id="processoAno"
              name="processoAno"
              defaultValue={processoAno}
              className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
              placeholder="2026"
              inputMode="numeric"
            />
          </div>
          <div className="flex items-end gap-2">
            <label className="flex h-10 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-800">
              <input
                type="checkbox"
                name="comArquivo"
                value="1"
                defaultChecked={comArquivo === "1"}
              />
              Com arquivo
            </label>
          </div>
          <div className="flex items-end gap-2 sm:col-span-2">
            <div className="w-full">
              <label className="text-xs font-medium text-zinc-800" htmlFor="sort">
                Ordenar por
              </label>
              <select
                id="sort"
                name="sort"
                defaultValue={sort || "updatedAt"}
                className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-zinc-400"
              >
                <option value="updatedAt">Atualização</option>
                <option value="dataDocumento">Data do documento</option>
                <option value="titulo">Título</option>
                <option value="instituicao">Instituição</option>
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
              href="/documentos"
              className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-center text-xs font-medium leading-10 text-zinc-800 hover:bg-zinc-50"
            >
              Limpar
            </Link>
          </div>
        </form>

        {dbError ? (
          <ErrorAlert
            message={dbError}
            dismissHref={`/documentos?${queryBase.toString()}`}
            className="mt-6"
          />
        ) : null}

        <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 px-4 py-3 text-xs text-zinc-700">
            {total} resultado(s) • página {page} de {totalPages}
          </div>
          <ul className="divide-y divide-zinc-200">
            {docs.map((d) => (
              <li key={d.id} className="px-4 py-3 hover:bg-zinc-50">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-zinc-900">
                      {d.tipoDocumento.codigo} • {d.titulo}
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-700">
                      {d.dataDocumento ? fmtDate(d.dataDocumento) : "Data não informada"}
                      {" • "}
                      {d.instituicao ? (
                        <>
                          <Link
                            className="font-medium text-zinc-900 hover:underline"
                            href={`/instituicoes/${d.instituicao.id}?returnTo=${encodeURIComponent(
                              `/documentos?${queryBase.toString()}`,
                            )}#t-documento-${d.id}`}
                          >
                            {d.instituicao.nome}
                          </Link>
                          <span className="text-zinc-500"> • </span>
                          {d.instituicao.cnpj ? `CNPJ ${formatCnpj(d.instituicao.cnpj)}` : "CNPJ não informado"}
                          <span className="text-zinc-500"> • </span>
                          {d.instituicao.municipio ? d.instituicao.municipio : "Município não informado"}
                          {d.instituicao.uf ? `/${d.instituicao.uf}` : ""}
                        </>
                      ) : (
                        "Instituição não informada"
                      )}
                    </div>
                    {d.processo ? (
                      <div className="mt-0.5 text-xs text-zinc-600">
                        Processo: {d.processo.numero ?? "sem número"}
                        {d.processo.ano ? `/${d.processo.ano}` : ""}
                      </div>
                    ) : null}
                    {d.ato ? (
                      <div className="mt-0.5 text-xs text-zinc-600">
                        Ato: {String(d.ato.tipo)}
                        {d.ato.numero ? ` ${d.ato.numero}` : ""} •{" "}
                        {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(d.ato.dataAto)}
                      </div>
                    ) : null}
                    {d.evento ? (
                      <div className="mt-0.5 text-xs text-zinc-600">
                        Evento: {String(d.evento.tipo)} •{" "}
                        {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(d.evento.dataEvento)} •{" "}
                        {d.evento.descricao.slice(0, 50)}
                      </div>
                    ) : null}
                    {conteudo && d.textoExtraido ? (
                      <div className="mt-1 text-xs text-zinc-700">
                        <span className="font-medium text-zinc-900">Trecho:</span>{" "}
                        <span className="font-mono">{makeSnippet(d.textoExtraido, conteudo)}</span>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {d.storagePath ? (
                      <Link
                        href={`/api/documentos/${d.id}/download`}
                        className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                      >
                        Download
                      </Link>
                    ) : (
                      <span className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-500">
                        Sem arquivo
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
            {docs.length === 0 ? (
              <li className="px-4 py-10 text-center text-sm text-zinc-700">
                Nenhum resultado. Ajuste os filtros.
              </li>
            ) : null}
          </ul>
          <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3 text-xs">
            <div className="text-zinc-600">
              Mostrando {docs.length} de {total}
            </div>
            <div className="flex items-center gap-2">
              <Link
                aria-disabled={!hasPrev}
                href={
                  hasPrev
                    ? `/documentos?${(() => {
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
                    ? `/documentos?${(() => {
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

