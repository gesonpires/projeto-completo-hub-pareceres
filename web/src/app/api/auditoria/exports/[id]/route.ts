import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionFromCookies } from "@/server/auth";
import { canReadAudit, isAdmin } from "@/server/permissions";
import { getAuditoriaExportJob } from "@/server/services/auditoriaExportJobService";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }
  if (!canReadAudit(session.perfil)) {
    return NextResponse.json({ message: "Sem permissão." }, { status: 403 });
  }

  const { id } = await params;
  const result = await getAuditoriaExportJob(
    { userId: session.id, isAdmin: isAdmin(session.perfil) },
    id,
  );

  if (!result.ok) {
    if (result.code === "not_found") {
      return NextResponse.json({ message: "Job não encontrado." }, { status: 404 });
    }
    return NextResponse.json({ message: "Sem permissão." }, { status: 403 });
  }

  return NextResponse.json(result.job);
}

export async function HEAD(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const res = await GET(req, ctx);
  return new NextResponse(null, { status: res.status });
}
