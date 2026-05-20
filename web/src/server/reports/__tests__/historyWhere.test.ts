import { describe, expect, test } from "vitest";
import { buildReportHistoryWhere, tipoToEvento } from "../historyWhere";

describe("reports history where", () => {
  test("tipoToEvento maps correctly", () => {
    expect(tipoToEvento("")).toBe("GERAR_RELATORIO_PDF");
    expect(tipoToEvento("gerar")).toBe("GERAR_RELATORIO_PDF");
    expect(tipoToEvento("baixar")).toBe("BAIXAR_RELATORIO_PDF");
    expect(tipoToEvento("todos")).toBe("");
  });

  test("buildReportHistoryWhere adds evento + from when present", () => {
    const w = buildReportHistoryWhere({ tipo: "baixar", fromFilter: "hub", entidadeIds: ["a"] });
    expect(w.entidade).toBe("instituicoes");
    expect(w.AND).toEqual([
      { metadata: { path: ["evento"], equals: "BAIXAR_RELATORIO_PDF" } },
      { metadata: { path: ["from"], equals: "hub" } },
    ]);
    // @ts-expect-error - loose typing for prisma where
    expect(w.entidadeId.in).toEqual(["a"]);
  });

  test("buildReportHistoryWhere omits evento when tipo=todos", () => {
    const w = buildReportHistoryWhere({ tipo: "todos", fromFilter: "" });
    expect(w.AND).toEqual([]);
  });

  test("buildReportHistoryWhere adds actor OR only when ids not resolved", () => {
    const w = buildReportHistoryWhere({
      tipo: "",
      qRaw: "admin@",
      entidadeIds: null,
      idsResolved: false,
    });
    // @ts-expect-error - loose typing for prisma where
    expect(w.OR.length).toBe(2);
  });
});

