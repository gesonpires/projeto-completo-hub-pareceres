import { describe, expect, test } from "vitest";
import { previewCsvMvp } from "../csvMvpCore";

describe("csvMvp preview", () => {
  test("detects duplicate CNPJ rows", () => {
    const csv = [
      "instituicao_nome,instituicao_cnpj",
      "Escola A,11.222.333/0001-81",
      "Escola B,11222333000181",
    ].join("\n");
    const res = previewCsvMvp(csv, 20);
    expect(res.errors.some((e) => e.message.includes("CNPJ duplicado"))).toBe(true);
  });

  test("detects duplicate institution without CNPJ", () => {
    const csv = [
      "instituicao_nome,instituicao_municipio,instituicao_uf",
      "Escola X,Florianópolis,sc",
      "Escola X,  Florianópolis  ,SC",
    ].join("\n");
    const res = previewCsvMvp(csv, 20);
    expect(res.errors.some((e) => e.message.includes("Instituição duplicada"))).toBe(true);
  });

  test("validates extended columns when present", () => {
    const csv = [
      "instituicao_nome,ato_tipo,ato_data,evento_tipo,evento_data,evento_descricao,documento_tipo,documento_data,documento_titulo",
      "Escola A,INVALIDO,32/13/2024,PROTOCOLO,01/01/2024,Ok,OFICIO,2024-01-01,Doc 1",
    ].join("\n");
    const res = previewCsvMvp(csv, 20);
    expect(res.errors.some((e) => e.message.includes("ato_tipo inválido"))).toBe(true);
    expect(res.errors.some((e) => e.message.includes("ato_data inválida"))).toBe(true);
  });
});

