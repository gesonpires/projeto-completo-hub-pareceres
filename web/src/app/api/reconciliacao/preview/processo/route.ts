import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { getSessionFromCookies } from "@/server/auth";
import { canReconcileImports } from "@/server/permissions";
import { buildDocSourceRefIn } from "@/server/reconcile/collisionUtils";

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
    prisma.processo.findFirst({
      where: { id: fromId, importacaoLoteId: loteId, deletedAt: null },
      select: { id: true },
    }),
    prisma.processo.findFirst({
      where: { id: toId, importacaoLoteId: null, deletedAt: null },
      select: { id: true },
    }),
  ]);
  if (!from || !to) {
    return NextResponse.json({ message: "Processo origem/destino não encontrado." }, { status: 404 });
  }

  const [tramCount, atoCount, evtCount, docCount] = await Promise.all([
    prisma.tramitacao.count({ where: { importacaoLoteId: loteId, processoId: from.id, deletedAt: null } }),
    prisma.atoAutorizativo.count({ where: { importacaoLoteId: loteId, processoId: from.id, deletedAt: null } }),
    prisma.eventoRegulatorio.count({ where: { importacaoLoteId: loteId, processoId: from.id, deletedAt: null } }),
    prisma.documento.count({ where: { importacaoLoteId: loteId, processoId: from.id, deletedAt: null } }),
  ]);

  let blocked = false;
  const warnings: string[] = [];

  const [docRefs, atoKeys, evtKeys] = await prisma.$transaction([
    prisma.documento.findMany({
      where: {
        importacaoLoteId: loteId,
        processoId: from.id,
        deletedAt: null,
        sourceRef: { not: null },
      },
      take: 500,
      select: { sourceRef: true },
      distinct: ["sourceRef"],
    }),
    prisma.atoAutorizativo.findMany({
      where: { importacaoLoteId: loteId, processoId: from.id, deletedAt: null },
      take: 500,
      select: { tipo: true, dataAto: true, numero: true },
    }),
    prisma.eventoRegulatorio.findMany({
      where: { importacaoLoteId: loteId, processoId: from.id, deletedAt: null },
      take: 500,
      select: { tipo: true, dataEvento: true, descricao: true },
    }),
  ]);

  const refs = buildDocSourceRefIn(docRefs, 200);
  if (refs.length > 0) {
    const collisions = await prisma.documento.findMany({
      where: { processoId: to.id, deletedAt: null, sourceRef: { in: refs } },
      take: 10,
      select: { sourceRef: true },
    });
    if (collisions.length > 0) {
      blocked = true;
      const sample = collisions
        .map((c) => c.sourceRef ?? "")
        .filter(Boolean)
        .slice(0, 6)
        .join(", ");
      warnings.push(`Colisão de documento sourceRef no destino (ex.: ${sample}).`);
    }
  }

  if (atoKeys.length > 0) {
    const ors = atoKeys
      .slice(0, 150)
      .map((k) => ({
        tipo: k.tipo,
        dataAto: k.dataAto,
        ...(k.numero ? { numero: k.numero } : { numero: null }),
      }));
    const collisions = await prisma.atoAutorizativo.findMany({
      where: { processoId: to.id, deletedAt: null, OR: ors as never },
      take: 10,
      select: { tipo: true, numero: true, dataAto: true },
    });
    if (collisions.length > 0) {
      blocked = true;
      const sample = collisions
        .map((c) => `${String(c.tipo)}${c.numero ? ` ${c.numero}` : ""} (${c.dataAto.toISOString().slice(0, 10)})`)
        .slice(0, 6)
        .join(", ");
      warnings.push(`Colisão de ato (tipo/data/número) no destino (ex.: ${sample}).`);
    }
  }

  if (evtKeys.length > 0) {
    const ors = evtKeys.slice(0, 150).map((k) => ({
      tipo: k.tipo,
      dataEvento: k.dataEvento,
      descricao: k.descricao,
    }));
    const collisions = await prisma.eventoRegulatorio.findMany({
      where: { processoId: to.id, deletedAt: null, OR: ors as never },
      take: 10,
      select: { tipo: true, dataEvento: true, descricao: true },
    });
    if (collisions.length > 0) {
      blocked = true;
      const sample = collisions
        .map(
          (c) =>
            `${String(c.tipo)} (${c.dataEvento.toISOString().slice(0, 10)}) • ${c.descricao.slice(0, 40)}`,
        )
        .slice(0, 4)
        .join(" | ");
      warnings.push(`Colisão de evento (tipo/data/descrição) no destino (ex.: ${sample}).`);
    }
  }

  return NextResponse.json({
    ok: true,
    blocked,
    moved: { tramitacoes: tramCount, atos: atoCount, eventos: evtCount, documentos: docCount },
    warnings,
  });
}

