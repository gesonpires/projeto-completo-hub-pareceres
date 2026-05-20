import { describe, expect, test } from "vitest";
import {
  digitsOnly,
  formatCnpj,
  isValidCnpj,
  normalizeMunicipio,
  normalizeName,
  normalizeUf,
} from "../normalize";

describe("normalize", () => {
  test("digitsOnly", () => {
    expect(digitsOnly("12.345-6")).toBe("123456");
  });

  test("normalizeMunicipio trims and collapses spaces", () => {
    expect(normalizeMunicipio("  Rio   do  Sul  ")).toBe("Rio do Sul");
  });

  test("normalizeUf returns 2-letter UF or empty", () => {
    expect(normalizeUf("sc")).toBe("SC");
    expect(normalizeUf("s")).toBe("");
    expect(normalizeUf("SC ")).toBe("SC");
    expect(normalizeUf("S/C")).toBe("SC");
  });

  test("normalizeName removes accents and uppercases", () => {
    expect(normalizeName("São José")).toBe("SAO JOSE");
  });

  test("CNPJ validation and formatting", () => {
    const cnpj = "11222333000181"; // CNPJ válido de exemplo
    expect(isValidCnpj(cnpj)).toBe(true);
    expect(formatCnpj(cnpj)).toBe("11.222.333/0001-81");
    expect(isValidCnpj("00000000000000")).toBe(false);
  });
});

