import { describe, expect, test } from "vitest";
import {
  buildInstitutionDetailReturnTo,
  parseInstitutionDetailQuery,
} from "../institutionDetailQuery";
import { INSTITUTION_DETAIL_DEFAULT_LIMIT } from "../institutionDetailTypes";

describe("parseInstitutionDetailQuery", () => {
  test("limita entre 50 e 500", () => {
    expect(parseInstitutionDetailQuery({ limit: "10" }, "id").limit).toBe(50);
    expect(parseInstitutionDetailQuery({ limit: "9999" }, "id").limit).toBe(500);
    expect(parseInstitutionDetailQuery({ limit: "120" }, "id").limit).toBe(120);
  });

  test("showDeleted e returnTo seguros", () => {
    const q = parseInstitutionDetailQuery(
      { showDeleted: "1", returnTo: "/busca?q=x" },
      "inst-1",
    );
    expect(q.showDeleted).toBe(true);
    expect(q.returnTo).toBe("/busca?q=x");
  });

  test("returnTo inválido volta para lista", () => {
    const q = parseInstitutionDetailQuery({ returnTo: "http://evil" }, "inst-1");
    expect(q.returnTo).toBe("/instituicoes");
  });
});

describe("buildInstitutionDetailReturnTo", () => {
  test("preserva query params relevantes", () => {
    const query = parseInstitutionDetailQuery(
      { showDeleted: "1", limit: "300", returnTo: "/busca" },
      "inst-1",
    );
    const href = buildInstitutionDetailReturnTo("inst-1", query);
    expect(href).toContain("showDeleted=1");
    expect(href).toContain("limit=300");
    expect(href).toContain("returnTo=%2Fbusca");
  });

  test("omite limit default na URL", () => {
    const query = parseInstitutionDetailQuery({}, "inst-1");
    expect(query.limit).toBe(INSTITUTION_DETAIL_DEFAULT_LIMIT);
    expect(buildInstitutionDetailReturnTo("inst-1", query)).toBe("/instituicoes/inst-1");
  });
});
