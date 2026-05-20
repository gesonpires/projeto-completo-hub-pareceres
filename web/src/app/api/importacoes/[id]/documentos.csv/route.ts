import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { withPrismaRetry } from "@/server/dbRetry";
import { getSessionFromCookies } from "@/server/auth";
import { attachmentContentDisposition } from "@/server/http/contentDisposition";
import { canReadImports } from "@/server/permissions";

function escapeCsv(value: string) {
  const v = value.replaceAll('"', '""');
  return `"${v}"`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }
  if (!canReadImports(session.perfil)) {
    return NextResponse.json({ message: "Sem permissão." }, { status: 403 });
  }

  const { id } = await params;

  const lote = await withPrismaRetry(() =>
    prisma.importacaoLote.findUnique({
      where: { id },
      select: { id: true, arquivoNome: true },
    }),
  );
  if (!lote) {
    return NextResponse.json({ message: "Lote não encontrado." }, { status: 404 });
  }

  const rows = await withPrismaRetry(() =>
    prisma.documento.findMany({
      where: { importacaoLoteId: id },
      orderBy: [{ updatedAt: "desc" }],
      take: 5000,
      select: {
        id: true,
        instituicaoId: true,
        titulo: true,
        dataDocumento: true,
        tipoDocumento: { select: { codigo: true } },
        sourceRef: true,
        createdAt: true,
        updatedAt: true,
        instituicao: { select: { nome: true } },
      },
    }),
  );

  const header = [
    "id",
    "instituicaoId",
    "instituicaoNome",
    "tipoDocumento",
    "titulo",
    "dataDocumento",
    "sourceRef",
    "createdAt",
    "updatedAt",
  ];

  const lines: string[] = [];
  lines.push(header.map(escapeCsv).join(","));
  for (const r of rows) {
    const data = [
      r.id,
      r.instituicaoId ?? "",
      r.instituicao?.nome ?? "",
      r.tipoDocumento.codigo,
      r.titulo,
      r.dataDocumento ? r.dataDocumento.toISOString().slice(0, 10) : "",
      r.sourceRef ?? "",
      r.createdAt.toISOString(),
      r.updatedAt.toISOString(),
    ];
    lines.push(data.map(escapeCsv).join(","));
  }
  const csv = lines.join("\r\n") + "\r\n";

  const originalName = `documentos-${lote.arquivoNome || lote.id}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "private, no-store",
      "Content-Disposition": attachmentContentDisposition(
        originalName,
        `documentos-${lote.id}.csv`,
      ),
    },
  });
}

