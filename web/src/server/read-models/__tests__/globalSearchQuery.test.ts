import { describe, expect, test } from "vitest";
import {
  buildGlobalSearchReturnTo,
  buildGlobalSearchTabHref,
  buildGlobalSearchWhereClauses,
  parseGlobalSearchQuery,
  resolveGlobalSearchEffectiveTab,
} from "../globalSearchQuery";

const allPerms = {
  canInst: true,
  canProc: true,
  canReg: true,
  canDocs: true,
};

describe("parseGlobalSearchQuery", () => {
  test("extrai UF e CNPJ do termo livre", () => {
    const q = parseGlobalSearchQuery({ q: "escola municipal SC 12345678000190" });
    expect(q.ufToken).toBe("SC");
    expect(q.cnpjToken).toBe("12345678000190");
    expect(q.qIsCnpj).toBe(true);
  });

  test("detecta processo numero/ano", () => {
    const q = parseGlobalSearchQuery({ q: "123/2024" });
    expect(q.procNumero).toBe("123");
    expect(q.procAnoOk).toBe(2024);
  });

  test("detecta ato tipo + numero", () => {
    const q = parseGlobalSearchQuery({ q: "PARECER 12/2024" });
    expect(q.atoTipoFromQuery).toBe("PARECER");
    expect(q.atoNumeroFromQuery).toBe("12/2024");
  });
});

describe("resolveGlobalSearchEffectiveTab", () => {
  test("prioriza processo quando numero/ano presente", () => {
    const query = parseGlobalSearchQuery({ q: "99/2023" });
    expect(resolveGlobalSearchEffectiveTab(query, allPerms)).toBe("processos");
  });

  test("respeita tab explícita quando permitida", () => {
    const query = parseGlobalSearchQuery({ q: "escola", tab: "eventos" });
    expect(resolveGlobalSearchEffectiveTab(query, allPerms)).toBe("eventos");
  });

  test("cai para auto quando tab não permitida", () => {
    const query = parseGlobalSearchQuery({ q: "99/2023", tab: "instituicoes" });
    const perms = { canInst: false, canProc: true, canReg: false, canDocs: false };
    expect(resolveGlobalSearchEffectiveTab(query, perms)).toBe("processos");
  });
});

describe("buildGlobalSearchWhereClauses", () => {
  test("filtra instituição por CNPJ", () => {
    const query = parseGlobalSearchQuery({ q: "12345678000190" });
    const { instWhere } = buildGlobalSearchWhereClauses(query);
    expect(instWhere).toMatchObject({ deletedAt: null, cnpj: "12345678000190" });
  });
});

describe("buildGlobalSearchTabHref", () => {
  test("monta URL com q e tab", () => {
    const query = parseGlobalSearchQuery({ q: "teste", tab: "atos" });
    expect(buildGlobalSearchTabHref(query, "atos")).toBe("/busca?q=teste&tab=atos");
    expect(buildGlobalSearchReturnTo(query, "atos")).toBe("/busca?q=teste&tab=atos");
  });
});
