import { describe, expect, test } from "vitest";
import { parseBatchIdsJson } from "../reconciliacaoAjustesUtils";

describe("reconciliacaoAjustesUtils", () => {
  test("parseia array JSON de ids únicos com limite", () => {
    const ids = Array.from({ length: 600 }, (_, i) => `id-${i}`);
    const result = parseBatchIdsJson(JSON.stringify(ids), "vazio");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ids).toHaveLength(500);
      expect(result.ids[0]).toBe("id-0");
    }
  });

  test("deduplica ids", () => {
    const result = parseBatchIdsJson(
      JSON.stringify(["a", "a", "b"]),
      "Selecione ao menos 1.",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ids).toEqual(["a", "b"]);
    }
  });

  test("retorna erro quando lista vazia", () => {
    const result = parseBatchIdsJson("[]", "Selecione ao menos 1 instituição.");
    expect(result).toEqual({ ok: false, error: "Selecione ao menos 1 instituição." });
  });

  test("ignora JSON inválido como lista vazia", () => {
    const result = parseBatchIdsJson("not-json", "Selecione ao menos 1 processo.");
    expect(result).toEqual({ ok: false, error: "Selecione ao menos 1 processo." });
  });
});
