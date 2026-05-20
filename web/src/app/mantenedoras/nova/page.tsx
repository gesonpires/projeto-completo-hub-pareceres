import Link from "next/link";
import { createMantenedoraAction } from "./actions";
import { ErrorAlert } from "@/components/ErrorAlert";
import { AppHeader } from "@/components/AppHeader";
import { getSessionFromCookies } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { redirect } from "next/navigation";

export default async function NovaMantenedoraPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!hasPermission(session.perfil, "maintainers:write")) redirect("/mantenedoras");

  const error = (await searchParams)?.error;
  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <AppHeader />
      <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              Nova mantenedora
            </h1>
            <p className="mt-1 text-sm text-zinc-700">Cadastro mínimo (MVP).</p>
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
            dismissHref="/mantenedoras/nova"
            className="mt-6"
          />
        ) : null}

        <form
          action={createMantenedoraAction}
          className="mt-6 space-y-4 rounded-2xl border border-zinc-200 bg-white p-6"
        >
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="razaoSocial">
              Razão social
            </label>
            <input
              id="razaoSocial"
              name="razaoSocial"
              className="h-10 w-full rounded-md border border-zinc-200 px-3 text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="nomeFantasia">
              Nome fantasia (opcional)
            </label>
            <input
              id="nomeFantasia"
              name="nomeFantasia"
              className="h-10 w-full rounded-md border border-zinc-200 px-3 text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="cnpj">
              CNPJ (opcional)
            </label>
            <input
              id="cnpj"
              name="cnpj"
              placeholder="Somente números"
              inputMode="numeric"
              className="h-10 w-full rounded-md border border-zinc-200 px-3 text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="submit"
              className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Criar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

