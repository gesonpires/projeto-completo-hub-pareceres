import { parse } from "csv-parse/sync";
import { digitsOnly, isValidCnpj, normalizeMunicipio, normalizeName, normalizeUf } from "../normalize";

export type CsvMvpRow = {
  instituicao_nome?: string;
  instituicao_cnpj?: string;
  instituicao_municipio?: string;
  instituicao_uf?: string;
  processo_numero?: string;
  processo_ano?: string;
  processo_status?: string;
  processo_assunto?: string;
  ato_tipo?: string;
  ato_numero?: string;
  ato_data?: string;
  ato_ementa?: string;
  ato_descricao?: string;
  evento_tipo?: string;
  evento_data?: string;
  evento_descricao?: string;
  documento_tipo?: string;
  documento_data?: string;
  documento_titulo?: string;
};

export type ImportPreview = {
  sample: Array<{ rowNumber: number; data: CsvMvpRow }>;
  errors: Array<{ rowNumber: number; message: string }>;
};

export type ReconKey = {
  rowNumber: number;
  nome: string;
  nomeNormalizado: string;
  municipio?: string;
  uf?: string;
};

export function asString(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

export function parseStatus(raw: string) {
  const v = raw.trim().toUpperCase();
  if (v === "ABERTO") return "ABERTO";
  if (v === "EM_TRAMITACAO" || v === "EM TRAMITACAO") return "EM_TRAMITACAO";
  if (v === "CONCLUIDO" || v === "CONCLUÍDO") return "CONCLUIDO";
  if (v === "ARQUIVADO") return "ARQUIVADO";
  return null;
}

export function parseDateMaybe(raw: string): Date | null {
  const v = raw.trim();
  if (!v) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
    const d = new Date(v);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  let m = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/.exec(v);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    if (yyyy < 1900 || yyyy > 2100) return null;
    if (mm < 1 || mm > 12) return null;
    if (dd < 1 || dd > 31) return null;
    const iso = `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}T00:00:00Z`;
    const d = new Date(iso);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  m = /^(\d{2})(\d{2})(\d{4})$/.exec(v.replace(/\s+/g, ""));
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    if (yyyy < 1900 || yyyy > 2100) return null;
    if (mm < 1 || mm > 12) return null;
    if (dd < 1 || dd > 31) return null;
    const iso = `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}T00:00:00Z`;
    const d = new Date(iso);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  return null;
}

export function parseAtoTipo(raw: string) {
  const v = raw.trim().toUpperCase();
  if (v === "PARECER") return "PARECER";
  if (v === "RESOLUCAO" || v === "RESOLUÇÃO") return "RESOLUCAO";
  if (v === "PORTARIA") return "PORTARIA";
  if (v === "OUTRO") return "OUTRO";
  return null;
}

export function parseEventoTipo(raw: string) {
  const v = raw.trim().toUpperCase();
  if (v === "PROTOCOLO") return "PROTOCOLO";
  if (v === "DILIGENCIA" || v === "DILIGÊNCIA") return "DILIGENCIA";
  if (v === "REUNIAO" || v === "REUNIÃO") return "REUNIAO";
  if (v === "DECISAO" || v === "DECISÃO") return "DECISAO";
  if (v === "OUTRO") return "OUTRO";
  return null;
}

export function parseTipoDocumento(raw: string) {
  const v = raw.trim().toUpperCase();
  if (v === "OFICIO" || v === "OFÍCIO") return "OFICIO";
  if (v === "PARECER") return "PARECER";
  if (v === "RESOLUCAO" || v === "RESOLUÇÃO") return "RESOLUCAO";
  if (v === "OUTRO") return "OUTRO";
  return null;
}

export function sniffDelimiter(csvText: string): "," | ";" {
  const firstLine = csvText.split(/\r?\n/, 1)[0] ?? "";
  const commas = (firstLine.match(/,/g) ?? []).length;
  const semis = (firstLine.match(/;/g) ?? []).length;
  return semis > commas ? ";" : ",";
}

export function parseCsvSafe(csvText: string) {
  const delimiter = sniffDelimiter(csvText);
  try {
    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      relax_column_count: true,
      relax_quotes: true,
      trim: true,
      delimiter,
    }) as CsvMvpRow[];
    return { records, delimiter, error: null as null | string };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { records: [] as CsvMvpRow[], delimiter, error: msg };
  }
}

