import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/server/auth";
import { attachmentContentDisposition } from "@/server/http/contentDisposition";
import { canImport } from "@/server/permissions";
import { MVP_IMPORT_COLUMNS } from "@/server/imports/mvpColumns";

function escapeCsv(value: string) {
  const v = value.replaceAll('"', '""');
  return `"${v}"`;
}

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

  const lines = [header.map(escapeCsv).join(","), example.map(escapeCsv).join(",")];
  const csv = lines.join("\r\n") + "\r\n";

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "private, no-store",
      "Content-Disposition": attachmentContentDisposition(
        "template-importacao.csv",
        "template-importacao.csv",
      ),
    },
  });
}

