import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { withPrismaRetry } from "@/server/dbRetry";
import { getSessionFromCookies } from "@/server/auth";
import { canReadAudit } from "@/server/permissions";
import { attachmentContentDisposition } from "@/server/http/contentDisposition";
import { auditEvent } from "@/server/audit";

function escapeCsv(value: string) {
  const v = value.replaceAll('"', '""');
  return `"${v}"`;
}

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

  // Registra o download do export para compliance/rastreabilidade.
  await auditEvent({
    entidade: "auditoria",
    entidadeId: session.id,
    evento: "EXPORT_CSV",
    actorUserId: session.id,
    metadata: {
      filtros: { entidade: entidade || null, user: user || null, de: de || null, ate: ate || null },
      limit: 10000,
    },
  });

  const rows = await withPrismaRetry(() =>
    prisma.logAuditoria.findMany({
      where,
      orderBy: [{ timestamp: "desc" }],
      take: 10000,
      include: { actor: { include: { perfil: true } } },
    }),
  );

  const header = [
    "id",
    "timestamp",
    "entidade",
    "entidadeId",
    "acao",
    "actorNome",
    "actorEmail",
    "actorPerfil",
    "antes",
    "depois",
    "metadata",
  ];

  const lines: string[] = [];
  lines.push(header.map(escapeCsv).join(","));
  for (const r of rows) {
    const data = [
      r.id,
      r.timestamp.toISOString(),
      r.entidade,
      r.entidadeId,
      r.acao,
      r.actor?.nome ?? "",
      r.actor?.email ?? "",
      r.actor?.perfil?.nome ?? "",
      r.antes ? JSON.stringify(r.antes) : "",
      r.depois ? JSON.stringify(r.depois) : "",
      r.metadata ? JSON.stringify(r.metadata) : "",
    ];
    lines.push(data.map(escapeCsv).join(","));
  }
  const csv = lines.join("\r\n") + "\r\n";

  const originalName = `auditoria${entidade ? `-${entidade}` : ""}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "private, no-store",
      "Content-Disposition": attachmentContentDisposition(originalName, "auditoria.csv"),
    },
  });
}