export function previewCsvMvp(csvText: string, limit = 20): ImportPreview {
  const { records, error, delimiter } = parseCsvSafe(csvText);

  const sample = records.slice(0, limit).map((data, idx) => ({
    rowNumber: idx + 2,
    data,
  }));

  const errors: ImportPreview["errors"] = [];
  if (error) {
    errors.push({
      rowNumber: 1,
      message:
        `Falha ao ler CSV (delimitador '${delimiter}'): ${error}. ` +
        "Tente salvar como CSV UTF-8 e use delimitador ';' ou ','.",
    });
    return { sample: [], errors };
  }

  const seenCnpj = new Map<string, number>();
  const seenKeyNoCnpj = new Map<string, number>();

  for (let i = 0; i < Math.min(records.length, 2000); i++) {
    const rowNumber = i + 2;
    const nome = asString(records[i].instituicao_nome);
    if (!nome) errors.push({ rowNumber, message: "instituicao_nome é obrigatório" });

    const cnpj = digitsOnly(asString(records[i].instituicao_cnpj));
    if (cnpj && cnpj.length !== 14) {
      errors.push({ rowNumber, message: "instituicao_cnpj deve ter 14 dígitos (ou vazio)" });
    }
    if (cnpj && cnpj.length === 14 && !isValidCnpj(cnpj)) {
      errors.push({ rowNumber, message: "instituicao_cnpj inválido (dígitos verificadores)" });
    }

    if (cnpj && cnpj.length === 14 && isValidCnpj(cnpj)) {
      const first = seenCnpj.get(cnpj);
      if (first) {
        errors.push({
          rowNumber,
          message: `CNPJ duplicado no arquivo (primeira ocorrência na linha ${first}).`,
        });
      } else {
        seenCnpj.set(cnpj, rowNumber);
      }
    } else if (nome) {
      const municipioRaw = asString(records[i].instituicao_municipio);
      const ufRaw = asString(records[i].instituicao_uf);
      const municipio = municipioRaw ? normalizeMunicipio(municipioRaw).toLowerCase() : "";
      const uf = ufRaw ? normalizeUf(ufRaw).toUpperCase() : "";
      const key = `${normalizeName(nome)}|${municipio}|${uf}`;
      const first = seenKeyNoCnpj.get(key);
      if (first) {
        errors.push({
          rowNumber,
          message: `Instituição duplicada no arquivo (sem CNPJ) (primeira ocorrência na linha ${first}).`,
        });
      } else {
        seenKeyNoCnpj.set(key, rowNumber);
      }
    }

    const atoTipoRaw = asString(records[i].ato_tipo);
    const atoDataRaw = asString(records[i].ato_data);
    if (atoTipoRaw && !parseAtoTipo(atoTipoRaw)) {
      errors.push({ rowNumber, message: "ato_tipo inválido (PARECER/RESOLUCAO/PORTARIA/OUTRO)" });
    }
    if (atoDataRaw && !parseDateMaybe(atoDataRaw)) {
      errors.push({ rowNumber, message: "ato_data inválida (dd/mm/aaaa ou yyyy-mm-dd)" });
    }
    if (atoTipoRaw && !atoDataRaw) {
      errors.push({ rowNumber, message: "ato_data é obrigatório quando ato_tipo é informado" });
    }
    if (atoDataRaw && !atoTipoRaw) {
      errors.push({ rowNumber, message: "ato_tipo é obrigatório quando ato_data é informado" });
    }

    const eventoTipoRaw = asString(records[i].evento_tipo);
    const eventoDataRaw = asString(records[i].evento_data);
    if (eventoTipoRaw && !parseEventoTipo(eventoTipoRaw)) {
      errors.push({ rowNumber, message: "evento_tipo inválido (PROTOCOLO/DILIGENCIA/REUNIAO/DECISAO/OUTRO)" });
    }
    if (eventoDataRaw && !parseDateMaybe(eventoDataRaw)) {
      errors.push({ rowNumber, message: "evento_data inválida (dd/mm/aaaa ou yyyy-mm-dd)" });
    }
    const eventoDescRaw = asString(records[i].evento_descricao);
    if (eventoTipoRaw && !eventoDataRaw) {
      errors.push({ rowNumber, message: "evento_data é obrigatório quando evento_tipo é informado" });
    }
    if (eventoTipoRaw && !eventoDescRaw) {
      errors.push({ rowNumber, message: "evento_descricao é obrigatório quando evento_tipo é informado" });
    }
    if (eventoDataRaw && !eventoTipoRaw) {
      errors.push({ rowNumber, message: "evento_tipo é obrigatório quando evento_data é informado" });
    }
    if (eventoDescRaw && !eventoTipoRaw) {
      errors.push({ rowNumber, message: "evento_tipo é obrigatório quando evento_descricao é informado" });
    }

    const docTipoRaw = asString(records[i].documento_tipo);
    const docDataRaw = asString(records[i].documento_data);
    if (docTipoRaw && !parseTipoDocumento(docTipoRaw)) {
      errors.push({ rowNumber, message: "documento_tipo inválido (OFICIO/PARECER/RESOLUCAO/OUTRO)" });
    }
    if (docDataRaw && !parseDateMaybe(docDataRaw)) {
      errors.push({ rowNumber, message: "documento_data inválida (dd/mm/aaaa ou yyyy-mm-dd)" });
    }
    const docTituloRaw = asString(records[i].documento_titulo);
    if (docTipoRaw && !docTituloRaw) {
      errors.push({ rowNumber, message: "documento_titulo é obrigatório quando documento_tipo é informado" });
    }
    if (docTituloRaw && !docTipoRaw) {
      errors.push({ rowNumber, message: "documento_tipo é obrigatório quando documento_titulo é informado" });
    }
  }

  return { sample, errors };
}

export function listReconKeysCsvMvp(csvText: string, limitRows = 200): ReconKey[] {
  const { records, error } = parseCsvSafe(csvText);
  if (error) return [];

  const out: ReconKey[] = [];
  for (let i = 0; i < Math.min(records.length, limitRows); i++) {
    const rowNumber = i + 2;
    const r = records[i];
    const nome = asString(r.instituicao_nome);
    if (!nome) continue;
    const cnpjDigits = digitsOnly(asString(r.instituicao_cnpj));
    if (cnpjDigits) continue;

    const nomeNormalizado = normalizeName(nome);
    const municipioRaw = asString(r.instituicao_municipio);
    const ufRaw = asString(r.instituicao_uf);
    const municipio = municipioRaw ? normalizeMunicipio(municipioRaw) : "";
    const uf = ufRaw ? normalizeUf(ufRaw) : "";

    out.push({
      rowNumber,
      nome,
      nomeNormalizado,
      municipio: municipio || undefined,
      uf: uf || undefined,
    });
  }
  return out;
}

