import { describe, expect, test } from "vitest";
import {
  getInstituicaoCnpjRejectionMessage,
  normalizeImportRow,
} from "../importacaoCsvMatching/importRowNormalize";

describe("normalizeImportRow", () => {
  test("normaliza instituição e enums de processo", () => {
    const row = normalizeImportRow({
      instituicao_nome: "  Escola Alfa  ",
      instituicao_municipio: "Florianópolis",
      instituicao_uf: "sc",
      processo_status: "em tramitacao",
      processo_ano: "2024",
      processo_numero: "123",
    });
    expect(row.nome).toBe("Escola Alfa");
    expect(row.nomeNormalizado).toBe("ESCOLA ALFA");
    expect(row.municipio).toBe("Florianópolis");
    expect(row.uf).toBe("SC");
    expect(row.procStatus).toBe("EM_TRAMITACAO");
    expect(row.procAno).toBe(2024);
    expect(row.hasProcesso).toBe(true);
  });

  test("ato inválido não marca hasAto", () => {
    const row = normalizeImportRow({
      instituicao_nome: "Escola",
      ato_tipo: "INVALIDO",
      ato_data: "01/01/2024",
    });
    expect(row.atoTipo).toBeNull();
    expect(row.hasAto).toBe(false);
  });

  test("ato válido com data parseada", () => {
    const row = normalizeImportRow({
      instituicao_nome: "Escola",
      ato_tipo: "PARECER",
      ato_data: "2024-01-15",
      ato_numero: "10",
    });
    expect(row.atoTipo).toBe("PARECER");
    expect(row.atoData).toBeInstanceOf(Date);
    expect(row.hasAto).toBe(true);
    expect(row.atoNumero).toBe("10");
  });

  test("documento usa parseTipoDocumento", () => {
    const row = normalizeImportRow({
      instituicao_nome: "Escola",
      documento_tipo: "ofício",
      documento_titulo: "Título",
    });
    expect(row.docTipo).toBe("OFICIO");
    expect(row.hasDocumento).toBe(true);
  });

  test("procAno inválido vira null", () => {
    const row = normalizeImportRow({
      instituicao_nome: "Escola",
      processo_ano: "abc",
      processo_numero: "1",
    });
    expect(row.procAnoRaw).toBe("abc");
    expect(row.procAno).toBeNull();
  });
});

describe("getInstituicaoCnpjRejectionMessage", () => {
  test("aceita vazio", () => {
    expect(getInstituicaoCnpjRejectionMessage("")).toBeNull();
  });

  test("rejeita tamanho incorreto", () => {
    expect(getInstituicaoCnpjRejectionMessage("123")).toContain("14 dígitos");
  });
});
