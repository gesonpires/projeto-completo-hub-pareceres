import { describe, expect, test } from "vitest";
import { z } from "zod";
import { firstZodIssueMessage } from "../instituicaoMutationsValidation";
import { validateOptionalCnpj } from "../mutationCnpjValidation";
import { CreateEventoSchema } from "../instituicaoMutationsSchemas";

describe("mutationCnpjValidation", () => {
  test("aceita CNPJ vazio ou omitido", () => {
    expect(validateOptionalCnpj()).toEqual({ ok: true, cnpj: null });
    expect(validateOptionalCnpj("")).toEqual({ ok: true, cnpj: null });
  });

  test("rejeita CNPJ com quantidade de dígitos inválida", () => {
    const r = validateOptionalCnpj("12.345.678/0001");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("14 dígitos");
    }
  });

  test("rejeita CNPJ com dígitos verificadores inválidos", () => {
    const r = validateOptionalCnpj("11.111.111/1111-11");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("verificadores");
    }
  });

  test("normaliza CNPJ válido para 14 dígitos", () => {
    expect(validateOptionalCnpj("11.222.333/0001-81")).toEqual({
      ok: true,
      cnpj: "11222333000181",
    });
  });
});

describe("instituicaoMutationsValidation", () => {

  test("mapeia campo descricao em mensagem amigável", () => {
    const parsed = CreateEventoSchema.safeParse({
      instituicaoId: "00000000-0000-4000-8000-000000000001",
      tipo: "PROTOCOLO",
      dataEvento: "2024-01-01",
      descricao: "ab",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(firstZodIssueMessage(parsed.error)).toBe("Descrição está muito curto.");
    }
  });

  test("retorna mensagem genérica sem campo conhecido", () => {
    const err = z.object({ foo: z.string().min(5) }).safeParse({ foo: "x" });
    expect(err.success).toBe(false);
    if (!err.success) {
      expect(firstZodIssueMessage(err.error)).toBe("Dados inválidos.");
    }
  });
});
