/** CNPJ válido (mesmo dos testes unitários de paridade). */
export const INTEGRATION_CNPJ_A = "11222333000181";

/** CNPJ do candidato preferido no cenário B2 (desempate RUN `findMany`). */
export const INTEGRATION_CNPJ_B2 = INTEGRATION_CNPJ_A;

/** Segundo CNPJ válido para cenários isolados. */
export const INTEGRATION_CNPJ_C = "11444777000161";

/** CNPJ válido para cenário com filhos regulatórios (ato/evento/documento). */
export const INTEGRATION_CNPJ_D = "11555777000139";

/** CNPJ da linha 1 do cenário multi-linha (instituição nova isolada). */
export const INTEGRATION_CNPJ_MULTI = "11777888000190";

/** CNPJ da linha válida no cenário multi-linha com rejeição parcial. */
export const INTEGRATION_CNPJ_MULTI_OK = "11888999000173";

/** CNPJ da linha 1 do cenário 3+ linhas (create válido). */
export const INTEGRATION_CNPJ_TRIPLE_OK = "11999000000163";

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildImportCsv(
  headers: string[],
  rows: Array<Record<string, string>>,
): string {
  const headerLine = headers.join(",");
  const lines = rows.map((row) =>
    headers.map((h) => escapeCsvCell(row[h] ?? "")).join(","),
  );
  return [headerLine, ...lines].join("\n");
}

/** Cenário A: instituição nova com CNPJ + processo. */
export function csvNovoCnpjComProcesso(): string {
  return buildImportCsv(
    [
      "instituicao_nome",
      "instituicao_cnpj",
      "instituicao_municipio",
      "instituicao_uf",
      "processo_numero",
      "processo_ano",
      "processo_assunto",
    ],
    [
      {
        instituicao_nome: "Escola Integração Smoke",
        instituicao_cnpj: "11.222.333/0001-81",
        instituicao_municipio: "Florianópolis",
        instituicao_uf: "SC",
        processo_numero: "PROC-SMOKE-001",
        processo_ano: "2024",
        processo_assunto: "Assunto inicial",
      },
    ],
  );
}

/** Cenário B: mesma chave de instituição/processo, dados alterados (update). */
export function csvReimportacaoUpdate(): string {
  return buildImportCsv(
    [
      "instituicao_nome",
      "instituicao_cnpj",
      "instituicao_municipio",
      "instituicao_uf",
      "processo_numero",
      "processo_ano",
      "processo_assunto",
      "processo_status",
    ],
    [
      {
        instituicao_nome: "Escola Integração Smoke Atualizada",
        instituicao_cnpj: INTEGRATION_CNPJ_A,
        instituicao_municipio: "São José",
        instituicao_uf: "SC",
        processo_numero: "PROC-SMOKE-001",
        processo_ano: "2024",
        processo_assunto: "Assunto revisado",
        processo_status: "EM_TRAMITACAO",
      },
    ],
  );
}

/**
 * Cenário D: instituição nova + ato + evento + documento válidos na mesma linha.
 * Requer `TipoDocumento` com código OFICIO no seed (default de `seedIntegrationMinimal`).
 */
export function csvAtoEventoDocumentoValidos(): string {
  return buildImportCsv(
    [
      "instituicao_nome",
      "instituicao_cnpj",
      "instituicao_municipio",
      "instituicao_uf",
      "ato_tipo",
      "ato_numero",
      "ato_data",
      "ato_ementa",
      "evento_tipo",
      "evento_data",
      "evento_descricao",
      "documento_tipo",
      "documento_titulo",
      "documento_data",
    ],
    [
      {
        instituicao_nome: "Escola Filhos Regulatórios",
        instituicao_cnpj: "11.555.777/0001-39",
        instituicao_municipio: "Florianópolis",
        instituicao_uf: "SC",
        ato_tipo: "PARECER",
        ato_numero: "PRC-2024-01",
        ato_data: "2024-03-15",
        ato_ementa: "Ementa do parecer smoke",
        evento_tipo: "PROTOCOLO",
        evento_data: "2024-03-16",
        evento_descricao: "Protocolo de integração",
        documento_tipo: "OFICIO",
        documento_titulo: "Ofício smoke integração",
        documento_data: "2024-03-17",
      },
    ],
  );
}

/**
 * Cenário D′: reimportação da mesma linha rica do cenário D (mesmas chaves de match).
 * Altera apenas campos atualizáveis no run: nome/município da instituição, ementa/descrição do ato.
 * Mantém ato_tipo/ato_numero/ato_data, evento_tipo/evento_data/evento_descricao e
 * documento_tipo/documento_titulo/documento_data para idempotência por chave.
 */
