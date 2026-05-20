import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { ErrorAlert } from "@/components/ErrorAlert";
import { getSessionFromCookies } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { prisma } from "@/server/db";
import { withPrismaRetry } from "@/server/dbRetry";
import { DocumentosLoteForm } from "./DocumentosLoteForm";

type SearchParams = { error?: string };

export default async function DocumentosLotePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!hasPermission(session.perfil, "documents:write")) redirect("/");

  const sp = (await searchParams) ?? {};
  const error = (sp.error ?? "").trim();

  const [instituicoes, tipos] = await withPrismaRetry(() =>
    Promise.all([
      prisma.instituicao.findMany({
        where: { deletedAt: null },
        orderBy: [{ nomeNormalizado: "asc" }],
        take: 200,
        select: { id: true, nome: true, cnpj: true, uf: true, municipio: true },
      }),
      prisma.tipoDocumento.findMany({
        orderBy: [{ codigo: "asc" }],
        select: { id: true, codigo: true, nome: true },
      }),
    ]),
  );

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <AppHeader />
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Documentos • Upload em lote</h1>
            <p className="mt-1 text-sm text-zinc-700">
              Envie múltiplos anexos e vincule a uma instituição (e opcionalmente a um processo).
            </p>
          </div>
          <Link
            href="/documentos"
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Voltar
          </Link>
        </div>

        {error ? (
          <ErrorAlert message={error} dismissHref="/documentos/lote" className="mt-6" />
        ) : null}

        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4">
          <DocumentosLoteForm instituicoes={instituicoes} tipos={tipos} />
        </div>
      </div>
    </div>
  );
}

