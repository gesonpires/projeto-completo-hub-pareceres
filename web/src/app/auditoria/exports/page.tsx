import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { ErrorAlert } from "@/components/ErrorAlert";
import { getSessionFromCookies } from "@/server/auth";
import { canReadAudit } from "@/server/permissions";
import { withPrismaRetry } from "@/server/dbRetry";
import { prisma } from "@/server/db";
import { createAuditoriaExportJobAction } from "./actions";

type SearchParams = {
  entidade?: string;
  user?: string;
  de?: string;
  ate?: string;
};

export default async function AuditoriaExportsPage({
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

  const queryBase = new URLSearchParams();
  if (entidade) queryBase.set("entidade", entidade);
  if (user) queryBase.set("user", user);
  if (de) queryBase.set("de", de);
  if (ate) queryBase.set("ate", ate);

  let rows: Array<{
    id: string;
    status: string;
    format: string;
    limit: number;
    createdAt: Date;
    startedAt: Date | null;
    finishedAt: Date | null;
    error: string | null;
  }> = [];
  let dbError: string | null = null;

  try {
    rows = await withPrismaRetry(() =>
      prisma.auditoriaExportJob.findMany({
        where: { criadoPor: session.id },
        orderBy: [{ createdAt: "desc" }],
        take: 30,
        select: {
          id: true,
          status: true,
          format: true,
          limit: true,
          createdAt: true,
          startedAt: true,
          finishedAt: true,
          error: true,
        },
      }),
    );
  } catch {
    dbError = "Banco indisponível no momento. Tente novamente em instantes.";
  }

  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(d);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <AppHeader />
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Exportações (Auditoria)</h1>
            <p className="mt-1 text-sm text-zinc-700">
              Gere exports grandes sem travar o navegador.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/auditoria?${queryBase.toString()}`}
              className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Voltar
            </Link>
          </div>
        </div>

        {dbError ? (
          <ErrorAlert message={dbError} dismissHref="/auditoria/exports" className="mt-6" />
        ) : null}

        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="text-sm font-semibold">Gerar novo export</div>
          <form action={createAuditoriaExportJobAction} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-6">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-zinc-800" htmlFor="entidade">
                Entidade
              </label>
              <input
                id="entidade"
                name="entidade"
                defaultValue={entidade}
                className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-zinc-900 outline-none focus:border-zinc-400"
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
                className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-zinc-900 outline-none focus:border-zinc-400"
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
            <div>
              <label className="text-xs font-medium text-zinc-800" htmlFor="format">
                Formato
              </label>
              <select
                id="format"
                name="format"
                defaultValue="CSV"
                className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-zinc-400"
              >
                <option value="CSV">CSV</option>
                <option value="JSON">JSON</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-800" htmlFor="limit">
                Limite
              </label>
              <input
                id="limit"
                name="limit"
                defaultValue="50000"
                className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-zinc-900 outline-none focus:border-zinc-400"
                inputMode="numeric"
              />
            </div>
            <div className="flex items-end sm:col-span-2">
              <button className="h-10 w-full rounded-md bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-800">
                Criar job
              </button>
            </div>
          </form>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 px-4 py-3 text-xs text-zinc-700">
            Últimos jobs (máx. 30)
          </div>
          <ul className="divide-y divide-zinc-200">
            {rows.map((r) => (
              <li key={r.id} className="px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-zinc-900">
                      {r.format} • {r.status} • limite {r.limit}
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-700">
                      Criado em {fmt(r.createdAt)}
                      {r.finishedAt ? ` • Finalizado em ${fmt(r.finishedAt)}` : ""}
                    </div>
                    {r.error ? (
                      <div className="mt-1 text-xs text-rose-700">{r.error}</div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/auditoria/exports/${r.id}`}
                      className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                    >
                      Abrir
                    </Link>
                    {r.status === "DONE" ? (
                      <a
                        href={`/api/auditoria/exports/${r.id}/download`}
                        className="rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800"
                      >
                        Baixar
                      </a>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
            {rows.length === 0 ? (
              <li className="px-4 py-10 text-center text-sm text-zinc-700">Nenhum job ainda.</li>
            ) : null}
          </ul>
        </div>
      </div>
    </div>
  );
}

