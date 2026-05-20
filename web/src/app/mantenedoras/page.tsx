import Link from "next/link";
import { prisma } from "@/server/db";
import { getSessionFromCookies } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { AppHeader } from "@/components/AppHeader";
import { withPrismaRetry } from "@/server/dbRetry";
import { ErrorAlert } from "@/components/ErrorAlert";
import { digitsOnly, formatCnpj, normalizeName } from "@/server/normalize";
import { redirect } from "next/navigation";

type SearchParams = {
  q?: string;
  cnpj?: string;
  page?: string;
};

export default async function MantenedorasPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!hasPermission(session.perfil, "maintainers:read")) redirect("/");
  const canCreate = hasPermission(session.perfil, "maintainers:write");

  const sp = (await searchParams) ?? {};
  const qRaw = (sp.q ?? "").trim();
  const cnpjRaw = (sp.cnpj ?? "").trim();

  const qDigits = qRaw ? digitsOnly(qRaw) : "";
  const cnpjDigits = cnpjRaw ? digitsOnly(cnpjRaw) : "";
  const cnpj = cnpjDigits || (qDigits.length === 14 ? qDigits : "");
  const q = cnpj ? "" : qRaw;
  const qNorm = q ? normalizeName(q) : "";
  const qTerms = qNorm ? qNorm.split(" ").filter(Boolean).slice(0, 8) : [];

  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const pageSize = 25;
  const skip = (page - 1) * pageSize;

  const where = {
    deletedAt: null,
    ...(cnpj
      ? { cnpj }
      : q
        ? { AND: qTerms.map((t) => ({ nomeNormalizado: { contains: t } })) }
        : {}),
  };

  let total = 0;
  let rows: Array<{ id: string; razaoSocial: string; cnpj: string | null }> = [];
  let dbError: string | null = null;

  try {
    [total, rows] = await withPrismaRetry(() =>
      Promise.all([
        prisma.mantenedora.count({ where }),
        prisma.mantenedora.findMany({
          where,
          orderBy: [{ nomeNormalizado: "asc" }],
          take: pageSize,
          skip,
          select: { id: true, razaoSocial: true, cnpj: true },
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

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <AppHeader />
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Mantenedoras</h1>
            <p className="mt-1 text-sm text-zinc-700">
              {total} resultado(s) • página {page} de {totalPages}
            </p>
          </div>
          <Link
            href={canCreate ? "/mantenedoras/nova" : "#"}
            aria-disabled={!canCreate}
            title={!canCreate ? "Sem permissão para criar mantenedora." : undefined}
            className={`rounded-md px-3 py-2 text-xs font-medium ${
              canCreate
                ? "bg-zinc-900 text-white hover:bg-zinc-800"
                : "pointer-events-none bg-zinc-200 text-zinc-500"
            }`}
          >
            Nova mantenedora
          </Link>
        </div>

        {dbError ? (
          <ErrorAlert
            message={dbError}
            dismissHref={`/mantenedoras?${queryBase.toString()}`}
            className="mt-6"
          />
        ) : null}

        <form className="mt-6 grid grid-cols-1 gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:grid-cols-5">
          <div className="sm:col-span-3">
            <label className="text-xs font-medium text-zinc-800" htmlFor="q">
              Texto (razão social)
            </label>
            <input
              id="q"
              name="q"
              defaultValue={qRaw}
              className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
              placeholder="Ex.: Fundação / Associação / Ltda"
            />
            {qDigits.length === 14 && !cnpjRaw ? (
              <div className="mt-1 text-[11px] text-zinc-600">
                Detectado CNPJ (14 dígitos). Buscando por CNPJ exato.
              </div>
            ) : null}
          </div>
          <div className="sm:col-span-2">
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
          <div className="flex items-end gap-2 sm:col-span-5">
            <button className="h-10 w-full rounded-md bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-800">
              Buscar
            </button>
            <Link
              href="/mantenedoras"
              className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-center text-xs font-medium leading-10 text-zinc-800 hover:bg-zinc-50"
            >
              Limpar
            </Link>
          </div>
        </form>

        <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 px-4 py-3 text-xs text-zinc-700">
            Mostrando {rows.length} de {total}
          </div>
          <ul className="divide-y divide-zinc-200">
            {rows.map((m) => (
              <li key={m.id} className="px-4 py-3 hover:bg-zinc-50">
                <Link href={`/mantenedoras/${m.id}`} className="block">
                  <div className="text-sm font-medium text-zinc-900">
                    {m.razaoSocial}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-700">
                    {m.cnpj ? `CNPJ ${formatCnpj(m.cnpj)}` : "CNPJ não informado"}
                  </div>
                </Link>
              </li>
            ))}
            {rows.length === 0 ? (
              <li className="px-4 py-10 text-center text-sm text-zinc-700">
                Nenhum resultado. Ajuste os filtros.
              </li>
            ) : null}
          </ul>
          <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3 text-xs">
            <div className="text-zinc-600">
              Mostrando {rows.length} de {total}
            </div>
            <div className="flex items-center gap-2">
              <Link
                aria-disabled={!hasPrev}
                href={
                  hasPrev
                    ? `/mantenedoras?${(() => {
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
                    ? `/mantenedoras?${(() => {
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

