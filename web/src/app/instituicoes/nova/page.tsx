import Link from "next/link";
import { prisma } from "@/server/db";
import { withPrismaRetry } from "@/server/dbRetry";
import { createInstituicaoAction } from "./actions";
import { ErrorAlert } from "@/components/ErrorAlert";
import { CnpjInput } from "@/components/CnpjInput";
import { UfInput } from "@/components/UfInput";
import { getSessionFromCookies } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { redirect } from "next/navigation";

export default async function NovaInstituicaoPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!hasPermission(session.perfil, "institutions:write")) redirect("/instituicoes");
  const allowCreateMantenedora = hasPermission(session.perfil, "maintainers:write");

  const error = (await searchParams)?.error;
  const mantenedoras = await withPrismaRetry(() =>
    prisma.mantenedora.findMany({
      where: { deletedAt: null },
      orderBy: [{ nomeNormalizado: "asc" }],
      take: 200,
      select: { id: true, razaoSocial: true, cnpj: true },
    }),
  );
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            Nova instituição
          </h1>
          <p className="mt-1 text-sm text-zinc-700">Cadastro mínimo (MVP).</p>
        </div>
        <Link
          href="/instituicoes"
          className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
        >
          Voltar
        </Link>
      </div>

      {error ? (
        <ErrorAlert message={error} dismissHref="/instituicoes/nova" className="mt-6" />
      ) : null}

      <form
        action={createInstituicaoAction}
        className="mt-6 space-y-4 rounded-2xl border border-zinc-200 bg-white p-6"
      >
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="nome">
            Nome
          </label>
          <input
            id="nome"
            name="nome"
            className="h-10 w-full rounded-md border border-zinc-200 px-3 text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2 space-y-1">
            <label className="text-sm font-medium" htmlFor="cnpj">
              CNPJ (opcional)
            </label>
            <CnpjInput
              id="cnpj"
              name="cnpj"
              className="h-10 w-full rounded-md border border-zinc-200 px-3 text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="uf">
              UF (opcional)
            </label>
            <UfInput
              id="uf"
              name="uf"
              className="h-10 w-full rounded-md border border-zinc-200 px-3 text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
              placeholder="SC"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="municipio">
            Município (opcional)
          </label>
          <input
            id="municipio"
            name="municipio"
            className="h-10 w-full rounded-md border border-zinc-200 px-3 text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="mantenedoraId">
            Mantenedora (opcional)
          </label>
          <select
            id="mantenedoraId"
            name="mantenedoraId"
            className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
            defaultValue=""
          >
            <option value="">(sem mantenedora)</option>
            {mantenedoras.map((m) => (
              <option key={m.id} value={m.id}>
                {m.razaoSocial}
                {m.cnpj ? ` — ${m.cnpj}` : ""}
              </option>
            ))}
          </select>
          <div className="text-[11px] text-zinc-600">
            Dica: se a mantenedora não existir ainda, cadastre em{" "}
            {allowCreateMantenedora ? (
              <Link className="underline underline-offset-2" href="/mantenedoras/nova">
                Mantenedoras
              </Link>
            ) : (
              <span className="font-medium">Mantenedoras</span>
            )}
            .
          </div>
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
  );
}

