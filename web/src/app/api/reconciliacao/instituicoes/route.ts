import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { getSessionFromCookies } from "@/server/auth";
import { canReconcileImports } from "@/server/permissions";
import { digitsOnly, normalizeName } from "@/server/normalize";

export async function GET(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  if (!canReconcileImports(session.perfil)) {
    return NextResponse.json({ message: "Sem permissão." }, { status: 403 });
  }

  const qRaw = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const qDigits = qRaw ? digitsOnly(qRaw) : "";
  const cnpj = qDigits.length === 14 ? qDigits : "";
  const q = cnpj ? "" : qRaw;
  const qNorm = q ? normalizeName(q) : "";
  const terms = qNorm ? qNorm.split(" ").filter(Boolean).slice(0, 8) : [];

  if (!cnpj && terms.length === 0) {
    return NextResponse.json({ rows: [] });
  }

  const rows = await prisma.instituicao.findMany({
    where: {
      deletedAt: null,
      importacaoLoteId: null,
      ...(cnpj
        ? { cnpj }
        : {
            AND: terms.map((t) => ({ nomeNormalizado: { contains: t } })),
          }),
    },
    take: 20,
    orderBy: [{ updatedAt: "desc" }],
    select: { id: true, nome: true, cnpj: true, municipio: true, uf: true },
  });

  return NextResponse.json({ rows });
}

