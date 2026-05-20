import { describe, expect, test } from "vitest";
import { normalizeReportFrom } from "../reportAudit";

describe("reports audit", () => {
  test("normalizeReportFrom accepts known values", () => {
    expect(normalizeReportFrom("hub")).toBe("hub");
    expect(normalizeReportFrom("HUB_RECENT")).toBe("hub_recent");
    expect(normalizeReportFrom("historico")).toBe("historico");
    expect(normalizeReportFrom("ficha")).toBe("ficha");
  });

  test("normalizeReportFrom defaults to unknown", () => {
    expect(normalizeReportFrom("")).toBe("unknown");
    expect(normalizeReportFrom("  ")).toBe("unknown");
    expect(normalizeReportFrom("x")).toBe("unknown");
    expect(normalizeReportFrom(undefined)).toBe("unknown");
    expect(normalizeReportFrom(null)).toBe("unknown");
  });
});

