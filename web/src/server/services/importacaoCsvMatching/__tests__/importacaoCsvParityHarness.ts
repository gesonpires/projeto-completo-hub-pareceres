import type { Prisma } from "@/generated/prisma/client";
import {
  ATO_MATCH_POLICY_PREVIEW,
  ATO_MATCH_POLICY_RUN,
  type AtoMatchPolicy,
  resolveAto,
} from "../resolveAto";
import { resolveDocumento } from "../resolveDocumento";
import { resolveEvento } from "../resolveEvento";
import {
  INSTITUICAO_MATCH_POLICY_PREVIEW,
  INSTITUICAO_MATCH_POLICY_RUN,
  type InstituicaoMatchPolicy,
  resolveInstituicao,
  type InstituicaoResolveResult,
} from "../resolveInstituicao";
import { resolveProcesso } from "../resolveProcesso";
import type { NormalizedImportRow } from "../importRowTypes";
import type {
  ImportacaoParityStore,
  ParityInstituicao,
} from "./importacaoCsvParityFixtures";

export type ParityOutcomeBucket = "skip" | "reject" | "create" | "update";

export function toParityBucket(result: { outcome: string }): ParityOutcomeBucket {
  if (result.outcome === "unknown_tipo") return "skip";
  if (
    result.outcome === "skip" ||
    result.outcome === "reject" ||
    result.outcome === "create" ||
    result.outcome === "update"
  ) {
    return result.outcome;
  }
  throw new Error(`Outcome não mapeado para paridade: ${result.outcome}`);
}

function equalsInsensitive(a: string | null | undefined, b: string | undefined): boolean {
  if (!b) return true;
  return (a ?? "").toLowerCase() === b.toLowerCase();
}

function matchesInstituicaoSemCnpj(
  inst: ParityInstituicao,
  where: Prisma.InstituicaoWhereInput,
): boolean {
  if (where.deletedAt === null && inst.deletedAt !== null) return false;
  if (where.nomeNormalizado !== inst.nomeNormalizado) return false;

  const municipioFilter = where.municipio as
    | { equals: string; mode: "insensitive" }
    | undefined;
  if (municipioFilter && !equalsInsensitive(inst.municipio, municipioFilter.equals)) {
    return false;
  }

  const ufFilter = where.uf as { equals: string; mode: "insensitive" } | undefined;
  if (ufFilter && !equalsInsensitive(inst.uf, ufFilter.equals)) {
    return false;
  }

  return true;
}

function matchesProcesso(
  proc: ImportacaoParityStore["processos"][number],
  where: Prisma.ProcessoWhereInput,
): boolean {
  if (where.deletedAt === null && proc.deletedAt !== null) return false;
  if (where.instituicaoId !== proc.instituicaoId) return false;
  if (where.numero !== proc.numero) return false;
  if (where.ano !== proc.ano) return false;
  return true;
}

function matchesEvento(
  evt: ImportacaoParityStore["eventos"][number],
  where: Prisma.EventoRegulatorioWhereInput,
): boolean {
  if (where.deletedAt === null && evt.deletedAt !== null) return false;
  if (where.instituicaoId !== evt.instituicaoId) return false;
  if (where.tipo !== evt.tipo) return false;
  if (
    where.dataEvento instanceof Date &&
    evt.dataEvento.getTime() !== where.dataEvento.getTime()
  ) {
    return false;
  }
  if (where.descricao !== evt.descricao) return false;
  return true;
}

function matchesDocumento(
  doc: ImportacaoParityStore["documentos"][number],
  where: Prisma.DocumentoWhereInput,
): boolean {
  if (where.deletedAt === null && doc.deletedAt !== null) return false;
  if (where.instituicaoId !== doc.instituicaoId) return false;
  if (where.tipoDocumentoId !== doc.tipoDocumentoId) return false;
  if (where.titulo !== doc.titulo) return false;
  const whereData = where.dataDocumento;
  if (whereData === null && doc.dataDocumento !== null) return false;
  if (
    whereData instanceof Date &&
    doc.dataDocumento &&
    doc.dataDocumento.getTime() !== whereData.getTime()
  ) {
    return false;
  }
  return true;
}

function matchesAto(
  ato: ImportacaoParityStore["atos"][number],
  where: Prisma.AtoAutorizativoWhereInput,
): boolean {
  if (where.deletedAt === null && ato.deletedAt !== null) return false;
  if (where.instituicaoId !== ato.instituicaoId) return false;
  if (where.tipo !== ato.tipo) return false;
  if (
    where.dataAto instanceof Date &&
    ato.dataAto.getTime() !== where.dataAto.getTime()
  ) {
    return false;
  }
  if ("numero" in where) {
    if (where.numero !== ato.numero) return false;
  }
  return true;
}

