import Link from "next/link";
import { prisma } from "@/server/db";
import { AppHeader } from "@/components/AppHeader";
import { withPrismaRetry } from "@/server/dbRetry";
import { ErrorAlert } from "@/components/ErrorAlert";
import { getSessionFromCookies } from "@/server/auth";
import { canImport, canReadImports } from "@/server/permissions";
import { redirect } from "next/navigation";

type SearchParams = {
  page?: string;
};

export default async function ImportacoesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!canReadImports(session.perfil)) redirect("/");

  const sp = (await searchParams) ?? {};
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const pageSize = 25;
  const skip = (page - 1) * pageSize;

  let total = 0;
  let lotes: Array<{
    id: string;
    arquivoNome: string;
    status: string;
    contagemLidas: number;
    contagemImportadas: number;
    contagemRejeitadas: number;
    fonteDados: { nome: string };
    criador: { perfil: { nome: string } };
    createdAt: Date;
  }> = [];
  let dbError: string | null = null;

  try {
    [total, lotes] = await withPrismaRetry(() =>
      Promise.all([
        prisma.importacaoLote.count(),
        prisma.importacaoLote.findMany({
          orderBy: [{ createdAt: "desc" }],
          take: pageSize,
          skip,
          include: { fonteDados: true, criador: { include: { perfil: true } } },
        }),
      ]),
    );
  } catch {
    dbError = "Banco indisponível no momento. Tente novamente em instantes.";
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <AppHeader />
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Importações</h1>
          <p className="mt-1 text-sm text-zinc-700">
            Ingestão mínima viável (CSV) com preview e validação.
          </p>
        </div>
        <Link
          href="/importacoes/nova"
          className={`rounded-md px-3 py-2 text-xs font-medium ${canImport(session.perfil) ? "bg-zinc-900 text-white hover:bg-zinc-800" : "pointer-events-none bg-zinc-200 text-zinc-500"}`}
        >
          Nova importação
        </Link>
      </div>

      {dbError ? (
        <ErrorAlert message={dbError} dismissHref="/importacoes" className="mt-6" />
      ) : null}

      <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-4 py-3 text-xs text-zinc-700">
          {total} lote(s) • página {page} de {totalPages}
        </div>
        <ul className="divide-y divide-zinc-200">
          {lotes.map((l) => (
            <li key={l.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-zinc-900">
                    {l.arquivoNome}{" "}
                    <span className="text-xs font-normal text-zinc-600">
                      • {l.fonteDados.nome}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-700">
                    Status: <span className="font-medium">{l.status}</span>{" "}
                    • Lidas {l.contagemLidas} • Importadas {l.contagemImportadas} •
                    Rejeitadas {l.contagemRejeitadas}
                  </div>
                </div>
                <Link
                  href={`/importacoes/${l.id}`}
                  className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                >
                  Ver
                </Link>
              </div>
            </li>
          ))}
          {lotes.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-zinc-700">
              Nenhuma importação ainda.
            </li>
          ) : null}
        </ul>
        <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3 text-xs">
          <div className="text-zinc-600">
            Mostrando {lotes.length} de {total}
          </div>
          <div className="flex items-center gap-2">
            <Link
              aria-disabled={!hasPrev}
              href={hasPrev ? `/importacoes?page=${page - 1}` : "#"}
              className={`rounded-md border border-zinc-200 bg-white px-3 py-2 font-medium text-zinc-800 hover:bg-zinc-50 ${!hasPrev ? "pointer-events-none opacity-50" : ""}`}
            >
              Anterior
            </Link>
            <Link
              aria-disabled={!hasNext}
              href={hasNext ? `/importacoes?page=${page + 1}` : "#"}
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

