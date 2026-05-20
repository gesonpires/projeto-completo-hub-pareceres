/** Linha CSV MVP normalizada (parsers compartilhados entre run e dry-run). */
export type NormalizedImportRow = {
  nome: string;
  nomeNormalizado: string;
  /** Somente dígitos; pode ter comprimento diferente de 14 (validação no run). */
  cnpjDigits: string;
  municipio: string | null;
  uf: string | null;

  procNumero: string | null;
  procAnoRaw: string;
  /** Ano numérico quando `procAnoRaw` é finito; caso contrário `null`. */
  procAno: number | null;
  procStatus: "ABERTO" | "EM_TRAMITACAO" | "CONCLUIDO" | "ARQUIVADO";
  procAssunto: string | null;
  hasProcesso: boolean;

  atoTipo: "PARECER" | "RESOLUCAO" | "PORTARIA" | "OUTRO" | null;
  atoNumero: string | null;
  atoData: Date | null;
  atoEmenta: string | null;
  atoDescricao: string | null;
  hasAto: boolean;

  eventoTipo: "PROTOCOLO" | "DILIGENCIA" | "REUNIAO" | "DECISAO" | "OUTRO" | null;
  eventoData: Date | null;
  eventoDescricao: string | null;
  hasEvento: boolean;

  docTipo: "OFICIO" | "PARECER" | "RESOLUCAO" | "OUTRO" | null;
  docData: Date | null;
  docTitulo: string | null;
  hasDocumento: boolean;
};
