import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { getSessionFromCookies } from "@/server/auth";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { attachmentContentDisposition } from "@/server/http/contentDisposition";
import { hasPermission } from "@/server/permissions";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }
  if (!hasPermission(session.perfil, "documents:read")) {
    return NextResponse.json({ message: "Sem permissão." }, { status: 403 });
  }

  const { id } = await params;
  const doc = await prisma.documento.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      storagePath: true,
      arquivoNome: true,
      arquivoMime: true,
      instituicaoId: true,
    },
  });

  if (!doc || !doc.storagePath) {
    return NextResponse.json({ message: "Arquivo não encontrado." }, { status: 404 });
  }

  // Defesa adicional: documento deve estar ligado a alguma instituição no MVP.
  if (!doc.instituicaoId) {
    return NextResponse.json({ message: "Arquivo inválido." }, { status: 400 });
  }

  // Defesa: o caminho deve ficar dentro de /storage (MVP).
  if (!doc.storagePath.startsWith("storage/") && !doc.storagePath.startsWith("storage\\")) {
    return NextResponse.json({ message: "Arquivo inválido." }, { status: 400 });
  }

  // `storagePath` vem do banco e é dinâmico; evitamos trace de projeto inteiro no Turbopack.
  const absolutePath = path.join(/*turbopackIgnore: true*/ process.cwd(), doc.storagePath);
  let bytes: Buffer;
  try {
    bytes = await readFile(absolutePath);
  } catch {
    return NextResponse.json({ message: "Arquivo não encontrado no storage." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": doc.arquivoMime || "application/octet-stream",
      "Cache-Control": "private, no-store",
      "Content-Disposition": attachmentContentDisposition(
        doc.arquivoNome || `documento-${doc.id}`,
        `documento-${doc.id}`,
      ),
    },
  });
}

