import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { withPrismaRetry } from "@/server/dbRetry";
import { getSessionFromCookies } from "@/server/auth";
import { canReadAudit } from "@/server/permissions";
import { auditEvent } from "@/server/audit";

export async function GET(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }
  if (!canReadAudit(session.perfil)) {
    return NextResponse.json({ message: "Sem permissão." }, { status: 403 });
  }

  const url = new URL(req.url);
  const entidade = (url.searchParams.get("entidade") ?? "").trim();
  const user = (url.searchParams.get("user") ?? "").trim();
  const de = (url.searchParams.get("de") ?? "").trim();
  const ate = (url.searchParams.get("ate") ?? "").trim();
  const limitRaw = (url.searchParams.get("limit") ?? "").trim();
  const limit = Math.max(
    1,
    Math.min(50000, Number.parseInt(limitRaw || "10000", 10) || 10000),
  );

  const from = de ? new Date(de) : null;
  const to = ate ? new Date(ate) : null;

  const where = {
    ...(entidade ? { entidade: { contains: entidade, mode: "insensitive" as const } } : {}),
    ...(user ? { actor: { email: { contains: user, mode: "insensitive" as const } } } : {}),
    ...(from || to
      ? {
          timestamp: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  };

  await auditEvent({
    entidade: "auditoria",
    entidadeId: session.id,
    evento: "EXPORT_JSON",
    actorUserId: session.id,
    metadata: {
      filtros: { entidade: entidade || null, user: user || null, de: de || null, ate: ate || null },
      limit,
    },
  });

  const rows = await withPrismaRetry(() =>
    prisma.logAuditoria.findMany({
      where,
      orderBy: [{ timestamp: "desc" }],
      take: limit,
      include: { actor: { include: { perfil: true } } },
    }),
  );

  return NextResponse.json(
    {
      filtros: { entidade: entidade || null, user: user || null, de: de || null, ate: ate || null },
      limit,
      rows: rows.map((r) => ({
        id: r.id,
        timestamp: r.timestamp.toISOString(),
        entidade: r.entidade,
        entidadeId: r.entidadeId,
        acao: r.acao,
        actor: r.actor
          ? {
              id: r.actor.id,
              nome: r.actor.nome,
              email: r.actor.email,
              perfil: r.actor.perfil?.nome,
            }
          : null,
        antes: r.antes,
        depois: r.depois,
        metadata: r.metadata,
      })),
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}

