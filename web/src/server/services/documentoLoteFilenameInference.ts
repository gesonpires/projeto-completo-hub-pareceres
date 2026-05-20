import path from "node:path";

export function extractProcessoKeyFromFilename(
  name: string,
): { numero: string; ano?: number } | null {
  const base = path.basename(name).replaceAll("_", " ").replaceAll("-", " ").trim();
  if (!base) return null;

  const m1 = base.match(/(?:proc(?:esso)?\s*)?(\d{1,10})\s*[\/\s]\s*(20\d{2})/i);
  if (m1?.[1] && m1?.[2]) {
    const ano = Number.parseInt(m1[2], 10);
    if (Number.isFinite(ano)) return { numero: m1[1], ano };
  }

  const m2 = base.match(/(?:proc(?:esso)?\s*)(\d{1,10})/i);
  if (m2?.[1]) return { numero: m2[1] };

  return null;
}

export function extractUuidFromFilename(name: string): string | null {
  const m = String(name).match(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
  );
  return m?.[0]?.toLowerCase() ?? null;
}

export function extractRowSourceRefFromFilename(name: string): string | null {
  const m = String(name).match(/\brow:(\d{1,9})\b/i);
  if (!m?.[1]) return null;
  return `row:${m[1]}`;
}
