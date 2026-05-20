export type ReportAuditEvent = "GERAR_RELATORIO_PDF" | "BAIXAR_RELATORIO_PDF";

export type ReportHistoryTipo = "" | "gerar" | "baixar" | "todos";

export function tipoToEvento(tipo: ReportHistoryTipo): ReportAuditEvent | "" {
  if (tipo === "baixar") return "BAIXAR_RELATORIO_PDF";
  if (tipo === "todos") return "";
  return "GERAR_RELATORIO_PDF";
}

export function buildReportHistoryWhere(params: {
  tipo: ReportHistoryTipo;
  fromFilter?: string;
  entidadeIds?: string[] | null;
  qRaw?: string;
  idsResolved?: boolean;
}) {
  const tipoEvento = tipoToEvento(params.tipo);
  const from = (params.fromFilter ?? "").trim();
  const ids = params.entidadeIds ?? null;
  const qRaw = (params.qRaw ?? "").trim();
  const idsResolved = params.idsResolved ?? Boolean(ids);

  return {
    entidade: "instituicoes",
    AND: [
      ...(tipoEvento ? [{ metadata: { path: ["evento"], equals: tipoEvento } as never }] : []),
      ...(from ? [{ metadata: { path: ["from"], equals: from } as never }] : []),
    ],
    ...(ids && ids.length > 0 ? { entidadeId: { in: ids } } : {}),
    ...(qRaw && !idsResolved
      ? {
          OR: [
            { actor: { nome: { contains: qRaw, mode: "insensitive" as const } } },
            { actor: { email: { contains: qRaw, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };
}

