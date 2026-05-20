export const GLOBAL_SEARCH_RESULT_LIMIT = 25;

export type GlobalSearchTabKey =
  | "instituicoes"
  | "processos"
  | "atos"
  | "eventos"
  | "documentos";

export type GlobalSearchSearchParams = {
  q?: string;
  tab?: string;
};

export type GlobalSearchPermissions = {
  canInst: boolean;
  canProc: boolean;
  canReg: boolean;
  canDocs: boolean;
};

export type ParsedGlobalSearchQuery = {
  qRaw: string;
  tabRaw: string;
  tab: GlobalSearchTabKey;
  ufToken: string;
  qWithoutUf: string;
  qDigits: string;
  cnpjToken: string;
  qIsCnpj: boolean;
  qNorm: string;
  qTerms: string[];
  procNumero: string;
  procAnoOk: number | null;
  qMaybeNumero: string;
  canTextSearch: boolean;
  yearTokenOk: number | null;
  procNumeroToken: string;
  procAnoTokenOk: number | null;
  atoTipoFromQuery: string;
  atoNumeroFromQuery: string;
  docTipoFromQuery: string;
  docTermFromQuery: string;
  hasQuery: boolean;
};

export type GlobalSearchInstituicaoSummary = {
  id: string;
  nome: string;
  cnpj: string | null;
  municipio: string | null;
  uf: string | null;
};

export type GlobalSearchInstituicaoRef = {
  id: string;
  nome: string;
  cnpj: string | null;
  uf: string | null;
  municipio: string | null;
};

export type GlobalSearchProcessoRow = {
  id: string;
  numero: string | null;
  ano: number | null;
  status: string;
  tipo: string | null;
  instituicao: GlobalSearchInstituicaoRef;
};

export type GlobalSearchAtoRow = {
  id: string;
  tipo: string;
  numero: string | null;
  dataAto: Date;
  instituicao: GlobalSearchInstituicaoRef;
};

export type GlobalSearchEventoRow = {
  id: string;
  tipo: string;
  dataEvento: Date;
  descricao: string;
  instituicao: GlobalSearchInstituicaoRef;
};

export type GlobalSearchDocumentoRow = {
  id: string;
  titulo: string;
  dataDocumento: Date | null;
  tipoDocumento: { codigo: string };
  storagePath: string | null;
  instituicao: GlobalSearchInstituicaoRef | null;
};

export type GlobalSearchCounts = Partial<Record<GlobalSearchTabKey, number>>;

export type GlobalSearchResults = {
  instituicoes: GlobalSearchInstituicaoSummary[];
  processos: GlobalSearchProcessoRow[];
  atos: GlobalSearchAtoRow[];
  eventos: GlobalSearchEventoRow[];
  documentos: GlobalSearchDocumentoRow[];
};

export type LoadGlobalSearchResult =
  | {
      status: "ok";
      query: ParsedGlobalSearchQuery;
      effectiveTab: GlobalSearchTabKey;
      counts: GlobalSearchCounts;
      results: GlobalSearchResults;
    }
  | { status: "db_error" };
