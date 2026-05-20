import { describe, expect, test } from "vitest";
import {
  extractProcessoKeyFromFilename,
  extractRowSourceRefFromFilename,
  extractUuidFromFilename,
} from "../documentoLoteFilenameInference";

describe("documentoLoteFilenameInference", () => {
  test("extrai numero e ano de padrões comuns", () => {
    expect(extractProcessoKeyFromFilename("parecer_123_2026.pdf")).toEqual({
      numero: "123",
      ano: 2026,
    });
    expect(extractProcessoKeyFromFilename("proc_456_2025.txt")).toEqual({
      numero: "456",
      ano: 2025,
    });
  });

  test("extrai numero sem ano", () => {
    expect(extractProcessoKeyFromFilename("processo-789.docx")).toEqual({
      numero: "789",
    });
  });

  test("extrai uuid do nome do arquivo", () => {
    const id = "a1b2c3d4-e5f6-4789-a012-3456789abcde";
    expect(extractUuidFromFilename(`doc-${id}.pdf`)).toBe(id);
  });

  test("extrai row sourceRef", () => {
    expect(extractRowSourceRefFromFilename("lote row:99.pdf")).toBe("row:99");
  });
});
