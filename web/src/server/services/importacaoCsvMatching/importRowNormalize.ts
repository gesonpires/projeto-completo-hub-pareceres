import { digitsOnly, isValidCnpj, normalizeMunicipio, normalizeName, normalizeUf } from "../../normalize";
import {
  asString,
  parseAtoTipo,
  parseDateMaybe,
  parseEventoTipo,
  parseStatus,
  parseTipoDocumento,
  type CsvMvpRow,
} from "../../imports/csvMvpCore";
import type { NormalizedImportRow } from "./importRowTypes";

export type { NormalizedImportRow } from "./importRowTypes";

export function normalizeImportRow(row: CsvMvpRow): NormalizedImportRow {
  const nome = asString(row.instituicao_nome);
  const municipioRaw = asString(row.instituicao_municipio);
  const ufRaw = asString(row.instituicao_uf);
  const municipio = municipioRaw ? normalizeMunicipio(municipioRaw) : null;
  const uf = ufRaw ? normalizeUf(ufRaw) || null : null;

  const procNumero = asString(row.processo_numero) || null;
  const procAnoRaw = asString(row.processo_ano);
  const procAnoParsed = procAnoRaw ? Number(procAnoRaw) : null;
  const procAno =
    procAnoParsed !== null && Number.isFinite(procAnoParsed) ? procAnoParsed : null;
  const procAssunto = asString(row.processo_assunto) || null;
  const procStatus = parseStatus(asString(row.processo_status)) ?? "ABERTO";

  const atoTipoRaw = asString(row.ato_tipo);
  const atoTipo = atoTipoRaw ? parseAtoTipo(atoTipoRaw) : null;
  const atoData = parseDateMaybe(asString(row.ato_data));

  const eventoTipoRaw = asString(row.evento_tipo);
  const eventoTipo = eventoTipoRaw ? parseEventoTipo(eventoTipoRaw) : null;
  const eventoData = parseDateMaybe(asString(row.evento_data));
  const eventoDescricao = asString(row.evento_descricao) || null;

  const docTipoRaw = asString(row.documento_tipo);
  const docTipo = docTipoRaw ? parseTipoDocumento(docTipoRaw) : null;
  const docData = parseDateMaybe(asString(row.documento_data));
  const docTitulo = asString(row.documento_titulo) || null;

  return {
    nome,
    nomeNormalizado: normalizeName(nome),
    cnpjDigits: digitsOnly(asString(row.instituicao_cnpj)),
    municipio,
    uf,

    procNumero,
    procAnoRaw,
    procAno,
    procStatus,
    procAssunto,
    hasProcesso: Boolean(procNumero || procAnoRaw || procAssunto),

    atoTipo,
    atoNumero: asString(row.ato_numero) || null,
    atoData,
    atoEmenta: asString(row.ato_ementa) || null,
    atoDescricao: asString(row.ato_descricao) || null,
    hasAto: Boolean(atoTipo && atoData),

    eventoTipo,
    eventoData,
    eventoDescricao,
    hasEvento: Boolean(eventoTipo && eventoData && eventoDescricao),

    docTipo,
    docData,
    docTitulo,
    hasDocumento: Boolean(docTipo && docTitulo),
  };
}

/** Mensagem de rejeição de CNPJ no run (null = aceito ou vazio). */
export function getInstituicaoCnpjRejectionMessage(cnpjDigits: string): string | null {
  if (!cnpjDigits) return null;
  if (cnpjDigits.length !== 14) {
    return "instituicao_cnpj inválido (precisa 14 dígitos)";
  }
  if (!isValidCnpj(cnpjDigits)) {
    return "instituicao_cnpj inválido (dígitos verificadores)";
  }
  return null;
}
