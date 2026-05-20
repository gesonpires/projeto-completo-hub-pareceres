import Link from "next/link";
import { prisma } from "@/server/db";
import { getSessionFromCookies } from "@/server/auth";
import { canReadAudit } from "@/server/permissions";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { withPrismaRetry } from "@/server/dbRetry";
import { ErrorAlert } from "@/components/ErrorAlert";

type SearchParams = {
  entidade?: string;
  user?: string;
  de?: string;
  ate?: string;
  page?: string;
};

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!canReadAudit(session.perfil)) redirect("/");

  const sp = (await searchParams) ?? {};
  const entidade = (sp.entidade ?? "").trim();
  const user = (sp.user ?? "").trim();
  const de = (sp.de ?? "").trim();
  const ate = (sp.ate ?? "").trim();

  const from = de ? new Date(de) : null;
  const to = ate ? new Date(ate) : null;

  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const pageSize = 50;
  const skip = (page - 1) * pageSize;

  const where = {
    ...(entidade ? { entidade: { contains: entidade, mode: "insensitive" as const } } : {}),
    ...(user ? { actor: { email: { contains: user, mode: "insensitive" as const } } } : {}),
    ...(from || to
      ? {
          timestamp: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  };

  let total = 0;
  let logs: Array<{
    id: string;
    entidade: string;
    entidadeId: string;
    acao: string;
    timestamp: Date;
    metadata: unknown | null;
    actor: { nome: string; email: string; perfil: { nome: string } };
  }> = [];
  let dbError: string | null = null;

  try {
    [total, logs] = await withPrismaRetry(() =>
      Promise.all([
        prisma.logAuditoria.count({ where }),
        prisma.logAuditoria.findMany({
          where,
          orderBy: [{ timestamp: "desc" }],
          take: pageSize,
          skip,
          include: { actor: { include: { perfil: true } } },
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
  if (entidade) queryBase.set("entidade", entidade);
  if (user) queryBase.set("user", user);
  if (de) queryBase.set("de", de);
  if (ate) queryBase.set("ate", ate);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <AppHeader />
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Auditoria</h1>
          <p className="mt-1 text-sm text-zinc-700">
            {total} registro(s) • página {page} de {totalPages}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/auditoria/export.csv?${queryBase.toString()}`}
            className="rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800"
          >
            Exportar CSV
          </a>
          <a
            href={`/api/auditoria/export.json?${queryBase.toString()}`}
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Exportar JSON
          </a>
          <Link
            href={`/auditoria/exports?${queryBase.toString()}`}
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Export assíncrono
          </Link>
          <Link
            href="/"
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Voltar
          </Link>
        </div>
      </div>

      {dbError ? (
        <ErrorAlert message={dbError} dismissHref={`/auditoria?${queryBase.toString()}`} className="mt-6" />
      ) : null}

      <form className="mt-6 grid grid-cols-1 gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-zinc-800" htmlFor="entidade">
            Entidade
          </label>
          <input
            id="entidade"
            name="entidade"
            defaultValue={entidade}
            className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
            placeholder="ex.: instituicoes"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-zinc-800" htmlFor="user">
            Usuário (email)
          </label>
          <input
            id="user"
            name="user"
            defaultValue={user}
            className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
            placeholder="ex.: admin@"
          />
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
          <button className="h-10 w-full rounded-md bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-800">
            Filtrar
          </button>
          <Link
            href="/auditoria"
            className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-center text-xs font-medium leading-10 text-zinc-800 hover:bg-zinc-50"
          >
            Limpar
          </Link>
        </div>
      </form>

      <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-4 py-3 text-xs text-zinc-700">
          Mostrando {logs.length} de {total}
        </div>
        <ul className="divide-y divide-zinc-200">
          {logs.map((l) => (
            <li key={l.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-zinc-900">
                    {l.entidade} • {l.acao}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-700">
                    entidadeId: <span className="font-mono">{l.entidadeId}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-700">
                    por {l.actor.nome} ({l.actor.email}) • perfil{" "}
                    {l.actor.perfil.nome}
                  </div>
                  {l.metadata ? (
                    <details className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 p-2 text-[11px] leading-5 text-zinc-800">
                      <summary className="cursor-pointer select-none text-xs font-medium text-zinc-800">
                        Ver metadata
                      </summary>
                      <pre className="mt-2 whitespace-pre-wrap">
                        {JSON.stringify(l.metadata, null, 2)}
                      </pre>
                    </details>
                  ) : null}
                </div>
                <div className="text-xs text-zinc-600">
                  {new Intl.DateTimeFormat("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(l.timestamp)}
                </div>
              </div>
            </li>
          ))}
          {logs.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-zinc-700">
              Nenhum log ainda.
            </li>
          ) : null}
        </ul>
        <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3 text-xs">
          <div className="text-zinc-600">
            Mostrando {logs.length} de {total}
          </div>
          <div className="flex items-center gap-2">
            <Link
              aria-disabled={!hasPrev}
              href={
                hasPrev
                  ? `/auditoria?${(() => {
                      const p = new URLSearchParams(queryBase);
                      p.set("page", String(page - 1));
                      return p.toString();
                    })()}`
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
                  ? `/auditoria?${(() => {
                      const p = new URLSearchParams(queryBase);
                      p.set("page", String(page + 1));
                      return p.toString();
                    })()}`
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

