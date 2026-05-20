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
  if (!hasPermission(session.perfil, "processes:read")) {
    return NextResponse.json({ message: "Sem permissão." }, { status: 403 });
  }

  const { id } = await params;
  const rows = await prisma.processo.findMany({
    where: { instituicaoId: id, deletedAt: null },
    orderBy: [{ createdAt: "desc" }],
    take: 200,
    select: { id: true, numero: true, ano: true, status: true },
  });

  return NextResponse.json({ rows });
}

