import type { InstitutionalReportInstituicao } from "./institutionalReportTypes";

export type InstitutionalReportTimelineKind =
  | "processo"
  | "ato"
  | "evento"
  | "documento";

export type InstitutionalReportTimelineItem = {
  kind: InstitutionalReportTimelineKind;
  id: string;
  date: Date;
  title: string;
  subtitle?: string;
};

const kindOrder: Record<InstitutionalReportTimelineKind, number> = {
  ato: 1,
  evento: 2,
  processo: 3,
  documento: 4,
};

/** Monta e ordena a linha do tempo consolidada do relatório institucional. */
export function buildInstitutionalReportTimeline(
  instituicao: InstitutionalReportInstituicao,
): InstitutionalReportTimelineItem[] {
  const timeline: InstitutionalReportTimelineItem[] = [];

  for (const p of instituicao.processos) {
    timeline.push({
      kind: "processo",
      id: p.id,
      date: p.dataAbertura ?? p.createdAt,
      title: `Processo ${p.numero ?? "(sem número)"} • ${p.status}`,
      subtitle: p.assunto ?? undefined,
    });
  }
  for (const a of instituicao.atos) {
    timeline.push({
      kind: "ato",
      id: a.id,
      date: a.dataAto,
      title: `${a.tipo}${a.numero ? ` ${a.numero}` : ""}`,
      subtitle: (a.ementa ?? a.descricao) ?? undefined,
    });
  }
  for (const e of instituicao.eventos) {
    timeline.push({
      kind: "evento",
      id: e.id,
      date: e.dataEvento,
      title: `${e.tipo}`,
      subtitle: e.descricao,
    });
  }
  for (const d of instituicao.documentos) {
    timeline.push({
      kind: "documento",
      id: d.id,
      date: d.dataDocumento ?? d.createdAt,
      title: `${d.tipoDocumento.codigo}: ${d.titulo}`,
      subtitle: d.arquivoNome ?? undefined,
    });
  }

  timeline.sort((a, b) => {
    const d = b.date.getTime() - a.date.getTime();
    if (d !== 0) return d;
    const k = (kindOrder[a.kind] ?? 99) - (kindOrder[b.kind] ?? 99);
    if (k !== 0) return k;
    return a.id.localeCompare(b.id);
  });

  return timeline;
}
