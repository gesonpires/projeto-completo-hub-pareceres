import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/server/auth";
import { attachmentContentDisposition } from "@/server/http/contentDisposition";
import { canImport } from "@/server/permissions";
import * as XLSX from "xlsx";
import { MVP_IMPORT_COLUMNS } from "@/server/imports/mvpColumns";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }
  if (!canImport(session.perfil)) {
    return NextResponse.json({ message: "Sem permissão." }, { status: 403 });
  }

  const header = [...MVP_IMPORT_COLUMNS];

  const example = [
    "Faculdade Exemplo",
    "12.345.678/0001-90",
    "São Paulo",
    "SP",
    "12345",
    "2026",
    "EM_TRAMITACAO",
    "Reconhecimento de curso",
    "PARECER",
    "123/2026",
    "24/04/2026",
    "Ementa resumida...",
    "Descrição do ato...",
    "PROTOCOLO",
    "24/04/2026",
    "Protocolo recebido",
    "OFICIO",
    "24/04/2026",
    "Ofício de encaminhamento",
  ];

  const ws = XLSX.utils.aoa_to_sheet([header, example]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "IMPORTACAO_MVP");
  const bytes = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Cache-Control": "private, no-store",
      "Content-Disposition": attachmentContentDisposition(
        "template-importacao.xlsx",
        "template-importacao.xlsx",
      ),
    },
  });
}

