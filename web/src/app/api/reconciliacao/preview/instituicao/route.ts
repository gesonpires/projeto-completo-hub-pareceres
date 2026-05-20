import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { getSessionFromCookies } from "@/server/auth";
import { canReconcileImports } from "@/server/permissions";
import { buildNumeroAnoOr, formatNumeroAnoSample } from "@/server/reconcile/collisionUtils";

export async function GET(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  if (!canReconcileImports(session.perfil)) {
    return NextResponse.json({ message: "Sem permissão." }, { status: 403 });
  }

  const loteId = (req.nextUrl.searchParams.get("loteId") ?? "").trim();
  const fromId = (req.nextUrl.searchParams.get("fromId") ?? "").trim();
  const toId = (req.nextUrl.searchParams.get("toId") ?? "").trim();
  if (!loteId || !fromId || !toId) {
    return NextResponse.json({ message: "Parâmetros inválidos." }, { status: 400 });
  }

  const [from, to] = await Promise.all([
    prisma.instituicao.findFirst({
      where: { id: fromId, importacaoLoteId: loteId, deletedAt: null },
      select: { id: true },
    }),
    prisma.instituicao.findFirst({
      where: { id: toId, importacaoLoteId: null, deletedAt: null },
      select: { id: true },
    }),
  ]);
  if (!from || !to) {
    return NextResponse.json({ message: "Instituição origem/destino não encontrada." }, { status: 404 });
  }

  const [procCount, atoCount, evtCount, docCount] = await Promise.all([
    prisma.processo.count({ where: { importacaoLoteId: loteId, instituicaoId: from.id, deletedAt: null } }),
    prisma.atoAutorizativo.count({ where: { importacaoLoteId: loteId, instituicaoId: from.id, deletedAt: null } }),
    prisma.eventoRegulatorio.count({ where: { importacaoLoteId: loteId, instituicaoId: from.id, deletedAt: null } }),
    prisma.documento.count({ where: { importacaoLoteId: loteId, instituicaoId: from.id, deletedAt: null } }),
  ]);

  let blocked = false;
  const warnings: string[] = [];

  const procKeys = await prisma.processo.findMany({
    where: {
      importacaoLoteId: loteId,
      instituicaoId: from.id,
      deletedAt: null,
      numero: { not: null },
      ano: { not: null },
    },
    take: 500,
    select: { numero: true, ano: true },
    distinct: ["numero", "ano"],
  });
  if (procKeys.length > 0) {
    const orNumeroAno = buildNumeroAnoOr(procKeys, 150);
    if (orNumeroAno.length > 0) {
      const collisions = await prisma.processo.findMany({
        where: { instituicaoId: to.id, deletedAt: null, OR: orNumeroAno },
        take: 10,
        select: { numero: true, ano: true },
      });
      if (collisions.length > 0) {
        blocked = true;
        warnings.push(
          `Colisão de processos número/ano no destino (ex.: ${formatNumeroAnoSample(collisions, 6)}).`,
        );
      }
    }
  }

  return NextResponse.json({
    ok: true,
    blocked,
    moved: { processos: procCount, atos: atoCount, eventos: evtCount, documentos: docCount },
    warnings,
  });
}

