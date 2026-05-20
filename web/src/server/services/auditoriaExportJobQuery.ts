import type { Prisma } from "@/generated/prisma/client";
import type { AuditoriaExportJobFiltros } from "./auditoriaExportJobTypes";

export function parseAuditoriaExportFiltros(params: {
  entidade?: string;
  user?: string;
  de?: string;
  ate?: string;
}): AuditoriaExportJobFiltros {
  return {
    entidade: (params.entidade ?? "").trim() || null,
    user: (params.user ?? "").trim() || null,
    de: (params.de ?? "").trim() || null,
    ate: (params.ate ?? "").trim() || null,
  };
}

export function parseAuditoriaExportFormat(raw: string | undefined): "CSV" | "JSON" {
  return (raw ?? "CSV").trim().toUpperCase() === "JSON" ? "JSON" : "CSV";
}

export function clampAuditoriaExportLimit(
  limitRaw: string | undefined,
  maxCap: number,
  defaultValue = 50000,
): number {
  const parsed = Number.parseInt(limitRaw || String(defaultValue), 10) || defaultValue;
  return Math.max(1, Math.min(maxCap, parsed));
}

export function buildLogAuditoriaWhere(
  filtros: AuditoriaExportJobFiltros,
): Prisma.LogAuditoriaWhereInput {
  const from = filtros.de ? new Date(filtros.de) : null;
  const to = filtros.ate ? new Date(filtros.ate) : null;

  return {
    ...(filtros.entidade
      ? { entidade: { contains: filtros.entidade, mode: "insensitive" as const } }
      : {}),
    ...(filtros.user
      ? { actor: { email: { contains: filtros.user, mode: "insensitive" as const } } }
      : {}),
    ...(from || to
      ? {
          timestamp: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  };
}