export function csvAtoEventoDocumentoReimportacao(): string {
  return buildImportCsv(
    [
      "instituicao_nome",
      "instituicao_cnpj",
      "instituicao_municipio",
      "instituicao_uf",
      "ato_tipo",
      "ato_numero",
      "ato_data",
      "ato_ementa",
      "ato_descricao",
      "evento_tipo",
      "evento_data",
      "evento_descricao",
      "documento_tipo",
      "documento_titulo",
      "documento_data",
    ],
    [
      {
        instituicao_nome: "Escola Filhos Regulatórios Revisada",
        instituicao_cnpj: INTEGRATION_CNPJ_D,
        instituicao_municipio: "São José",
        instituicao_uf: "SC",
        ato_tipo: "PARECER",
        ato_numero: "PRC-2024-01",
        ato_data: "2024-03-15",
        ato_ementa: "Ementa revisada na reimportação",
        ato_descricao: "Descrição revisada do parecer",
        evento_tipo: "PROTOCOLO",
        evento_data: "2024-03-16",
        evento_descricao: "Protocolo de integração",
        documento_tipo: "OFICIO",
        documento_titulo: "Ofício smoke integração",
        documento_data: "2024-03-17",
      },
    ],
  );
}

/**
 * Cenário B2: linha sem CNPJ na mesma chave de dois candidatos seedados.
 * O run deve atualizar o candidato com CNPJ, não o primeiro sem CNPJ.
 */
export function csvB2SemCnpjMesmaChave(): string {
  return buildImportCsv(
    ["instituicao_nome", "instituicao_municipio", "instituicao_uf"],
    [
      {
        instituicao_nome: "Escola Alfa Atualizada B2",
        instituicao_municipio: "Florianópolis",
        instituicao_uf: "SC",
      },
    ],
  );
}

/**
 * Cenário E: linha sem CNPJ que casa com o candidato auto-match (nome + município + UF).
 * O run deve aplicar `reconciliacoes[2]` à instituição canônica, não à candidata.
 */
export function csvReconciliacaoManualSemCnpj(): string {
  return buildImportCsv(
    ["instituicao_nome", "instituicao_municipio", "instituicao_uf"],
    [
      {
        instituicao_nome: "Escola Alfa",
        instituicao_municipio: "Florianópolis",
        instituicao_uf: "SC",
      },
    ],
  );
}

/**
 * Cenário E + filhos: mesma chave do cenário E + processo e ato na linha.
 * Com `reconciliacoes`, filhos devem vincular à instituição canônica, não à candidata.
 */
export function csvReconciliacaoManualComFilhos(): string {
  return buildImportCsv(
    [
      "instituicao_nome",
      "instituicao_municipio",
      "instituicao_uf",
      "processo_numero",
      "processo_ano",
      "processo_assunto",
      "ato_tipo",
      "ato_numero",
      "ato_data",
      "ato_ementa",
    ],
    [
      {
        instituicao_nome: "Escola Alfa",
        instituicao_municipio: "Florianópolis",
        instituicao_uf: "SC",
        processo_numero: "PROC-RECON-001",
        processo_ano: "2024",
        processo_assunto: "Processo pós-reconciliação",
        ato_tipo: "PARECER",
        ato_numero: "ATOR-RECON-01",
        ato_data: "2024-04-01",
        ato_ementa: "Ementa ato reconciliado",
      },
    ],
  );
}

/** Mapa `reconciliacoes` para a única linha de dados (rowNumber 2, após o header). */
export function reconciliacoesLinha2(
  instituicaoId: string,
): Record<number, string> {
  return { 2: instituicaoId };
}

/**
 * Cenário multi-linha:
 * - linha 2 (rowNumber 2): CNPJ novo + processo (create isolado);
 * - linha 3 (rowNumber 3): sem CNPJ + reconciliacoes[3] → canônica (não afeta linha 1).
 * Requer `seedReconciliationCandidates()` antes do run.
 */
export function csvMultiLinhaNovoCnpjEReconciliacao(): string {
  const headers = [
    "instituicao_nome",
    "instituicao_cnpj",
    "instituicao_municipio",
    "instituicao_uf",
    "processo_numero",
    "processo_ano",
    "processo_assunto",
  ];
  return buildImportCsv(headers, [
    {
      instituicao_nome: "Escola Multi Linha A",
      instituicao_cnpj: "11.777.888/0001-90",
      instituicao_municipio: "Florianópolis",
      instituicao_uf: "SC",
      processo_numero: "PROC-MULTI-01",
      processo_ano: "2024",
      processo_assunto: "Assunto linha 1",
    },
    {
      instituicao_nome: "Escola Alfa",
      instituicao_cnpj: "",
      instituicao_municipio: "Florianópolis",
      instituicao_uf: "SC",
      processo_numero: "",
      processo_ano: "",
      processo_assunto: "",
    },
  ]);
}

