import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionFromCookies } from "@/server/auth";
import { canReadAudit, isAdmin } from "@/server/permissions";
import { attachmentContentDisposition } from "@/server/http/contentDisposition";
import { readAuditoriaExportDownload } from "@/server/services/auditoriaExportJobService";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }
  if (!canReadAudit(session.perfil)) {
    return NextResponse.json({ message: "Sem permissão." }, { status: 403 });
  }

  const { id } = await params;
  const result = await readAuditoriaExportDownload(
    { userId: session.id, isAdmin: isAdmin(session.perfil) },
    id,
  );

  if (!result.ok) {
    if (result.code === "not_found") {
      return NextResponse.json({ message: "Job não encontrado." }, { status: 404 });
    }
    if (result.code === "forbidden") {
      return NextResponse.json({ message: "Sem permissão." }, { status: 403 });
    }
    if (result.code === "not_ready") {
      return NextResponse.json({ message: "Export ainda não está pronto." }, { status: 409 });
    }
    if (result.code === "invalid_file") {
      return NextResponse.json({ message: "Arquivo inválido." }, { status: 400 });
    }
    return NextResponse.json({ message: "Arquivo não encontrado no storage." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(result.bytes), {
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": "private, no-store",
      "Content-Disposition": attachmentContentDisposition(
        result.filename,
        result.filename,
      ),
    },
  });
}
