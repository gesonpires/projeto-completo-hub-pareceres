import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { withPrismaRetry } from "@/server/dbRetry";
import { getSessionFromCookies } from "@/server/auth";
import { attachmentContentDisposition } from "@/server/http/contentDisposition";
import { formatCnpj } from "@/server/normalize";
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
    prisma.instituicao.findMany({
      where: { importacaoLoteId: id },
      orderBy: [{ updatedAt: "desc" }],
      take: 5000,
      select: {
        id: true,
        nome: true,
        cnpj: true,
        municipio: true,
        uf: true,
        sourceRef: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  );

  const header = [
    "id",
    "nome",
    "cnpj",
    "municipio",
    "uf",
    "sourceRef",
    "createdAt",
    "updatedAt",
  ];

  const lines: string[] = [];
  lines.push(header.map(escapeCsv).join(","));
  for (const r of rows) {
    const data = [
      r.id,
      r.nome,
      r.cnpj ? formatCnpj(r.cnpj) : "",
      r.municipio ?? "",
      r.uf ?? "",
      r.sourceRef ?? "",
      r.createdAt.toISOString(),
      r.updatedAt.toISOString(),
    ];
    lines.push(data.map(escapeCsv).join(","));
  }
  const csv = lines.join("\r\n") + "\r\n";

  const originalName = `instituicoes-${lote.arquivoNome || lote.id}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "private, no-store",
      "Content-Disposition": attachmentContentDisposition(
        originalName,
        `instituicoes-${lote.id}.csv`,
      ),
    },
  });
}

