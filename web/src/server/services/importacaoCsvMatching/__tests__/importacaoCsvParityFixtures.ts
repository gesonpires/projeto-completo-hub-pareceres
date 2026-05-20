import type { NormalizedImportRow } from "../importRowTypes";

/** CNPJ válido de exemplo (mesmo de normalize.test.ts). */
export const PARITY_VALID_CNPJ = "11222333000181";

export type ParityInstituicao = {
  id: string;
  nomeNormalizado: string;
  municipio: string | null;
  uf: string | null;
  cnpj: string | null;
  deletedAt: Date | null;
};

export type ParityProcesso = {
  id: string;
  instituicaoId: string;
  numero: string | null;
  ano: number | null;
  deletedAt: Date | null;
};

export type ParityAto = {
  id: string;
  instituicaoId: string;
  tipo: NonNullable<NormalizedImportRow["atoTipo"]>;
  dataAto: Date;
  numero: string | null;
  deletedAt: Date | null;
};

export type ParityEvento = {
  id: string;
  instituicaoId: string;
  tipo: NonNullable<NormalizedImportRow["eventoTipo"]>;
  dataEvento: Date;
  descricao: string;
  deletedAt: Date | null;
};

export type ParityDocumento = {
  id: string;
  instituicaoId: string;
  tipoDocumentoId: string;
  titulo: string;
  dataDocumento: Date | null;
  deletedAt: Date | null;
};

export type ParityTipoDocumento = {
  id: string;
  codigo: NonNullable<NormalizedImportRow["docTipo"]>;
};

export type ImportacaoParityStore = {
  instituicoes: ParityInstituicao[];
  processos: ParityProcesso[];
  atos: ParityAto[];
  eventos: ParityEvento[];
  documentos: ParityDocumento[];
  tiposDocumento: ParityTipoDocumento[];
};

export function createEmptyParityStore(): ImportacaoParityStore {
  return {
    instituicoes: [],
    processos: [],
    atos: [],
    eventos: [],
    documentos: [],
    tiposDocumento: [
      { id: "tipo-oficio", codigo: "OFICIO" },
      { id: "tipo-parecer", codigo: "PARECER" },
    ],
  };
}

export function parityRow(
  overrides: Partial<NormalizedImportRow> = {},
): NormalizedImportRow {
  return {
    nome: "Escola Alfa",
    nomeNormalizado: "ESCOLA ALFA",
    cnpjDigits: "",
    municipio: "Florianópolis",
    uf: "SC",
    procNumero: null,
    procAnoRaw: "",
    procAno: null,
    procStatus: "ABERTO",
    procAssunto: null,
    hasProcesso: false,
    atoTipo: null,
    atoNumero: null,
    atoData: null,
    atoEmenta: null,
    atoDescricao: null,
    hasAto: false,
    eventoTipo: null,
    eventoData: null,
    eventoDescricao: null,
    hasEvento: false,
    docTipo: null,
    docData: null,
    docTitulo: null,
    hasDocumento: false,
    ...overrides,
  };
}

/** Linha sem CNPJ alinhada ao seed B1/B2. */
export function parityRowSemCnpj(
  overrides: Partial<NormalizedImportRow> = {},
): NormalizedImportRow {
  return parityRow({
    cnpjDigits: "",
    municipio: "Florianópolis",
    uf: "SC",
    nome: "Escola Alfa",
    nomeNormalizado: "ESCOLA ALFA",
    ...overrides,
  });
}

export function seedInstituicao(
  store: ImportacaoParityStore,
  inst: ParityInstituicao,
): ImportacaoParityStore {
  return {
    ...store,
    instituicoes: [...store.instituicoes, inst],
  };
}

export function seedProcesso(
  store: ImportacaoParityStore,
  proc: ParityProcesso,
): ImportacaoParityStore {
  return {
    ...store,
    processos: [...store.processos, proc],
  };
}

export function seedEvento(
  store: ImportacaoParityStore,
  evt: ParityEvento,
): ImportacaoParityStore {
  return {
    ...store,
    eventos: [...store.eventos, evt],
  };
}

export function seedDocumento(
  store: ImportacaoParityStore,
  doc: ParityDocumento,
): ImportacaoParityStore {
  return {
    ...store,
    documentos: [...store.documentos, doc],
  };
}

export function seedAto(
  store: ImportacaoParityStore,
  ato: ParityAto,
): ImportacaoParityStore {
  return {
    ...store,
    atos: [...store.atos, ato],
  };
}

/** Store sem tipos de documento (para `unknown_tipo`). */
export function createParityStoreWithoutDocTipos(): ImportacaoParityStore {
  return {
    ...createEmptyParityStore(),
    tiposDocumento: [],
  };
}

export const PARITY_ATO_DATA = new Date("2024-01-15T00:00:00.000Z");

/**
 * Ato existente com numero "1"; linha CSV com numero "2" diverge RUN vs PREVIEW.
 */
export function storeAtoNumeroDivergence(instituicaoId = "inst-fixed"): ImportacaoParityStore {
  return seedAto(createEmptyParityStore(), {
    id: "ato-num-1",
    instituicaoId,
    tipo: "PARECER",
    dataAto: PARITY_ATO_DATA,
    numero: "1",
    deletedAt: null,
  });
}

/**
 * Reconciliação manual: auto-match aponta `inst-auto`; RUN pode forçar `inst-recon`.
 */
export function storeReconciliationScenario(): ImportacaoParityStore {
  let store = createEmptyParityStore();
  store = seedInstituicao(store, {
    id: "inst-auto",
    nomeNormalizado: "ESCOLA ALFA",
    municipio: "Florianópolis",
    uf: "SC",
    cnpj: null,
    deletedAt: null,
  });
  store = seedInstituicao(store, {
    id: "inst-recon",
    nomeNormalizado: "ESCOLA OUTRA",
    municipio: "São José",
    uf: "SC",
    cnpj: null,
    deletedAt: null,
  });
  return store;
}

/** B1: único candidato sem CNPJ para a chave da linha. */
export function storeB1SingleSemCnpjCandidate(): ImportacaoParityStore {
  return seedInstituicao(createEmptyParityStore(), {
    id: "inst-b1-only",
    nomeNormalizado: "ESCOLA ALFA",
    municipio: "Florianópolis",
    uf: "SC",
    cnpj: null,
    deletedAt: null,
  });
}

/**
 * B2: dois candidatos na mesma chave; o 2º tem CNPJ (RUN prefere o 2º;
 * PREVIEW `findFirst` retorna o 1º na ordem de inserção).
 */
export function storeB2DualSemCnpjCandidates(): ImportacaoParityStore {
  let store = createEmptyParityStore();
  store = seedInstituicao(store, {
    id: "inst-b2-first",
    nomeNormalizado: "ESCOLA ALFA",
    municipio: "Florianópolis",
    uf: "SC",
    cnpj: null,
    deletedAt: null,
  });
  store = seedInstituicao(store, {
    id: "inst-b2-with-cnpj",
    nomeNormalizado: "ESCOLA ALFA",
    municipio: "Florianópolis",
    uf: "SC",
    cnpj: PARITY_VALID_CNPJ,
    deletedAt: null,
  });
  return store;
}
