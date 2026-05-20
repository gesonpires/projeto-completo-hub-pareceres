import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { ErrorAlert } from "@/components/ErrorAlert";
import { SuccessAlert } from "@/components/SuccessAlert";
import { prisma } from "@/server/db";
import { withPrismaRetry } from "@/server/dbRetry";
import { getSessionFromCookies } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import {
  createUserAction,
  setUserActiveAction,
  setUserPasswordAction,
  setUserPerfilAction,
} from "./actions";

type SearchParams = {
  q?: string;
  perfilId?: string;
  ativo?: string;
  page?: string;
  error?: string;
  ok?: string;
};

export default async function AdminUsuariosPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!hasPermission(session.perfil, "users:read")) redirect("/");

  const sp = (await searchParams) ?? {};
  const q = (sp.q ?? "").trim();
  const perfilId = (sp.perfilId ?? "").trim();
  const ativo = (sp.ativo ?? "").trim();
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const error = (sp.error ?? "").trim();
  const ok = (sp.ok ?? "").trim();

  const allowWrite = hasPermission(session.perfil, "users:write");

  const where = {
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" as const } },
            { nome: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(perfilId ? { perfilId } : {}),
    ...(ativo === "1" ? { ativo: true } : ativo === "0" ? { ativo: false } : {}),
  };

  const pageSize = 50;
  const skip = (page - 1) * pageSize;

  let total = 0;
  let usuarios: Array<{
    id: string;
    nome: string;
    email: string;
    ativo: boolean;
    createdAt: Date;
    perfil: { id: string; nome: string };
  }> = [];
  let perfis: Array<{ id: string; nome: string }> = [];
  let dbError: string | null = null;

  try {
    [total, usuarios, perfis] = await withPrismaRetry(() =>
      Promise.all([
        prisma.usuario.count({ where }),
        prisma.usuario.findMany({
          where,
          orderBy: [{ createdAt: "desc" }],
          take: pageSize,
          skip,
          select: {
            id: true,
            nome: true,
            email: true,
            ativo: true,
            createdAt: true,
            perfil: { select: { id: true, nome: true } },
          },
        }),
        prisma.perfil.findMany({ orderBy: [{ nome: "asc" }], select: { id: true, nome: true } }),
      ]),
    );
  } catch {
    dbError = "Banco indisponível no momento. Tente novamente em instantes.";
  }

  const queryBase = new URLSearchParams();
  if (q) queryBase.set("q", q);
  if (perfilId) queryBase.set("perfilId", perfilId);
  if (ativo) queryBase.set("ativo", ativo);
  // page é controlado pelos links

  const dismissHref = `/admin/usuarios?${queryBase.toString()}`;

  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(d);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <AppHeader />
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Admin • Usuários</h1>
            <p className="mt-1 text-sm text-zinc-700">Gestão de acesso e perfis.</p>
          </div>
          <Link
            href="/"
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Voltar
          </Link>
        </div>

        {error ? <ErrorAlert message={error} dismissHref={dismissHref} className="mt-6" /> : null}
        {ok ? <SuccessAlert message={ok} dismissHref={dismissHref} className="mt-6" /> : null}
        {dbError ? <ErrorAlert message={dbError} dismissHref={dismissHref} className="mt-6" /> : null}

        <form className="mt-6 grid grid-cols-1 gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-zinc-800" htmlFor="q">
              Busca (nome/email)
            </label>
            <input
              id="q"
              name="q"
              defaultValue={q}
              className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-zinc-900 outline-none focus:border-zinc-400"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-800" htmlFor="perfilId">
              Perfil
            </label>
            <select
              id="perfilId"
              name="perfilId"
              defaultValue={perfilId}
              className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-zinc-400"
            >
              <option value="">(todos)</option>
              {perfis.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-800" htmlFor="ativo">
              Ativo
            </label>
            <select
              id="ativo"
              name="ativo"
              defaultValue={ativo}
              className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-zinc-400"
            >
              <option value="">(todos)</option>
              <option value="1">Ativos</option>
              <option value="0">Inativos</option>
            </select>
          </div>
          <div className="flex items-end gap-2 sm:col-span-2">
            <button className="h-10 w-full rounded-md bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-800">
              Filtrar
            </button>
            <Link
              href="/admin/usuarios"
              className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-center text-xs font-medium leading-10 text-zinc-800 hover:bg-zinc-50"
            >
              Limpar
            </Link>
          </div>
        </form>

        <div
          className={`mt-6 rounded-2xl border p-4 ${
            allowWrite ? "border-zinc-200 bg-white" : "border-zinc-200 bg-zinc-50"
          }`}
          title={!allowWrite ? "Sem permissão para criar usuário." : undefined}
        >
          <div className="text-sm font-semibold">Criar usuário</div>
          <form
            action={allowWrite ? createUserAction : undefined}
            className={`mt-3 grid grid-cols-1 gap-3 sm:grid-cols-6 ${
              !allowWrite ? "pointer-events-none opacity-60" : ""
            }`}
          >
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-zinc-800" htmlFor="nome">
                Nome
              </label>
              <input
                id="nome"
                name="nome"
                className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-zinc-900 outline-none focus:border-zinc-400"
                required
                readOnly={!allowWrite}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-zinc-800" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-zinc-900 outline-none focus:border-zinc-400"
                required
                readOnly={!allowWrite}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-800" htmlFor="perfilIdNew">
                Perfil
              </label>
              <select
                id="perfilIdNew"
                name="perfilId"
                className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                required
                defaultValue={perfis[0]?.id ?? ""}
                disabled={!allowWrite}
              >
                {perfis.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-800" htmlFor="password">
                Senha inicial
              </label>
              <input
                id="password"
                name="password"
                type="password"
                className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-zinc-900 outline-none focus:border-zinc-400"
                required
                minLength={6}
                readOnly={!allowWrite}
              />
            </div>
            <div className="flex items-end sm:col-span-6">
              <button
                className={`h-10 w-full rounded-md px-3 text-xs font-medium ${
                  allowWrite
                    ? "bg-zinc-900 text-white hover:bg-zinc-800"
                    : "bg-zinc-200 text-zinc-500"
                }`}
                aria-disabled={!allowWrite}
                disabled={!allowWrite}
                type="submit"
              >
                Criar
              </button>
            </div>
          </form>
          {!allowWrite ? (
            <div className="mt-3 text-[11px] text-zinc-700">
              Você pode visualizar usuários, mas não tem permissão para criar/alterar.
            </div>
          ) : null}
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 px-4 py-3 text-xs text-zinc-700">
            {total} usuário(s) • página {page} de {totalPages}
          </div>
          <ul className="divide-y divide-zinc-200">
            {usuarios.map((u) => (
              <li key={u.id} className="px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-zinc-900">
                      {u.nome}{" "}
                      {!u.ativo ? <span className="text-rose-700">(inativo)</span> : null}
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-700">
                      {u.email} • perfil <span className="font-medium">{u.perfil.nome}</span> • criado{" "}
                      {fmt(u.createdAt)}
                    </div>
                  </div>

                  {allowWrite ? (
                    <div className="flex flex-col gap-2">
                      {u.id === session.id ? (
                        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] text-zinc-700">
                          Este é o seu usuário atual. Ações sensíveis (desativar/trocar perfil/resetar senha) ficam bloqueadas aqui.
                        </div>
                      ) : (
                        <>
                          <form action={setUserActiveAction} className="flex items-center gap-2">
                            <input type="hidden" name="userId" value={u.id} />
                            <input type="hidden" name="ativo" value={u.ativo ? "0" : "1"} />
                            {!u.ativo ? null : (
                              <label className="inline-flex items-center gap-1 text-[11px] text-zinc-700">
                                <input
                                  name="confirm"
                                  type="checkbox"
                                  value="1"
                                  className="h-3 w-3 rounded border-zinc-300"
                                />
                                Confirmar
                              </label>
                            )}
                            <button className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50">
                              {u.ativo ? "Desativar" : "Ativar"}
                            </button>
                          </form>

                          <form action={setUserPerfilAction} className="flex items-center gap-2">
                            <input type="hidden" name="userId" value={u.id} />
                            <label className="inline-flex items-center gap-1 text-[11px] text-zinc-700">
                              <input
                                name="confirm"
                                type="checkbox"
                                value="1"
                                className="h-3 w-3 rounded border-zinc-300"
                              />
                              Confirmar
                            </label>
                            <select
                              name="perfilId"
                              defaultValue={u.perfil.id}
                              className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                            >
                              {perfis.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.nome}
                                </option>
                              ))}
                            </select>
                            <button className="h-9 rounded-md bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-800">
                              Salvar
                            </button>
                          </form>

                          <form action={setUserPasswordAction} className="flex items-center gap-2">
                            <input type="hidden" name="userId" value={u.id} />
                            <label className="inline-flex items-center gap-1 text-[11px] text-zinc-700">
                              <input
                                name="confirm"
                                type="checkbox"
                                value="1"
                                className="h-3 w-3 rounded border-zinc-300"
                              />
                              Confirmar
                            </label>
                            <input
                              name="password"
                              type="password"
                              placeholder="Nova senha (min 6)"
                              minLength={6}
                              className="h-9 w-44 rounded-md border border-zinc-200 px-2 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                              required
                            />
                            <button className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-800 hover:bg-zinc-50">
                              Reset senha
                            </button>
                          </form>
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
            {usuarios.length === 0 ? (
              <li className="px-4 py-10 text-center text-sm text-zinc-700">Nenhum usuário.</li>
            ) : null}
          </ul>
          <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3 text-xs">
            <div className="text-zinc-600">
              Mostrando {usuarios.length} de {total}
            </div>
            <div className="flex items-center gap-2">
              <Link
                aria-disabled={!hasPrev}
                href={
                  hasPrev
                    ? `/admin/usuarios?${(() => {
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
                    ? `/admin/usuarios?${(() => {
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

