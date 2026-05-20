import type { AuditExportFormat, ExportJobStatus } from "@/generated/prisma/client";

export type AuditoriaExportJobActor = {
  userId: string;
  isAdmin: boolean;
};

export type AuditoriaExportJobFiltros = {
  entidade: string | null;
  user: string | null;
  de: string | null;
  ate: string | null;
};

export type CreateAuditoriaExportJobInput = {
  format: AuditExportFormat;
  filtros: AuditoriaExportJobFiltros;
  limit: number;
};

export type AuditoriaExportJobView = {
  id: string;
  status: ExportJobStatus;
  format: AuditExportFormat;
  filtros: unknown;
  limit: number;
  arquivoPath: string | null;
  error: string | null;
  criadoPor: string;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
};

export type CreateAuditoriaExportJobResult =
  | { ok: true; id: string; status: ExportJobStatus }
  | { ok: false; error: string };

export type GetAuditoriaExportJobResult =
  | { ok: true; job: AuditoriaExportJobView }
  | { ok: false; code: "not_found" | "forbidden" };

export type ReadAuditoriaExportDownloadResult =
  | { ok: true; bytes: Buffer; contentType: string; filename: string }
  | {
      ok: false;
      code: "not_found" | "forbidden" | "not_ready" | "invalid_file" | "file_missing";
    };
