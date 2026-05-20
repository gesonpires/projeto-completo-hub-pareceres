const MAX_BATCH_IDS = 500;

export function parseBatchIdsJson(
  idsJson: string,
  emptyMessage: string,
): { ok: true; ids: string[] } | { ok: false; error: string } {
  let ids: string[] = [];
  try {
    const raw = JSON.parse(idsJson) as unknown;
    if (Array.isArray(raw)) {
      ids = raw.filter((x) => typeof x === "string") as string[];
    }
  } catch {
    // ignore — mesmo comportamento da action original
  }

  ids = Array.from(new Set(ids)).slice(0, MAX_BATCH_IDS);
  if (ids.length === 0) {
    return { ok: false, error: emptyMessage };
  }

  return { ok: true, ids };
}