export function createInMemoryImportFinders(store: ImportacaoParityStore) {
  return {
    findInstituicaoByCnpj: async (cnpj: string) => {
      const hit = store.instituicoes.find(
        (i) => i.deletedAt === null && i.cnpj === cnpj,
      );
      return hit ? { id: hit.id } : null;
    },

    findInstituicaoById: async (id: string) => {
      const hit = store.instituicoes.find((i) => i.id === id && i.deletedAt === null);
      return hit ? { id: hit.id } : null;
    },

    findInstituicaoCandidatesSemCnpj: async (where: Prisma.InstituicaoWhereInput) => {
      return store.instituicoes
        .filter((i) => i.deletedAt === null && matchesInstituicaoSemCnpj(i, where))
        .slice(0, 5)
        .map((i) => ({ id: i.id, cnpj: i.cnpj }));
    },

    findInstituicaoFirstSemCnpj: async (where: Prisma.InstituicaoWhereInput) => {
      const hit = store.instituicoes.find(
        (i) => i.deletedAt === null && matchesInstituicaoSemCnpj(i, where),
      );
      return hit ? { id: hit.id } : null;
    },

    findProcesso: async (where: Prisma.ProcessoWhereInput) => {
      const hit = store.processos.find(
        (p) => p.deletedAt === null && matchesProcesso(p, where),
      );
      return hit ? { id: hit.id } : null;
    },

    findEvento: async (where: Prisma.EventoRegulatorioWhereInput) => {
      const hit = store.eventos.find(
        (e) => e.deletedAt === null && matchesEvento(e, where),
      );
      return hit ? { id: hit.id } : null;
    },

    findDocumento: async (where: Prisma.DocumentoWhereInput) => {
      const hit = store.documentos.find(
        (d) => d.deletedAt === null && matchesDocumento(d, where),
      );
      return hit ? { id: hit.id } : null;
    },

    findAto: async (where: Prisma.AtoAutorizativoWhereInput) => {
      const hit = store.atos.find((a) => a.deletedAt === null && matchesAto(a, where));
      return hit ? { id: hit.id } : null;
    },

    findTipoDocumentoIdByCodigo: (codigo: string) => {
      return store.tiposDocumento.find((t) => t.codigo === codigo)?.id ?? null;
    },
  };
}

export async function resolveInstituicaoFromStore(
  row: NormalizedImportRow,
  policy: InstituicaoMatchPolicy,
  store: ImportacaoParityStore,
  options?: {
    rowNumber?: number;
    reconciliacoes?: Record<number, string>;
  },
): Promise<InstituicaoResolveResult> {
  const f = createInMemoryImportFinders(store);
  return resolveInstituicao({
    row,
    policy,
    rowNumber: options?.rowNumber,
    reconciliacoes: options?.reconciliacoes,
    findByCnpj: f.findInstituicaoByCnpj,
    findById: f.findInstituicaoById,
    findCandidatesSemCnpj: f.findInstituicaoCandidatesSemCnpj,
    findFirstSemCnpj: f.findInstituicaoFirstSemCnpj,
  });
}

export async function resolveAtoFromStore(
  row: NormalizedImportRow,
  instituicaoId: string | null,
  policy: AtoMatchPolicy,
  store: ImportacaoParityStore,
) {
  const f = createInMemoryImportFinders(store);
  return resolveAto({
    instituicaoId,
    row,
    policy,
    findExisting: instituicaoId ? f.findAto : undefined,
  });
}

export type ChildParityResults = {
  processo: ParityOutcomeBucket;
  evento: ParityOutcomeBucket;
  documento: ParityOutcomeBucket;
  ato: ParityOutcomeBucket;
};

export type ParityEntityCounts = {
  created: number;
  updated: number;
};

/** Contadores por linha (espelha buckets do dry-run / relatório de impacto). */
export type ParityRowImpact = {
  instituicoes: ParityEntityCounts;
  processos: ParityEntityCounts;
  atos: ParityEntityCounts;
  eventos: ParityEntityCounts;
  documentos: ParityEntityCounts;
  /** Linha ignorada (sem nome ou CNPJ inválido). */
  lineExcluded: boolean;
  /** Run: documento com tipo desconhecido (linha rejeitada, demais entidades já contadas). */
  lineRejected: boolean;
};

export type ParitySimMode = "preview" | "run";

function emptyEntityCounts(): ParityEntityCounts {
  return { created: 0, updated: 0 };
}

function bumpEntityCounts(
  counts: ParityEntityCounts,
  bucket: ParityOutcomeBucket,
): void {
  if (bucket === "create") counts.created += 1;
  else if (bucket === "update") counts.updated += 1;
}

/**
 * Resolve filhos com o mesmo `instituicaoId` (run e preview usam os mesmos resolvers).
 */
