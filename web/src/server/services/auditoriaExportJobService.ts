import path from "node:path";
import { readFile } from "node:fs/promises";
import { prisma } from "@/server/db";
import { auditEvent } from "@/server/audit";
import { buildAuditoriaExportFile } from "./auditoriaExportJobBuild";
import type {
  AuditoriaExportJobActor,
  AuditoriaExportJobFiltros,
  AuditoriaExportJobView,
  CreateAuditoriaExportJobInput,
  CreateAuditoriaExportJobResult,
  GetAuditoriaExportJobResult,
  ReadAuditoriaExportDownloadResult,
} from "./auditoriaExportJobTypes";

export type {
  AuditoriaExportJobActor,
  AuditoriaExportJobFiltros,
  AuditoriaExportJobView,
  CreateAuditoriaExportJobInput,
  CreateAuditoriaExportJobResult,
  GetAuditoriaExportJobResult,
  ReadAuditoriaExportDownloadResult,
} from "./auditoriaExportJobTypes";

export {
  buildLogAuditoriaWhere,
  clampAuditoriaExportLimit,
  parseAuditoriaExportFiltros,
  parseAuditoriaExportFormat,
} from "./auditoriaExportJobQuery";

const JOB_VIEW_SELECT = {
  id: true,
  status: true,
  format: true,
  filtros: true,
  limit: true,
  arquivoPath: true,
  error: true,
  criadoPor: true,
  createdAt: true,
  startedAt: true,
  finishedAt: true,
} as const;

function canAccessExportJob(
  job: { criadoPor: string },
  actor: AuditoriaExportJobActor,
): boolean {
  return job.criadoPor === actor.userId || actor.isAdmin;
}

export async function createAuditoriaExportJob(
  actor: Pick<AuditoriaExportJobActor, "userId">,
  input: CreateAuditoriaExportJobInput,
): Promise<CreateAuditoriaExportJobResult> {
  const job = await prisma.$transaction(async (tx) => {
    const created = await tx.auditoriaExportJob.create({
      data: {
        status: "PENDING",
        format: input.format,
        filtros: input.filtros as never,
        limit: input.limit,
        criadoPor: actor.userId,
      },
      select: { id: true, status: true },
    });

    await auditEvent(
      {
        entidade: "auditoria",
        entidadeId: created.id,
        evento: "EXPORT_ASYNC_CREATE",
        actorUserId: actor.userId,
        metadata: {
          format: input.format,
          limit: input.limit,
          filtros: input.filtros,
        },
      },
      tx,
    );

    return created;
  });

  return { ok: true, id: job.id, status: job.status };
}

async function loadExportJob(jobId: string): Promise<AuditoriaExportJobView | null> {
  return prisma.auditoriaExportJob.findFirst({
    where: { id: jobId },
    select: JOB_VIEW_SELECT,
  });
}

async function runPendingExportJob(
  actor: AuditoriaExportJobActor,
  job: AuditoriaExportJobView,
): Promise<void> {
  await prisma.auditoriaExportJob.update({
    where: { id: job.id },
    data: { status: "RUNNING", startedAt: new Date(), error: null },
  });

  try {
    const built = await buildAuditoriaExportFile({
      id: job.id,
      format: job.format,
      filtros: job.filtros,
      limit: job.limit,
    });

    await prisma.$transaction(async (tx) => {
      await tx.auditoriaExportJob.update({
        where: { id: job.id },
        data: {
          status: "DONE",
          arquivoPath: built.relPath,
          finishedAt: new Date(),
        },
      });

      await auditEvent(
        {
          entidade: "auditoria",
          entidadeId: job.id,
          evento: "EXPORT_ASYNC_DONE",
          actorUserId: actor.userId,
          metadata: {
            arquivoPath: built.relPath,
            format: job.format,
            limit: job.limit,
          },
        },
        tx,
      );
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.$transaction(async (tx) => {
      await tx.auditoriaExportJob.update({
        where: { id: job.id },
        data: { status: "ERROR", error: msg, finishedAt: new Date() },
      });

      await auditEvent(
        {
          entidade: "auditoria",
          entidadeId: job.id,
          evento: "EXPORT_ASYNC_ERROR",
          actorUserId: actor.userId,
          metadata: { error: msg, format: job.format, limit: job.limit },
        },
        tx,
      );
    });
  }
}

/**
 * Consulta status do job; se PENDING, dispara geração on-demand (comportamento MVP atual).
 */
export async function getAuditoriaExportJob(
  actor: AuditoriaExportJobActor,
  jobId: string,
): Promise<GetAuditoriaExportJobResult> {
  const job = await loadExportJob(jobId);
  if (!job) return { ok: false, code: "not_found" };
  if (!canAccessExportJob(job, actor)) return { ok: false, code: "forbidden" };

  if (job.status === "PENDING") {
    await runPendingExportJob(actor, job);
    const refreshed = await loadExportJob(jobId);
    if (!refreshed) return { ok: false, code: "not_found" };
    return { ok: true, job: refreshed };
  }

  return { ok: true, job };
}

export async function readAuditoriaExportDownload(
  actor: AuditoriaExportJobActor,
  jobId: string,
): Promise<ReadAuditoriaExportDownloadResult> {
  const job = await prisma.auditoriaExportJob.findFirst({
    where: { id: jobId },
    select: {
      id: true,
      status: true,
      format: true,
      arquivoPath: true,
      criadoPor: true,
    },
  });

  if (!job) return { ok: false, code: "not_found" };
  if (!canAccessExportJob(job, actor)) return { ok: false, code: "forbidden" };
  if (job.status !== "DONE" || !job.arquivoPath) {
    return { ok: false, code: "not_ready" };
  }

  if (
    !job.arquivoPath.startsWith("storage/") &&
    !job.arquivoPath.startsWith("storage\\")
  ) {
    return { ok: false, code: "invalid_file" };
  }

  const abs = path.join(/* turbopackIgnore: true */ process.cwd(), job.arquivoPath);
  let bytes: Buffer;
  try {
    bytes = await readFile(abs);
  } catch {
    return { ok: false, code: "file_missing" };
  }

  await auditEvent({
    entidade: "auditoria",
    entidadeId: job.id,
    evento: "EXPORT_ASYNC_DOWNLOAD",
    actorUserId: actor.userId,
    metadata: { format: job.format },
  });

  const ext = job.format === "JSON" ? "json" : "csv";
  const contentType =
    job.format === "JSON" ? "application/json; charset=utf-8" : "text/csv; charset=utf-8";
  const filename = `auditoria-export-${job.id}.${ext}`;

  return { ok: true, bytes, contentType, filename };
}
