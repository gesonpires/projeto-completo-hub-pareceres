import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { getSessionFromCookies } from "@/server/auth";
import { canReconcileImports } from "@/server/permissions";

function parseNumeroAno(q: string): { numero?: string; ano?: number } {
  const raw = (q ?? "").trim();
  if (!raw) return {};
  const m = raw.match(/(\d{1,10})\s*[\/\s]\s*(20\d{2})/);
  if (m?.[1] && m?.[2]) {
    const ano = Number.parseInt(m[2], 10);
    if (Number.isFinite(ano)) return { numero: m[1], ano };
  }
  const m2 = raw.match(/(\d{1,10})/);
  if (m2?.[1]) return { numero: m2[1] };
  return {};
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  if (!canReconcileImports(session.perfil)) {
    return NextResponse.json({ message: "Sem permissão." }, { status: 403 });
  }

  const instituicaoId = (req.nextUrl.searchParams.get("instituicaoId") ?? "").trim();
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();

  if (!instituicaoId) return NextResponse.json({ rows: [] });

  const { numero, ano } = parseNumeroAno(q);
  if (!numero && !ano) return NextResponse.json({ rows: [] });

  const rows = await prisma.processo.findMany({
    where: {
      deletedAt: null,
      importacaoLoteId: null,
      instituicaoId,
      ...(numero ? { numero: { contains: numero, mode: "insensitive" } } : {}),
      ...(ano ? { ano } : {}),
    },
    take: 20,
    orderBy: [{ updatedAt: "desc" }],
    select: { id: true, numero: true, ano: true, status: true },
  });

  return NextResponse.json({ rows });
}

