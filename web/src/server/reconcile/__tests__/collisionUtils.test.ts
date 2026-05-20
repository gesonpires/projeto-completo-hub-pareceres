import { describe, expect, test } from "vitest";
import { buildDocSourceRefIn, buildNumeroAnoOr, formatNumeroAnoSample } from "../collisionUtils";

describe("reconcile collision utils", () => {
  test("buildNumeroAnoOr filters nulls and limits", () => {
    const keys = [
      { numero: null, ano: 2026 },
      { numero: "123", ano: null },
      { numero: "123", ano: 2026 },
      { numero: "456", ano: 2025 },
    ];
    expect(buildNumeroAnoOr(keys, 10)).toEqual([
      { numero: "123", ano: 2026 },
      { numero: "456", ano: 2025 },
    ]);
  });

  test("buildDocSourceRefIn filters and limits", () => {
    const refs = [{ sourceRef: null }, { sourceRef: " " }, { sourceRef: "row:1" }, { sourceRef: "x" }];
    expect(buildDocSourceRefIn(refs, 10)).toEqual(["row:1", "x"]);
  });

  test("formatNumeroAnoSample formats pairs", () => {
    const rows = [
      { numero: "123", ano: 2026 },
      { numero: "456", ano: 2025 },
    ];
    expect(formatNumeroAnoSample(rows)).toBe("123/2026, 456/2025");
  });
});

