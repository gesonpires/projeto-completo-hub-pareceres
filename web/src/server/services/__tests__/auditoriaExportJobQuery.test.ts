import { describe, expect, test } from "vitest";
import {
  clampAuditoriaExportLimit,
  parseAuditoriaExportFiltros,
  parseAuditoriaExportFormat,
} from "../auditoriaExportJobQuery";

describe("auditoriaExportJobQuery", () => {
  test("normaliza filtros vazios para null", () => {
    expect(parseAuditoriaExportFiltros({})).toEqual({
      entidade: null,
      user: null,
      de: null,
      ate: null,
    });
  });

  test("parseia formato JSON ou CSV", () => {
    expect(parseAuditoriaExportFormat("json")).toBe("JSON");
    expect(parseAuditoriaExportFormat("csv")).toBe("CSV");
    expect(parseAuditoriaExportFormat(undefined)).toBe("CSV");
  });

  test("limita export entre 1 e o teto informado", () => {
    expect(clampAuditoriaExportLimit("999999", 50000)).toBe(50000);
    expect(clampAuditoriaExportLimit("100", 200000, 50000)).toBe(100);
    expect(clampAuditoriaExportLimit("", 200000, 50000)).toBe(50000);
  });
});
