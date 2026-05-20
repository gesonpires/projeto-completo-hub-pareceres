import { redirect } from "next/navigation";

export type Perfil = "ADMIN" | "OPERADOR_DADOS" | "ANALISTA" | "LEITOR";

export type Permission =
  // Admin
  | "audit:read"
  | "users:read"
  | "users:write"
  | "profiles:read"
  | "profiles:write"
  // Cadastros (canônico)
  | "maintainers:read"
  | "maintainers:write"
  | "institutions:read"
  | "institutions:write"
  | "processes:read"
  | "processes:write"
  | "regulatory:read"
  | "regulatory:write"
  | "documents:read"
  | "documents:write"
  // Ingestão
  | "imports:read"
  | "imports:run"
  | "imports:reconcile"
  // Relatórios
  | "reports:generate";

const ALL: Permission[] = [
  "audit:read",
  "users:read",
  "users:write",
  "profiles:read",
  "profiles:write",
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
  "imports:read",
  "imports:run",
  "imports:reconcile",
  "reports:generate",
];

const READ_ALL: Permission[] = [
  "maintainers:read",
  "institutions:read",
  "processes:read",
  "regulatory:read",
  "documents:read",
  "imports:read",
];

const profilePermissions: Record<Perfil, ReadonlySet<Permission>> = {
  ADMIN: new Set(ALL),
  OPERADOR_DADOS: new Set([
    ...READ_ALL,
    "imports:run",
    "imports:reconcile",
    "maintainers:write",
    "institutions:write",
    "processes:write",
    "regulatory:write",
    "documents:write",
    // opcional: "audit:read"
  ]),
  ANALISTA: new Set([...READ_ALL, "reports:generate"]),
  LEITOR: new Set(READ_ALL),
};

export const ALL_PERMISSIONS: ReadonlyArray<Permission> = ALL;

export const ALL_PROFILES: ReadonlyArray<Perfil> = [
  "ADMIN",
  "OPERADOR_DADOS",
  "ANALISTA",
  "LEITOR",
];

export function listPermissionsForProfile(perfil: Perfil): Permission[] {
  return Array.from(profilePermissions[perfil]);
}

export function isAdmin(perfil: Perfil) {
  return perfil === "ADMIN";
}

export function hasPermission(perfil: Perfil, permission: Permission) {
  return profilePermissions[perfil].has(permission);
}

export function canWrite(perfil: Perfil) {
  return (
    hasPermission(perfil, "maintainers:write") ||
    hasPermission(perfil, "institutions:write") ||
    hasPermission(perfil, "processes:write") ||
    hasPermission(perfil, "regulatory:write") ||
    hasPermission(perfil, "documents:write")
  );
}

export function canImport(perfil: Perfil) {
  return hasPermission(perfil, "imports:run");
}

export function canReconcileImports(perfil: Perfil) {
  return hasPermission(perfil, "imports:reconcile");
}

export function canReadImports(perfil: Perfil) {
  return hasPermission(perfil, "imports:read");
}

export function canReadAudit(perfil: Perfil) {
  return hasPermission(perfil, "audit:read");
}

export function canGenerateReports(perfil: Perfil) {
  return hasPermission(perfil, "reports:generate");
}

export function requirePermissionOrRedirect(args: {
  session: { perfil: Perfil } | null;
  permission: Permission;
  redirectTo: string;
  errorMessage: string;
}) {
  if (!args.session) redirect("/login");
  if (!hasPermission(args.session.perfil, args.permission)) {
    redirect(args.redirectTo + "?error=" + encodeURIComponent(args.errorMessage));
  }
}

