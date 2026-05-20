import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { getSessionFromCookies } from "@/server/auth";
import { hasPermission } from "@/server/permissions";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  // Para vincular documentos a eventos, aceitamos documents:write ou regulatory:read.
  if (
    !hasPermission(session.perfil, "documents:write") &&
    !hasPermission(session.perfil, "regulatory:read")
  ) {
    return NextResponse.json({ message: "Sem permissão." }, { status: 403 });
  }

  const { id } = await params;
  const rows = await prisma.eventoRegulatorio.findMany({
    where: { instituicaoId: id, deletedAt: null },
    orderBy: [{ dataEvento: "desc" }, { updatedAt: "desc" }],
    take: 200,
    select: { id: true, tipo: true, dataEvento: true, descricao: true },
  });
  return NextResponse.json({ rows });
}

