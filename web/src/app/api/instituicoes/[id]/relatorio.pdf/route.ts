import { NextResponse } from "next/server";
import { withPrismaRetry } from "@/server/dbRetry";
import { getSessionFromCookies } from "@/server/auth";
import { auditEvent } from "@/server/audit";
import PDFDocument from "pdfkit";
import { attachmentContentDisposition } from "@/server/http/contentDisposition";
import { formatCnpj } from "@/server/normalize";
import { canGenerateReports, hasPermission } from "@/server/permissions";
import { normalizeReportFrom } from "@/server/reports/reportAudit";
import { loadInstitutionalReport } from "@/server/read-models/institutionalReport";

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("pt-BR").format(d);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }
  if (!hasPermission(session.perfil, "institutions:read")) {
    return NextResponse.json({ message: "Sem permissão." }, { status: 403 });
  }
  if (!canGenerateReports(session.perfil)) {
    return NextResponse.json({ message: "Sem permissão." }, { status: 403 });
  }

  const { id } = await params;

  const loaded = await loadInstitutionalReport(id);

  if (loaded.status === "db_error") {
    return NextResponse.json(
      { message: "Banco indisponível no momento. Tente novamente em instantes." },
      { status: 503 },
    );
  }

  if (loaded.status === "not_found") {
    return NextResponse.json({ message: "Instituição não encontrada." }, { status: 404 });
  }

  const { instituicao, timeline, provenance, counts } = loaded.report;
  const provText = provenance.text;

  const from = (() => {
    try {
      const u = new URL(req.url);
      return (u.searchParams.get("from") ?? "").trim().slice(0, 32);
    } catch {
      return "";
    }
  })();
  const fromValue = normalizeReportFrom(from);

  const isDownloadTracked = (() => {
    try {
      const u = new URL(req.url);
      return (u.searchParams.get("dl") ?? "").trim() === "1";
    } catch {
      return false;
    }
  })();

  await withPrismaRetry(() =>
    auditEvent({
      entidade: "instituicoes",
      entidadeId: instituicao.id,
      evento: "GERAR_RELATORIO_PDF",
      actorUserId: session.id,
      metadata: {
        from: fromValue,
        counts,
      },
    }),
  );

  if (isDownloadTracked) {
    await withPrismaRetry(() =>
      auditEvent({
        entidade: "instituicoes",
        entidadeId: instituicao.id,
        evento: "BAIXAR_RELATORIO_PDF",
        actorUserId: session.id,
        metadata: {
          from: fromValue,
        },
      }),
    );
  }

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c as Buffer));

  doc.fontSize(14).text("CEE‑SC — Relatório institucional", { align: "left" });
  doc.moveDown(0.5);
  doc.fontSize(16).text(instituicao.nome);
  doc.fontSize(10).fillColor("#444").text(
    `${instituicao.cnpj ? `CNPJ ${formatCnpj(instituicao.cnpj)}` : "CNPJ não informado"} • ` +
      `${instituicao.municipio ?? "Município não informado"}${instituicao.uf ? `/${instituicao.uf}` : ""}`,
  );
  doc.moveDown(0.25);
  doc.fontSize(9).fillColor("#666").text(`Gerado em ${formatDate(new Date())}`);
  if (provText) {
    doc.moveDown(0.2);
    doc.fontSize(8).fillColor("#666").text(provText);
  }
  doc.moveDown(1);

  doc.fillColor("#111").fontSize(12).text("Resumo");
  doc.moveDown(0.25);
  doc.fontSize(10).fillColor("#333").text(
    `Processos: ${counts.processos}   ` +
      `Atos: ${counts.atos}   ` +
      `Eventos: ${counts.eventos}   ` +
      `Documentos: ${counts.documentos}`,
  );
  doc.moveDown(1);

  doc.fillColor("#111").fontSize(12).text("Histórico");
  doc.moveDown(0.5);

  const addItem = (title: string, date: Date, subtitle?: string) => {
    doc.fillColor("#111").fontSize(10).text(title, { continued: true });
    doc.fillColor("#666").text(`  (${formatDate(date)})`);
    if (subtitle) {
      doc.fillColor("#333").fontSize(9).text(subtitle);
    }
    doc.moveDown(0.4);
  };

  for (const t of timeline) {
    addItem(t.title, t.date, t.subtitle);
  }

  doc.end();

  const pdfBuffer = await new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const originalName = `relatorio-${instituicao.nome}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "private, no-store",
      "Content-Disposition": attachmentContentDisposition(
        originalName,
        `relatorio-${instituicao.id}.pdf`,
      ),
    },
  });
}
