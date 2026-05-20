import { getSessionFromCookies } from "@/server/auth";
import { canGenerateReports, canReadAudit, canReadImports, hasPermission } from "@/server/permissions";
import { AppHeaderClient } from "./AppHeaderClient";

export async function AppHeader() {
  const session = await getSessionFromCookies();

  const links: Array<{ href: string; label: string }> = [];
  if (
    session &&
    (hasPermission(session.perfil, "institutions:read") ||
      hasPermission(session.perfil, "processes:read") ||
      hasPermission(session.perfil, "regulatory:read") ||
      hasPermission(session.perfil, "documents:read"))
  ) {
    links.push({ href: "/busca", label: "Busca" });
  }
  if (session && hasPermission(session.perfil, "maintainers:read")) {
    links.push({ href: "/mantenedoras", label: "Mantenedoras" });
  }
  if (session && hasPermission(session.perfil, "institutions:read")) {
    links.push({ href: "/instituicoes", label: "Instituições" });
  }
  if (session && hasPermission(session.perfil, "processes:read")) {
    links.push({ href: "/processos", label: "Processos" });
  }
  if (session && hasPermission(session.perfil, "regulatory:read")) {
    links.push({ href: "/atos", label: "Atos" });
    links.push({ href: "/eventos", label: "Eventos" });
  }
  if (session && hasPermission(session.perfil, "documents:read")) {
    links.push({ href: "/documentos", label: "Documentos" });
  }
  if (session && canReadImports(session.perfil)) {
    links.push({ href: "/importacoes", label: "Importações" });
  }
  if (session && canGenerateReports(session.perfil)) {
    links.push({ href: "/relatorios", label: "Relatórios" });
  }
  if (session && canReadAudit(session.perfil)) {
    links.push({ href: "/auditoria", label: "Auditoria" });
  }
  if (session && (hasPermission(session.perfil, "users:read") || hasPermission(session.perfil, "profiles:read"))) {
    links.push({ href: "/admin", label: "Admin" });
  }

  return (
    <AppHeaderClient
      homeLabel="Hub de Pareceres"
      subtitle="CEE‑SC • MVP"
      links={links}
      userName={session?.nome}
      userPerfil={session?.perfil}
    />
  );
}