import type { InstitutionDetailInstituicao } from "./institutionDetailTypes";

export type ProvenanceSource = {
  fonteDadosId?: string | null;
  importacaoLoteId?: string | null;
  sourceRef?: string | null;
};

export type ProvenanceIndex = {
  fonteById: Map<string, { nome: string }>;
  loteById: Map<string, { arquivoNome: string; createdAt: Date }>;
};

export function collectProvenanceIds(
  instituicao: InstitutionDetailInstituicao,
): { fonteIds: Set<string>; loteIds: Set<string> } {
  const fonteIds = new Set<string>();
  const loteIds = new Set<string>();

  const collect = (fonteDadosId?: string | null, importacaoLoteId?: string | null) => {
    if (fonteDadosId) fonteIds.add(fonteDadosId);
    if (importacaoLoteId) loteIds.add(importacaoLoteId);
  };

  collect(instituicao.fonteDadosId, instituicao.importacaoLoteId);
  for (const p of instituicao.processos) collect(p.fonteDadosId, p.importacaoLoteId);
  for (const a of instituicao.atos) collect(a.fonteDadosId, a.importacaoLoteId);
  for (const e of instituicao.eventos) collect(e.fonteDadosId, e.importacaoLoteId);
  for (const d of instituicao.documentos) collect(d.fonteDadosId, d.importacaoLoteId);
  for (const p of instituicao.processos) {
    for (const t of p.tramitacoes ?? []) collect(t.fonteDadosId, t.importacaoLoteId);
  }

  return { fonteIds, loteIds };
}

export function createProvenanceFormatter(index: ProvenanceIndex) {
  return (args: ProvenanceSource): string => {
    const fonteNome = args.fonteDadosId
      ? index.fonteById.get(args.fonteDadosId)?.nome
      : null;
    const lote = args.importacaoLoteId
      ? index.loteById.get(args.importacaoLoteId)
      : null;
    const parts: string[] = [];
    if (fonteNome) parts.push(`Fonte: ${fonteNome}`);
    if (lote) parts.push(`Lote: ${lote.arquivoNome}`);
    if (args.sourceRef) parts.push(`Ref: ${args.sourceRef}`);
    return parts.join(" • ");
  };
}

export function formatInstitutionProvenance(
  instituicao: ProvenanceSource,
  formatProveniencia: (args: ProvenanceSource) => string,
): { text: string; loteId: string | null } {
  return {
    text: formatProveniencia(instituicao),
    loteId: instituicao.importacaoLoteId ?? null,
  };
}
