import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionFromCookies } from "@/server/auth";
import { canReadAudit, isAdmin } from "@/server/permissions";
import {
  clampAuditoriaExportLimit,
  createAuditoriaExportJob,
  parseAuditoriaExportFiltros,
  parseAuditoriaExportFormat,
} from "@/server/services/auditoriaExportJobService";

export async function POST(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }
  if (!canReadAudit(session.perfil)) {
    return NextResponse.json({ message: "Sem permissão." }, { status: 403 });
  }

  const url = new URL(req.url);
  const filtros = parseAuditoriaExportFiltros({
    entidade: url.searchParams.get("entidade") ?? "",
    user: url.searchParams.get("user") ?? "",
    de: url.searchParams.get("de") ?? "",
    ate: url.searchParams.get("ate") ?? "",
  });
  const format = parseAuditoriaExportFormat(url.searchParams.get("format") ?? "CSV");
  const max = isAdmin(session.perfil) ? 200000 : 50000;
  const limit = clampAuditoriaExportLimit(url.searchParams.get("limit") ?? "", max, 50000);

  const result = await createAuditoriaExportJob(
    { userId: session.id },
    { format, filtros, limit },
  );

  if (!result.ok) {
    return NextResponse.json({ message: result.error }, { status: 400 });
  }

  return NextResponse.json({ id: result.id, status: result.status });
}
