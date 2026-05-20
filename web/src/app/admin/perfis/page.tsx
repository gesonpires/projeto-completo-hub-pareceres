import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { ErrorAlert } from "@/components/ErrorAlert";
import { SuccessAlert } from "@/components/SuccessAlert";
import { prisma } from "@/server/db";
import { withPrismaRetry } from "@/server/dbRetry";
import { getSessionFromCookies } from "@/server/auth";
import {
  ALL_PERMISSIONS,
  ALL_PROFILES,
  hasPermission,
  listPermissionsForProfile,
  type Permission,
} from "@/server/permissions";
import { updatePerfilDescricaoAction } from "./actions";

type SearchParams = { error?: string; ok?: string };

export default async function AdminPerfisPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!hasPermission(session.perfil, "profiles:read")) redirect("/");

  const allowWrite = hasPermission(session.perfil, "profiles:write");

  const sp = (await searchParams) ?? {};
  const error = (sp.error ?? "").trim();
  const ok = (sp.ok ?? "").trim();

  let perfis: Array<{ id: string; nome: string; descricao: string | null }> = [];
  let dbError: string | null = null;

  try {
    perfis = await withPrismaRetry(() =>
      prisma.perfil.findMany({
        orderBy: [{ nome: "asc" }],
        select: { id: true, nome: true, descricao: true },
      }),
    );
  } catch {
    dbError = "Banco indisponível no momento. Tente novamente em instantes.";
  }

  const permsByProfile = new Map(
    ALL_PROFILES.map((p) => [p, new Set(listPermissionsForProfile(p))] as const),
  );

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <AppHeader />
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Admin • Perfis</h1>
            <p className="mt-1 text-sm text-zinc-700">Perfis de acesso (permissões estão no código).</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Voltar
            </Link>
          </div>
        </div>

        {error ? <ErrorAlert message={error} dismissHref="/admin/perfis" className="mt-6" /> : null}
        {ok ? <SuccessAlert message={ok} dismissHref="/admin/perfis" className="mt-6" /> : null}
        {dbError ? <ErrorAlert message={dbError} dismissHref="/admin/perfis" className="mt-6" /> : null}

        <details className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-zinc-900">
            Matriz de permissões (somente leitura)
          </summary>
          <div className="border-t border-zinc-200 p-4">
            <div className="overflow-auto">
              <div className="min-w-[760px]">
                <div className="grid grid-cols-5 gap-2 rounded-lg bg-zinc-50 p-2 text-xs font-semibold text-zinc-700">
                  <div className="col-span-1">Permissão</div>
                  <div>ADMIN</div>
                  <div>OPERADOR</div>
                  <div>ANALISTA</div>
                  <div>LEITOR</div>
                </div>
                <div className="mt-2 space-y-4">
                  {(
                    [
                      {
                        title: "Admin",
                        perms: ["audit:read", "users:read", "users:write", "profiles:read", "profiles:write"],
                      },
                      {
                        title: "Cadastros",
                        perms: [
                          "maintainers:read",
                          "maintainers:write",
                          "institutions:read",
                          "institutions:write",
                          "processes:read",
                          "processes:write",
                          "regulatory:read",
                          "regulatory:write",
                          "documents:read",
                          "documents:write",
                        ],
                      },
                      {
                        title: "Ingestão",
                        perms: ["imports:read", "imports:run", "imports:reconcile"],
                      },
                      {
                        title: "Relatórios",
                        perms: ["reports:generate"],
                      },
                    ] as const
                  ).map((group) => {
                    const cell = (profile: (typeof ALL_PROFILES)[number], perm: Permission) => {
                      const ok = permsByProfile.get(profile)?.has(perm) ?? false;
                      return (
                        <div
                          className={[
                            "rounded-md border px-2 py-1 text-center text-xs font-medium",
                            ok
                              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                              : "border-zinc-200 bg-white text-zinc-500",
                          ].join(" ")}
                        >
                          {ok ? "SIM" : "—"}
                        </div>
                      );
                    };

                    const visiblePerms = group.perms.filter((p) =>
                      (ALL_PERMISSIONS as readonly Permission[]).includes(p as Permission),
                    ) as Permission[];

                    return (
                      <div key={group.title}>
                        <div className="text-xs font-semibold text-zinc-700">{group.title}</div>
                        <div className="mt-2 space-y-1">
                          {visiblePerms.map((perm) => (
                            <div key={perm} className="grid grid-cols-5 gap-2">
                              <div className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-800">
                                {perm}
                              </div>
                              {cell("ADMIN", perm)}
                              {cell("OPERADOR_DADOS", perm)}
                              {cell("ANALISTA", perm)}
                              {cell("LEITOR", perm)}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="mt-3 text-[11px] text-zinc-600">
              Observação: as permissões efetivas são definidas em <span className="font-mono">server/permissions.ts</span>.
            </div>
          </div>
        </details>

        <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 px-4 py-3 text-xs text-zinc-700">
            {perfis.length} perfil(is)
          </div>
          <ul className="divide-y divide-zinc-200">
            {perfis.map((p) => (
              <li key={p.id} className="px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-zinc-900">{p.nome}</div>
                    <div className="mt-1 text-sm text-zinc-700">
                      {p.descricao ? p.descricao : <span className="text-zinc-500">(sem descrição)</span>}
                    </div>
                  </div>
                  {allowWrite ? (
                    <form action={updatePerfilDescricaoAction} className="flex items-end gap-2">
                      <input type="hidden" name="id" value={p.id} />
                      <div>
                        <label className="text-xs font-medium text-zinc-800" htmlFor={`desc-${p.id}`}>
                          Descrição
                        </label>
                        <input
                          id={`desc-${p.id}`}
                          name="descricao"
                          defaultValue={p.descricao ?? ""}
                          className="mt-1 h-9 w-72 rounded-md border border-zinc-200 px-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                          placeholder="Ex.: acesso total / leitura / operação"
                        />
                      </div>
                      <button className="h-9 rounded-md bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-800">
                        Salvar
                      </button>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
            {perfis.length === 0 ? (
              <li className="px-4 py-10 text-center text-sm text-zinc-700">Nenhum perfil.</li>
            ) : null}
          </ul>
        </div>
      </div>
    </div>
  );
}

