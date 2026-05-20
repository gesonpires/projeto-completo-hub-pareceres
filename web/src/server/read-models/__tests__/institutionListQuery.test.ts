import { describe, expect, test } from "vitest";
import {
  buildInstitutionListOrderBy,
  buildInstitutionListSearchParams,
  buildInstitutionListWhere,
  parseInstitutionListQuery,
} from "../institutionListQuery";

describe("parseInstitutionListQuery", () => {
  test("detecta CNPJ de 14 dígitos no campo q", () => {
    const q = parseInstitutionListQuery({ q: "12.345.678/0001-90" });
    expect(q.cnpj).toBe("12345678000190");
    expect(q.q).toBe("");
    expect(q.cnpjRaw).toBe("");
  });

  test("prioriza cnpj explícito sobre q", () => {
    const q = parseInstitutionListQuery({ q: "Escola", cnpj: "11.222.333/0001-44" });
    expect(q.cnpj).toBe("11222333000144");
    expect(q.q).toBe("");
  });

  test("normaliza termos de nome", () => {
    const q = parseInstitutionListQuery({ q: "  escola   municipal  " });
    expect(q.qTerms).toEqual(["ESCOLA", "MUNICIPAL"]);
  });

  test("paginação mínima é 1", () => {
    expect(parseInstitutionListQuery({ page: "0" }).page).toBe(1);
    expect(parseInstitutionListQuery({ page: "-3" }).page).toBe(1);
    expect(parseInstitutionListQuery({ page: "2" }).page).toBe(2);
    expect(parseInstitutionListQuery({ page: "2" }).skip).toBe(25);
  });
});

describe("buildInstitutionListWhere", () => {
  test("filtra por CNPJ exato", () => {
    const query = parseInstitutionListQuery({ cnpj: "12345678000190" });
    const where = buildInstitutionListWhere(query);
    expect(where).toMatchObject({ deletedAt: null, cnpj: "12345678000190" });
  });

  test("filtra tem_processos", () => {
    const sim = buildInstitutionListWhere(parseInstitutionListQuery({ tem_processos: "1" }));
    expect(sim).toMatchObject({
      processos: { some: { deletedAt: null } },
    });

    const nao = buildInstitutionListWhere(parseInstitutionListQuery({ tem_processos: "0" }));
    expect(nao).toMatchObject({
      processos: { none: { deletedAt: null } },
    });
  });
});

describe("buildInstitutionListOrderBy", () => {
  test("ordenação padrão por nome asc", () => {
    const order = buildInstitutionListOrderBy(parseInstitutionListQuery({}));
    expect(order).toEqual([{ nomeNormalizado: "asc" }, { id: "asc" }]);
  });

  test("ordenação mais_processos respeita direção", () => {
    const order = buildInstitutionListOrderBy(
      parseInstitutionListQuery({ sort: "mais_processos", dir: "desc" }),
    );
    expect(order[0]).toEqual({ processos: { _count: "desc" } });
  });
});

describe("buildInstitutionListSearchParams", () => {
  test("reconstrói query string para paginação", () => {
    const query = parseInstitutionListQuery({
      q: "Escola",
      municipio: "Florianópolis",
      page: "2",
    });
    const p = buildInstitutionListSearchParams(query, { page: 3 });
    expect(p.get("q")).toBe("Escola");
    expect(p.get("municipio")).toBe("Florianópolis");
    expect(p.get("page")).toBe("3");
  });
});
