import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { withPrismaRetry } from "@/server/dbRetry";
import { getSessionFromCookies } from "@/server/auth";
import { attachmentContentDisposition } from "@/server/http/contentDisposition";
import { canReadImports } from "@/server/permissions";

function escapeCsv(value: string) {
  // CSV RFC4180-ish com aspas duplas.
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
      select: { id: true, arquivoNome: true, relatorioErros: true },
    }),
  );

  if (!lote) {
    return NextResponse.json({ message: "Lote não encontrado." }, { status: 404 });
  }

  const errors =
    ((lote.relatorioErros as unknown as Array<{ rowNumber: number; message: string }>) ??
      []) || [];

  const lines: string[] = [];
  lines.push(["rowNumber", "message"].map(escapeCsv).join(","));
  for (const e of errors) {
    lines.push([String(e.rowNumber), e.message ?? ""].map(escapeCsv).join(","));
  }
  const csv = lines.join("\r\n") + "\r\n";

  const originalName = `erros-${lote.arquivoNome || lote.id}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "private, no-store",
      "Content-Disposition": attachmentContentDisposition(
        originalName,
        `erros-${lote.id}.csv`,
      ),
    },
  });
}

