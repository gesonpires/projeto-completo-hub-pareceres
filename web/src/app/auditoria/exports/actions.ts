"use server";

import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/server/auth";
import { canReadAudit } from "@/server/permissions";
import {
  clampAuditoriaExportLimit,
  createAuditoriaExportJob,
  parseAuditoriaExportFiltros,
  parseAuditoriaExportFormat,
} from "@/server/services/auditoriaExportJobService";

export async function createAuditoriaExportJobAction(formData: FormData) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!canReadAudit(session.perfil)) redirect("/");

  const filtros = parseAuditoriaExportFiltros({
    entidade: String(formData.get("entidade") ?? ""),
    user: String(formData.get("user") ?? ""),
    de: String(formData.get("de") ?? ""),
    ate: String(formData.get("ate") ?? ""),
  });
  const format = parseAuditoriaExportFormat(String(formData.get("format") ?? "CSV"));
  const limit = clampAuditoriaExportLimit(
    String(formData.get("limit") ?? ""),
    200000,
    50000,
  );

  const result = await createAuditoriaExportJob(
    { userId: session.id },
    { format, filtros, limit },
  );

  if (!result.ok) {
    redirect("/auditoria/exports?error=" + encodeURIComponent(result.error));
  }

  redirect(`/auditoria/exports/${result.id}`);
}
