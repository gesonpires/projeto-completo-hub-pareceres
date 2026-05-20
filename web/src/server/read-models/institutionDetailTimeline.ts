import {
  createProvenanceFormatter,
  type ProvenanceIndex,
  type ProvenanceSource,
} from "./institutionDetailProvenance";
import type {
  InstitutionDetailInstituicao,
  InstitutionDetailTimelineItem,
  InstitutionDetailTimelineKind,
} from "./institutionDetailTypes";

const kindOrder: Record<InstitutionDetailTimelineKind, number> = {
  ato: 1,
  evento: 2,
  processo: 3,
  tramitacao: 4,
  documento: 5,
};

/** Monta a linha do tempo consolidada do detalhe institucional. */
export function buildInstitutionDetailTimeline(
  instituicao: InstitutionDetailInstituicao,
  formatProveniencia: (args: ProvenanceSource) => string,
): InstitutionDetailTimelineItem[] {
  const timeline: InstitutionDetailTimelineItem[] = [];

  for (const p of instituicao.processos) {
    timeline.push({
      kind: "processo",
      id: p.id,
      date: p.dataAbertura ?? p.createdAt,
      title: `Processo ${p.numero ?? "(sem número)"} • ${p.status}`,
      subtitle: p.assunto ?? undefined,
      proveniencia: formatProveniencia(p),
      importacaoLoteId: p.importacaoLoteId ?? undefined,
      deletedAt: p.deletedAt,
    });

    for (const t of p.tramitacoes ?? []) {
      timeline.push({
        kind: "tramitacao",
        id: t.id,
        date: t.dataMovimento,
        title: `Tramitação • ${t.status ?? "—"}`,
        subtitle: [
          t.deSetor ? `De: ${t.deSetor}` : null,
          t.paraSetor ? `Para: ${t.paraSetor}` : null,
          t.observacao ? `Obs: ${t.observacao}` : null,
        ]
          .filter(Boolean)
          .join(" • "),
        proveniencia: formatProveniencia(t),
        importacaoLoteId: t.importacaoLoteId ?? undefined,
        deletedAt: t.deletedAt,
      });
    }
  }

  for (const a of instituicao.atos) {
    timeline.push({
      kind: "ato",
      id: a.id,
      date: a.dataAto,
      title: `${a.tipo}${a.numero ? ` ${a.numero}` : ""}`,
      subtitle: a.ementa ?? a.descricao ?? undefined,
      proveniencia: formatProveniencia(a),
      importacaoLoteId: a.importacaoLoteId ?? undefined,
      deletedAt: a.deletedAt,
    });
  }

  for (const e of instituicao.eventos) {
    timeline.push({
      kind: "evento",
      id: e.id,
      date: e.dataEvento,
      title: `${e.tipo}`,
      subtitle: e.descricao,
      proveniencia: formatProveniencia(e),
      importacaoLoteId: e.importacaoLoteId ?? undefined,
      deletedAt: e.deletedAt,
    });
  }

  for (const d of instituicao.documentos) {
    timeline.push({
      kind: "documento",
      id: d.id,
      date: d.dataDocumento ?? d.createdAt,
      title: `${d.tipoDocumento.codigo}: ${d.titulo}`,
      subtitle: d.arquivoNome ?? d.storagePath ?? undefined,
      href: d.storagePath ? `/api/documentos/${d.id}/download` : undefined,
      proveniencia: formatProveniencia(d),
      importacaoLoteId: d.importacaoLoteId ?? undefined,
      deletedAt: d.deletedAt,
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

export function buildInstitutionDetailLookupMaps(
  instituicao: InstitutionDetailInstituicao,
): {
  processoById: Map<string, InstitutionDetailInstituicao["processos"][number]>;
  tramitacaoById: Map<
    string,
    InstitutionDetailInstituicao["processos"][number]["tramitacoes"][number]
  >;
  atoById: Map<string, InstitutionDetailInstituicao["atos"][number]>;
  eventoById: Map<string, InstitutionDetailInstituicao["eventos"][number]>;
  documentoById: Map<string, InstitutionDetailInstituicao["documentos"][number]>;
} {
  return {
    processoById: new Map(instituicao.processos.map((p) => [p.id, p])),
    tramitacaoById: new Map(
      instituicao.processos.flatMap((p) =>
        (p.tramitacoes ?? []).map((t) => [t.id, t] as const),
      ),
    ),
    atoById: new Map(instituicao.atos.map((a) => [a.id, a])),
    eventoById: new Map(instituicao.eventos.map((e) => [e.id, e])),
    documentoById: new Map(instituicao.documentos.map((d) => [d.id, d])),
  };
}

export { createProvenanceFormatter, type ProvenanceIndex };
