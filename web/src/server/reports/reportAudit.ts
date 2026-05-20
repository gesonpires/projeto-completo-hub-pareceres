export type ReportFrom =
  | "hub"
  | "hub_recent"
  | "historico"
  | "ficha"
  | "unknown";

export function normalizeReportFrom(input: string | null | undefined): ReportFrom {
  const v = String(input ?? "").trim().toLowerCase();
  switch (v) {
    case "hub":
    case "hub_recent":
    case "historico":
    case "ficha":
      return v;
    default:
      return "unknown";
  }
}

