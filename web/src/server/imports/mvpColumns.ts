export const MVP_IMPORT_COLUMNS = [
  "instituicao_nome",
  "instituicao_cnpj",
  "instituicao_municipio",
  "instituicao_uf",
  "processo_numero",
  "processo_ano",
  "processo_status",
  "processo_assunto",
  "ato_tipo",
  "ato_numero",
  "ato_data",
  "ato_ementa",
  "ato_descricao",
  "evento_tipo",
  "evento_data",
  "evento_descricao",
  "documento_tipo",
  "documento_data",
  "documento_titulo",
] as const;

export type MvpImportColumn = (typeof MVP_IMPORT_COLUMNS)[number];

export const MVP_IMPORT_CRITICAL_COLUMNS: MvpImportColumn[] = ["instituicao_nome"];

