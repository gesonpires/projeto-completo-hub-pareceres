import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { prisma } from "@/server/db";
import { withPrismaRetry } from "@/server/dbRetry";
import { buildLogAuditoriaWhere } from "./auditoriaExportJobQuery";
import type { AuditoriaExportJobFiltros } from "./auditoriaExportJobTypes";

function escapeCsv(value: string) {
  const v = value.replaceAll('"', '""');
  return `"${v}"`;
}

export async function buildAuditoriaExportFile(job: {
  id: string;
  format: "CSV" | "JSON";
  filtros: AuditoriaExportJobFiltros | unknown;
  limit: number;
}) {
  const filtros =
    job.filtros && typeof job.filtros === "object"
      ? (job.filtros as AuditoriaExportJobFiltros)
      : {
          entidade: null,
          user: null,
          de: null,
          ate: null,
        };

  const where = buildLogAuditoriaWhere(filtros);

  const rows = await withPrismaRetry(() =>
    prisma.logAuditoria.findMany({
      where,
      orderBy: [{ timestamp: "desc" }],
      take: job.limit,
      include: { actor: { include: { perfil: true } } },
    }),
  );

  const exportDir = path.join(
    /* turbopackIgnore: true */ process.cwd(),
    "storage",
    "auditoria-exports",
  );
  await mkdir(exportDir, { recursive: true });

  if (job.format === "JSON") {
    const payload = {
      filtros: job.filtros ?? null,
      limit: job.limit,
      rows: rows.map((r) => ({
        id: r.id,
        timestamp: r.timestamp.toISOString(),
        entidade: r.entidade,
        entidadeId: r.entidadeId,
        acao: r.acao,
        actor: r.actor
          ? {
              id: r.actor.id,
              nome: r.actor.nome,
              email: r.actor.email,
              perfil: r.actor.perfil?.nome,
            }
          : null,
        antes: r.antes,
        depois: r.depois,
        metadata: r.metadata,
      })),
    };
    const bytes = Buffer.from(JSON.stringify(payload, null, 2), "utf-8");
    const rel = path.join("storage", "auditoria-exports", `${job.id}.json`);
    await writeFile(path.join(exportDir, `${job.id}.json`), bytes);
    return { relPath: rel, contentType: "application/json; charset=utf-8" };
  }

  const header = [
    "id",
    "timestamp",
    "entidade",
    "entidadeId",
    "acao",
    "actorNome",
    "actorEmail",
    "actorPerfil",
    "antes",
    "depois",
    "metadata",
  ];

  const lines: string[] = [];
  lines.push(header.map(escapeCsv).join(","));
  for (const r of rows) {
    const data = [
      r.id,
      r.timestamp.toISOString(),
      r.entidade,
      r.entidadeId,
      r.acao,
      r.actor?.nome ?? "",
      r.actor?.email ?? "",
      r.actor?.perfil?.nome ?? "",
      r.antes ? JSON.stringify(r.antes) : "",
      r.depois ? JSON.stringify(r.depois) : "",
      r.metadata ? JSON.stringify(r.metadata) : "",
    ];
    lines.push(data.map(escapeCsv).join(","));
  }
  const csv = lines.join("\r\n") + "\r\n";
  const bytes = Buffer.from(csv, "utf-8");
  const rel = path.join("storage", "auditoria-exports", `${job.id}.csv`);
  await writeFile(path.join(exportDir, `${job.id}.csv`), bytes);
  return { relPath: rel, contentType: "text/csv; charset=utf-8" };
}
