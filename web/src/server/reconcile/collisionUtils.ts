export function buildNumeroAnoOr(
  keys: Array<{ numero: string | null; ano: number | null }>,
  limit = 150,
) {
  return keys
    .filter((k) => k.numero && typeof k.ano === "number")
    .slice(0, limit)
    .map((k) => ({ numero: k.numero!, ano: k.ano! }));
}

export function buildDocSourceRefIn(refs: Array<{ sourceRef: string | null }>, limit = 200) {
  return refs
    .map((r) => r.sourceRef)
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .slice(0, limit);
}

export function formatNumeroAnoSample(
  rows: Array<{ numero: string | null; ano: number | null }>,
  limit = 6,
) {
  return rows
    .map((c) => `${c.numero ?? ""}/${c.ano ?? ""}`)
    .filter((s) => s !== "/")
    .slice(0, limit)
    .join(", ");
}

