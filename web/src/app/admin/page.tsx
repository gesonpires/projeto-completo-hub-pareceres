import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getSessionFromCookies } from "@/server/auth";
import { hasPermission } from "@/server/permissions";

function AdminCard({
  href,
  title,
  desc,
  enabled,
}: {
  href: string;
  title: string;
  desc: string;
  enabled: boolean;
}) {
  if (!enabled) return null;
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-zinc-200 bg-white p-5 hover:bg-zinc-50"
    >
      <div className="text-sm font-semibold text-zinc-900">{title}</div>
      <div className="mt-1 text-sm text-zinc-700">{desc}</div>
    </Link>
  );
}

export default async function AdminHomePage() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  const canUsers = hasPermission(session.perfil, "users:read");
  const canProfiles = hasPermission(session.perfil, "profiles:read");
  if (!canUsers && !canProfiles) redirect("/");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Admin</h1>
            <p className="mt-1 text-sm text-zinc-700">Gestão de usuários e perfis.</p>
          </div>
          <Link
            href="/"
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Voltar
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AdminCard
            href="/admin/usuarios"
            title="Usuários"
            desc="Criar, ativar/desativar, trocar perfil e resetar senha."
            enabled={canUsers}
          />
          <AdminCard
            href="/admin/perfis"
            title="Perfis"
            desc="Consultar perfis e editar descrições."
            enabled={canProfiles}
          />
        </div>
      </main>
    </div>
  );
}