/** Mapa `reconciliacoes` por rowNumber (chave = linha do CSV, base 1 + header). */
export function reconciliacoesPorLinhas(
  entries: Record<number, string>,
): Record<number, string> {
  return entries;
}

/**
 * Multi-linha com rejeição parcial:
 * - linha 2: CNPJ novo + processo (válida);
 * - linha 3: CNPJ distinto + documento PARECER não seedado → rejected, instituição gravada.
 */
export function csvMultiLinhaValidaERejeicaoUnknownTipo(): string {
  const headers = [
    "instituicao_nome",
    "instituicao_cnpj",
    "instituicao_municipio",
    "instituicao_uf",
    "processo_numero",
    "processo_ano",
    "processo_assunto",
    "documento_tipo",
    "documento_titulo",
    "documento_data",
  ];
  return buildImportCsv(headers, [
    {
      instituicao_nome: "Escola Multi Válida",
      instituicao_cnpj: "11.888.999/0001-73",
      instituicao_municipio: "Florianópolis",
      instituicao_uf: "SC",
      processo_numero: "PROC-MULTI-OK",
      processo_ano: "2024",
      processo_assunto: "Linha válida",
      documento_tipo: "",
      documento_titulo: "",
      documento_data: "",
    },
    {
      instituicao_nome: "Escola Multi Rejeitada",
      instituicao_cnpj: "11.444.777/0001-61",
      instituicao_municipio: "Florianópolis",
      instituicao_uf: "SC",
      processo_numero: "",
      processo_ano: "",
      processo_assunto: "",
      documento_tipo: "PARECER",
      documento_titulo: "Parecer tipo ausente",
      documento_data: "2024-06-15",
    },
  ]);
}

/**
 * Cenário 3+ linhas no mesmo lote:
 * - row 2: CNPJ novo + processo (válida);
 * - row 3: sem CNPJ + reconciliacoes[3] → canônica;
 * - row 4: CNPJ distinto + documento PARECER não seedado (rejeição parcial).
 * Requer `seedReconciliationCandidates()`.
 */
export function csvMultiLinhaTresComportamentos(): string {
  const headers = [
    "instituicao_nome",
    "instituicao_cnpj",
    "instituicao_municipio",
    "instituicao_uf",
    "processo_numero",
    "processo_ano",
    "processo_assunto",
    "documento_tipo",
    "documento_titulo",
    "documento_data",
  ];
  return buildImportCsv(headers, [
    {
      instituicao_nome: "Escola Três Linhas Válida",
      instituicao_cnpj: "11.999.000/0001-63",
      instituicao_municipio: "Florianópolis",
      instituicao_uf: "SC",
      processo_numero: "PROC-TRIPLE-01",
      processo_ano: "2024",
      processo_assunto: "Linha 1 válida",
      documento_tipo: "",
      documento_titulo: "",
      documento_data: "",
    },
    {
      instituicao_nome: "Escola Alfa",
      instituicao_cnpj: "",
      instituicao_municipio: "Florianópolis",
      instituicao_uf: "SC",
      processo_numero: "",
      processo_ano: "",
      processo_assunto: "",
      documento_tipo: "",
      documento_titulo: "",
      documento_data: "",
    },
    {
      instituicao_nome: "Escola Três Linhas Rejeitada",
      instituicao_cnpj: "11.444.777/0001-61",
      instituicao_municipio: "Florianópolis",
      instituicao_uf: "SC",
      processo_numero: "",
      processo_ano: "",
      processo_assunto: "",
      documento_tipo: "PARECER",
      documento_titulo: "Parecer sem tipo cadastrado",
      documento_data: "2024-07-01",
    },
  ]);
}

/** Cenário C: documento_tipo válido no parse, mas ausente no banco (PARECER não seedado). */
export function csvDocumentoTipoNaoCadastrado(): string {
  return buildImportCsv(
    [
      "instituicao_nome",
      "instituicao_cnpj",
      "instituicao_municipio",
      "instituicao_uf",
      "documento_tipo",
      "documento_titulo",
      "documento_data",
    ],
    [
      {
        instituicao_nome: "Escola Doc Tipo Pendente",
        instituicao_cnpj: "11.444.777/0001-61",
        instituicao_municipio: "Florianópolis",
        instituicao_uf: "SC",
        documento_tipo: "PARECER",
        documento_titulo: "Parecer sem tipo no sistema",
        documento_data: "2024-06-01",
      },
    ],
  );
}