export async function resolveChildrenFromStore(
  row: NormalizedImportRow,
  instituicaoId: string | null,
  store: ImportacaoParityStore,
  options?: { atoPolicy?: AtoMatchPolicy },
): Promise<ChildParityResults> {
  const f = createInMemoryImportFinders(store);
  const tipoId = row.docTipo ? f.findTipoDocumentoIdByCodigo(row.docTipo) : null;
  const atoPolicy = options?.atoPolicy ?? ATO_MATCH_POLICY_RUN;

  const [processo, evento, documento] = await Promise.all([
    resolveProcesso({
      instituicaoId,
      row,
      findExisting: instituicaoId ? f.findProcesso : undefined,
    }),
    resolveEvento({
      instituicaoId,
      row,
      findExisting: instituicaoId ? f.findEvento : undefined,
    }),
    resolveDocumento({
      instituicaoId,
      tipoDocumentoId: tipoId,
      row,
      findExisting: instituicaoId && tipoId ? f.findDocumento : undefined,
    }),
  ]);

  let ato: ParityOutcomeBucket = "skip";
  if (row.hasAto) {
    const atoResolved = await resolveAto({
      instituicaoId,
      row,
      policy: atoPolicy,
      findExisting: instituicaoId ? f.findAto : undefined,
    });
    ato = toParityBucket(atoResolved);
  }

  return {
    processo: toParityBucket(processo),
    evento: toParityBucket(evento),
    documento: toParityBucket(documento),
    ato,
  };
}

/**
 * Simula contagem de impacto de uma linha (resolvers only, sem Prisma).
 * `preview` segue políticas do dry-run; `run` inclui reconciliação e rejeição por tipo de documento.
 */
export async function computeParityRowImpact(
  row: NormalizedImportRow,
  store: ImportacaoParityStore,
  mode: ParitySimMode,
  options?: {
    rowNumber?: number;
    reconciliacoes?: Record<number, string>;
  },
): Promise<ParityRowImpact> {
  const impact: ParityRowImpact = {
    instituicoes: emptyEntityCounts(),
    processos: emptyEntityCounts(),
    atos: emptyEntityCounts(),
    eventos: emptyEntityCounts(),
    documentos: emptyEntityCounts(),
    lineExcluded: false,
    lineRejected: false,
  };

  const instPolicy =
    mode === "run" ? INSTITUICAO_MATCH_POLICY_RUN : INSTITUICAO_MATCH_POLICY_PREVIEW;
  const atoPolicy = mode === "run" ? ATO_MATCH_POLICY_RUN : ATO_MATCH_POLICY_PREVIEW;

  const instResolved = await resolveInstituicaoFromStore(row, instPolicy, store, {
    rowNumber: options?.rowNumber,
    reconciliacoes: mode === "run" ? options?.reconciliacoes : undefined,
  });

  if (instResolved.outcome === "skip" || instResolved.outcome === "reject") {
    impact.lineExcluded = true;
    return impact;
  }

  bumpEntityCounts(impact.instituicoes, toParityBucket(instResolved));

  const instId =
    instResolved.outcome === "update" ? instResolved.instituicaoId : null;

  const children = await resolveChildrenFromStore(row, instId, store, {
    atoPolicy,
  });

  bumpEntityCounts(impact.processos, children.processo);
  bumpEntityCounts(impact.eventos, children.evento);
  bumpEntityCounts(impact.atos, children.ato);

  if (row.hasDocumento) {
    const f = createInMemoryImportFinders(store);
    const tipoId = row.docTipo ? f.findTipoDocumentoIdByCodigo(row.docTipo) : null;
    const docResolved = await resolveDocumento({
      instituicaoId: instId,
      tipoDocumentoId: tipoId,
      row,
      findExisting: instId && tipoId ? f.findDocumento : undefined,
    });

    if (docResolved.outcome === "unknown_tipo") {
      if (mode === "run") {
        impact.lineRejected = true;
      }
    } else {
      bumpEntityCounts(impact.documentos, toParityBucket(docResolved));
    }
  }

  return impact;
}

export function mergeParityRowImpact(
  target: ParityRowImpact,
  row: ParityRowImpact,
): ParityRowImpact {
  const entities = [
    "instituicoes",
    "processos",
    "atos",
    "eventos",
    "documentos",
  ] as const;
  for (const key of entities) {
    target[key].created += row[key].created;
    target[key].updated += row[key].updated;
  }
  return target;
}

export function instituicaoIdFromResolve(
  result: InstituicaoResolveResult,
): string | null {
  if (result.outcome === "update") return result.instituicaoId;
  if (result.outcome === "create") return null;
  return null;
}

export const PARITY_POLICIES = {
  instRun: INSTITUICAO_MATCH_POLICY_RUN,
  instPreview: INSTITUICAO_MATCH_POLICY_PREVIEW,
  atoRun: ATO_MATCH_POLICY_RUN,
  atoPreview: ATO_MATCH_POLICY_PREVIEW,
} as const;
