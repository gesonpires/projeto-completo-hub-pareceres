import { prisma } from "@/server/db";
import { withPrismaRetry } from "@/server/dbRetry";
import { listReconKeysCsvMvp } from "@/server/imports/csvMvpCore";
import type { ImportacaoCsvReconciliationSuggestion } from "./importacaoCsvPreviewTypes";

const RECON_KEY_LIMIT = 200;

/**
 * Sugestões de reconciliação para linhas sem CNPJ (match exato, município aproximado, parcial).
 */
export async function buildImportacaoCsvReconciliationSuggestions(
  csvText: string,
): Promise<ImportacaoCsvReconciliationSuggestion[]> {
  const out: ImportacaoCsvReconciliationSuggestion[] = [];

  const keys = listReconKeysCsvMvp(csvText, RECON_KEY_LIMIT);
  if (keys.length === 0) return out;

  const keyStr = (k: { nomeNormalizado: string; municipio?: string; uf?: string }) =>
    [
      k.nomeNormalizado,
      (k.municipio ?? "").trim().toLowerCase(),
      (k.uf ?? "").trim().toUpperCase(),
    ].join("|");

  const groups = new Map<string, typeof keys>();
  for (const k of keys) {
    const s = keyStr(k);
    const arr = groups.get(s) ?? [];
    arr.push(k);
    groups.set(s, arr);
  }

  const clauses = Array.from(groups.values())
    .slice(0, 120)
    .map((arr) => {
      const k0 = arr[0]!;
      return {
        nomeNormalizado: k0.nomeNormalizado,
        ...(k0.municipio
          ? { municipio: { equals: k0.municipio, mode: "insensitive" as const } }
          : {}),
        ...(k0.uf ? { uf: { equals: k0.uf, mode: "insensitive" as const } } : {}),
      };
    });

  const candidatosAllExact = await withPrismaRetry(() =>
    prisma.instituicao.findMany({
      where: { deletedAt: null, OR: clauses },
      select: { id: true, nome: true, municipio: true, uf: true, cnpj: true, nomeNormalizado: true },
      take: 800,
    }),
  );

  const bucketExact = new Map<string, typeof candidatosAllExact>();
  for (const c of candidatosAllExact) {
    const s = keyStr({
      nomeNormalizado: c.nomeNormalizado,
      municipio: c.municipio ?? undefined,
      uf: c.uf ?? undefined,
    });
    const arr = bucketExact.get(s) ?? [];
    arr.push(c);
    bucketExact.set(s, arr);
  }

  const missing = new Map<string, typeof keys>();

  for (const [s, rows] of groups) {
    const cand = (bucketExact.get(s) ?? []).slice(0, 8).map((c) => ({
      id: c.id,
      nome: c.nome,
      municipio: c.municipio,
      uf: c.uf,
      cnpj: c.cnpj,
    }));
    if (cand.length === 0) {
      missing.set(s, rows);
      continue;
    }
    for (const r of rows) {
      out.push({
        rowNumber: r.rowNumber,
        nome: r.nome,
        municipio: r.municipio,
        uf: r.uf,
        matchLevel: "EXATO",
        candidatos: cand,
      });
    }
  }

  if (missing.size > 0) {
    const fuzzyGroups = new Map<string, typeof keys>();
    for (const rows of missing.values()) {
      for (const r of rows) {
        if (!r.municipio) continue;
        const key = [
          r.nomeNormalizado,
          (r.uf ?? "").trim().toUpperCase(),
          r.municipio.trim().toLowerCase(),
        ].join("|");
        const arr = fuzzyGroups.get(key) ?? [];
        arr.push(r);
        fuzzyGroups.set(key, arr);
      }
    }

    if (fuzzyGroups.size > 0) {
      const fuzzyClauses = Array.from(fuzzyGroups.values())
        .slice(0, 120)
        .map((arr) => {
          const r0 = arr[0]!;
          return {
            nomeNormalizado: r0.nomeNormalizado,
            ...(r0.uf ? { uf: { equals: r0.uf, mode: "insensitive" as const } } : {}),
            municipio: { contains: r0.municipio!, mode: "insensitive" as const },
          };
        });

      const candFuzzyAll = await withPrismaRetry(() =>
        prisma.instituicao.findMany({
          where: { deletedAt: null, OR: fuzzyClauses },
          select: {
            id: true,
            nome: true,
            municipio: true,
            uf: true,
            cnpj: true,
            nomeNormalizado: true,
          },
          take: 1200,
        }),
      );

      for (const rows of fuzzyGroups.values()) {
        const r0 = rows[0]!;
        const candidates = candFuzzyAll
          .filter(
            (c) =>
              c.nomeNormalizado === r0.nomeNormalizado &&
              (!r0.uf || (c.uf ?? "").toUpperCase() === r0.uf.toUpperCase()),
          )
          .slice(0, 8)
          .map((c) => ({
            id: c.id,
            nome: c.nome,
            municipio: c.municipio,
            uf: c.uf,
            cnpj: c.cnpj,
          }));

        if (candidates.length === 0) continue;
        for (const r of rows) {
          out.push({
            rowNumber: r.rowNumber,
            nome: r.nome,
            municipio: r.municipio,
            uf: r.uf,
            matchLevel: "MUNICIPIO_APROX",
            candidatos: candidates,
          });
        }
      }
    }

    const nomeSet = new Set<string>();
    for (const rows of missing.values()) nomeSet.add(rows[0]!.nomeNormalizado);

    const candidatosAllParcial = await withPrismaRetry(() =>
      prisma.instituicao.findMany({
        where: { deletedAt: null, nomeNormalizado: { in: Array.from(nomeSet).slice(0, 400) } },
        select: { id: true, nome: true, municipio: true, uf: true, cnpj: true, nomeNormalizado: true },
        take: 1200,
      }),
    );

    const bucketParcial = new Map<string, typeof candidatosAllParcial>();
    for (const c of candidatosAllParcial) {
      const arr = bucketParcial.get(c.nomeNormalizado) ?? [];
      arr.push(c);
      bucketParcial.set(c.nomeNormalizado, arr);
    }

    for (const rows of missing.values()) {
      const nomeNormalizado = rows[0]!.nomeNormalizado;
      const cand = (bucketParcial.get(nomeNormalizado) ?? []).slice(0, 8).map((c) => ({
        id: c.id,
        nome: c.nome,
        municipio: c.municipio,
        uf: c.uf,
        cnpj: c.cnpj,
      }));
      if (cand.length === 0) continue;
      for (const r of rows) {
        out.push({
          rowNumber: r.rowNumber,
          nome: r.nome,
          municipio: r.municipio,
          uf: r.uf,
          matchLevel: "PARCIAL",
          candidatos: cand,
        });
      }
    }
  }

  return out;
}
