import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { AppHeader } from "@/components/AppHeader";
import { withPrismaRetry } from "@/server/dbRetry";
import { ErrorAlert } from "@/components/ErrorAlert";
import { formatCnpj } from "@/server/normalize";
import { updateMantenedoraAction } from "./actions";
import { getSessionFromCookies } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { redirect } from "next/navigation";

export default async function MantenedoraDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string; ok?: string }>;
}) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!hasPermission(session.perfil, "maintainers:read")) redirect("/");
  const allowWrite = hasPermission(session.perfil, "maintainers:write");

  const { id } = await params;
  const sp = await searchParams;
  const error = sp?.error;
  const ok = sp?.ok === "1";

  let m:
    | {
        id: string;
        razaoSocial: string;
        nomeFantasia: string | null;
        cnpj: string | null;
        createdAt: Date;
        updatedAt: Date;
      }
    | null = null;
  let dbError: string | null = null;

  try {
    m = await withPrismaRetry(() =>
      prisma.mantenedora.findFirst({
        where: { id, deletedAt: null },
        select: {
          id: true,
          razaoSocial: true,
          nomeFantasia: true,
          cnpj: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    );
  } catch {
    dbError = "Banco indisponível no momento. Tente novamente em instantes.";
  }

  if (!m) {
    if (dbError) {
      return (
        <div className="flex flex-1 flex-col bg-zinc-50">
          <AppHeader />
          <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
            <ErrorAlert message={dbError} dismissHref="/mantenedoras" />
          </div>
        </div>
      );
    }
    return notFound();
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <AppHeader />
      <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              {m.razaoSocial}
            </h1>
            <p className="mt-1 text-sm text-zinc-700">
              {m.cnpj ? `CNPJ ${formatCnpj(m.cnpj)}` : "CNPJ não informado"}
            </p>
          </div>
          <Link
            href="/mantenedoras"
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Voltar
          </Link>
        </div>

        {error ? (
          <ErrorAlert
            message={error}
            dismissHref={`/mantenedoras/${m.id}`}
            className="mt-6"
          />
        ) : null}
        {ok ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            Alterações salvas.
          </div>
        ) : null}

        <form
          action={updateMantenedoraAction}
          className="mt-6 space-y-4 rounded-2xl border border-zinc-200 bg-white p-6"
        >
          <input type="hidden" name="id" value={m.id} />
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="razaoSocial">
              Razão social
            </label>
            <input
              id="razaoSocial"
              name="razaoSocial"
              defaultValue={m.razaoSocial}
              className="h-10 w-full rounded-md border border-zinc-200 px-3 text-zinc-900 outline-none focus:border-zinc-400"
              required
              readOnly={!allowWrite}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="nomeFantasia">
              Nome fantasia (opcional)
            </label>
            <input
              id="nomeFantasia"
              name="nomeFantasia"
              defaultValue={m.nomeFantasia ?? ""}
              className="h-10 w-full rounded-md border border-zinc-200 px-3 text-zinc-900 outline-none focus:border-zinc-400"
              readOnly={!allowWrite}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="cnpj">
              CNPJ (opcional)
            </label>
            <input
              id="cnpj"
              name="cnpj"
              defaultValue={m.cnpj ?? ""}
              placeholder="Somente números"
              inputMode="numeric"
              className="h-10 w-full rounded-md border border-zinc-200 px-3 text-zinc-900 outline-none focus:border-zinc-400"
              readOnly={!allowWrite}
            />
          </div>
          {allowWrite ? (
            <div className="flex items-center justify-end gap-2">
              <button className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800">
                Salvar
              </button>
            </div>
          ) : (
            <div
              className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700"
              title="Sem permissão para editar mantenedora."
            >
              Você está em modo somente leitura.
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

