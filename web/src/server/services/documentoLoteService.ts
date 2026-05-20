import type { z } from "zod";
import path from "node:path";
import AdmZip from "adm-zip";
import { prisma } from "@/server/db";
import { withPrismaRetry } from "@/server/dbRetry";
import { auditEvent, auditLog } from "@/server/audit";
import { isUploadableFile } from "./instituicaoMutationsDocumentStorage";
import type {
  DocumentoLoteActor,
  DocumentoLoteResult,
  DocumentoLoteUploadFiles,
} from "./documentoLoteTypes";
import { DocumentoLoteUploadSchema } from "./documentoLoteSchemas";
import {
  extractProcessoKeyFromFilename,
  extractRowSourceRefFromFilename,
  extractUuidFromFilename,
} from "./documentoLoteFilenameInference";
import { tryExtractDocumentText } from "./documentoLoteTextExtraction";
import { persistDocumentoLoteBytes } from "./documentoLoteStorage";

export type { DocumentoLoteResult } from "./documentoLoteTypes";
export { DocumentoLoteUploadSchema } from "./documentoLoteSchemas";

const MAX_ZIP_FILES = 250;
const MAX_ZIP_TOTAL_BYTES = 250 * 1024 * 1024;

async function resolveDocumentoVinculos(
  instituicaoId: string,
  input: {
    processoId?: string | null;
    atoId?: string | null;
    eventoId?: string | null;
  },
): Promise<
  | {
      ok: true;
      processoId: string | null;
      atoId: string | null;
      eventoId: string | null;
    }
  | { ok: false; error: string }
> {
  const linkCount =
    Number(Boolean(input.processoId)) +
    Number(Boolean(input.atoId)) +
    Number(Boolean(input.eventoId));
  if (linkCount > 1) {
    return {
      ok: false,
      error: "Escolha apenas um vínculo: processo OU ato OU evento.",
    };
  }

  let processoId: string | null = input.processoId ?? null;
  const atoId: string | null = input.atoId ?? null;
  const eventoId: string | null = input.eventoId ?? null;

  if (processoId) {
    const exists = await prisma.processo.findFirst({
      where: { id: processoId, instituicaoId, deletedAt: null },
      select: { id: true },
    });
    if (!exists) return { ok: false, error: "Processo inválido (não encontrado)." };
  }
  if (atoId) {
    const ato = await prisma.atoAutorizativo.findFirst({
      where: { id: atoId, instituicaoId, deletedAt: null },
      select: { id: true, processoId: true },
    });
    if (!ato) return { ok: false, error: "Ato inválido (não encontrado)." };
    if (ato.processoId) {
      if (processoId && processoId !== ato.processoId) {
        return { ok: false, error: "Vínculo inválido: ato pertence a outro processo." };
      }
      processoId = ato.processoId;
    }
  }
  if (eventoId) {
    const evt = await prisma.eventoRegulatorio.findFirst({
      where: { id: eventoId, instituicaoId, deletedAt: null },
      select: { id: true, processoId: true },
    });
    if (!evt) return { ok: false, error: "Evento inválido (não encontrado)." };
    if (evt.processoId) {
      if (processoId && processoId !== evt.processoId) {
        return { ok: false, error: "Vínculo inválido: evento pertence a outro processo." };
      }
      processoId = evt.processoId;
    }
  }

  return { ok: true, processoId, atoId, eventoId };
}

export async function uploadDocumentosEmLote(
  actor: DocumentoLoteActor,
  input: z.infer<typeof DocumentoLoteUploadSchema>,
  upload: DocumentoLoteUploadFiles,
): Promise<DocumentoLoteResult> {
  const tipoDocumento = await prisma.tipoDocumento.findUnique({
    where: { codigo: input.tipoDocumentoCodigo },
    select: { id: true, codigo: true },
  });
  if (!tipoDocumento) {
    return { ok: false, error: "Tipo de documento inválido." };
  }
  const tipoDoc = tipoDocumento;

  const zipFile = upload.zipFile;
  const files = upload.files;

  if (!zipFile && !files.length) {
    return { ok: false, error: "Selecione arquivos ou um ZIP." };
  }
  if (zipFile && files.length) {
    return {
      ok: false,
      error: "Envie apenas arquivos soltos OU um ZIP (não ambos).",
    };
  }

  const vinculos = await resolveDocumentoVinculos(input.instituicaoId, {
    processoId: input.processoId,
    atoId: input.atoId,
    eventoId: input.eventoId,
  });
  if (!vinculos.ok) return { ok: false, error: vinculos.error };

  const explicitProcessoId = vinculos.processoId;
  const explicitAtoId = vinculos.atoId;
  const explicitEventoId = vinculos.eventoId;
  const dataDocumento = input.dataDocumento ? new Date(input.dataDocumento) : null;

  const results: Array<{ id: string; filename: string }> = [];
  const skipped: Array<{ filename: string; reason: string }> = [];
  let autoLinked = 0;

  async function inferProcessoIdFromName(originalName: string): Promise<{
    processoId: string | null;
    strategy?: string;
  }> {
    if (explicitProcessoId) {
      return { processoId: explicitProcessoId, strategy: "explicit" };
    }

    const uuid = extractUuidFromFilename(originalName);
    if (uuid) {
      const hit = await prisma.processo.findFirst({
        where: { id: uuid, instituicaoId: input.instituicaoId, deletedAt: null },
        select: { id: true },
      });
      if (hit) return { processoId: hit.id, strategy: "filename_uuid" };
    }

    const rowRef = extractRowSourceRefFromFilename(originalName);
    if (rowRef) {
      const matches = await prisma.processo.findMany({
        where: {
          instituicaoId: input.instituicaoId,
          deletedAt: null,
          sourceRef: rowRef,
        },
        take: 2,
        select: { id: true },
      });
      if (matches.length === 1) {
        return { processoId: matches[0]!.id, strategy: "filename_sourceRef_row" };
      }
    }

    const key = extractProcessoKeyFromFilename(originalName);
    if (!key) return { processoId: null };

    if (key.ano) {
      const matches = await prisma.processo.findMany({
        where: {
          instituicaoId: input.instituicaoId,
          deletedAt: null,
          numero: key.numero,
          ano: key.ano,
        },
        take: 2,
        select: { id: true },
      });
      if (matches.length === 1) {
        return { processoId: matches[0]!.id, strategy: "filename_numero_ano" };
      }
      return { processoId: null };
    }

    const matches = await prisma.processo.findMany({
      where: {
        instituicaoId: input.instituicaoId,
        deletedAt: null,
        numero: key.numero,
      },
      take: 2,
      select: { id: true },
    });
    if (matches.length === 1) {
      return { processoId: matches[0]!.id, strategy: "filename_numero_only_unique" };
    }
    return { processoId: null };
  }

  async function persistOne(originalName: string, mime: string | null, bytes: Buffer) {
    const sourceRef = `UPLOAD_LOTE:${input.instituicaoId}:${originalName}`;

    const existing = await prisma.documento.findFirst({
      where: { instituicaoId: input.instituicaoId, sourceRef, deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      skipped.push({ filename: originalName, reason: "duplicado_por_sourceRef" });
      return;
    }

    const inferred = await inferProcessoIdFromName(originalName);
    if (inferred.strategy) autoLinked += 1;

    const tituloBase = path.basename(originalName).replace(/\.[^.]+$/, "").trim();
    const titulo =
      tituloBase.length >= 3 ? tituloBase : `Documento ${tipoDoc.codigo}`;

    const created = await prisma.documento.create({
      data: {
        instituicaoId: input.instituicaoId,
        processoId: inferred.processoId,
        atoId: explicitAtoId,
        eventoId: explicitEventoId,
        tipoDocumentoId: tipoDoc.id,
        titulo,
        dataDocumento,
        sourceRef,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      },
      select: { id: true, titulo: true },
    });

    const stored = await persistDocumentoLoteBytes({
      instituicaoId: input.instituicaoId,
      documentoId: created.id,
      originalName,
      mime,
      bytes,
    });

    const textoExtraido = await tryExtractDocumentText(originalName, mime, bytes);

    await prisma.$transaction(async (tx) => {
      const updated = await tx.documento.update({
        where: { id: created.id },
        data: {
          arquivoNome: stored.arquivoNome,
          arquivoMime: stored.arquivoMime,
          arquivoTamanho: stored.arquivoTamanho,
          storagePath: stored.relativePath,
          textoExtraido,
          updatedBy: actor.userId,
        },
        select: { id: true },
      });

      await auditLog(
        {
          entidade: "documentos",
          entidadeId: created.id,
          acao: "CREATE",
          actorUserId: actor.userId,
          depois: { ...created, ...updated, storagePath: stored.relativePath },
          metadata: {
            reason: "upload_lote",
            sourceRef,
            autoLink: inferred.strategy
              ? { processoId: inferred.processoId, strategy: inferred.strategy }
              : undefined,
          },
        },
        tx,
      );
    });

    results.push({ id: created.id, filename: originalName });
  }

  if (zipFile) {
    if (zipFile.size <= 0) {
      return { ok: false, error: "ZIP vazio." };
    }

    const zipBuf = Buffer.from(await zipFile.arrayBuffer());
    const archive = new AdmZip(zipBuf);
    const entries = archive.getEntries();

    let seen = 0;
    let total = 0;

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const name = String(entry.entryName || "").replaceAll("\\", "/");
      const base = path.basename(name);
      if (!base || base === "." || base === "..") continue;

      seen += 1;
      if (seen > MAX_ZIP_FILES) {
        return {
          ok: false,
          error: "ZIP excede o limite de arquivos (250).",
        };
      }

      const content = entry.getData();
      total += content.length;
      if (total > MAX_ZIP_TOTAL_BYTES) {
        return {
          ok: false,
          error: "ZIP excede o limite total (250MB).",
        };
      }

      await persistOne(base, null, content);
    }
  } else {
    for (const f of files) {
      if (!f || f.size <= 0) continue;
      const bytes = Buffer.from(await f.arrayBuffer());
      await persistOne(f.name, f.type || null, bytes);
    }
  }

  await withPrismaRetry(() =>
    auditEvent({
      entidade: "documentos",
      entidadeId: input.instituicaoId,
      evento: "UPLOAD_LOTE",
      actorUserId: actor.userId,
      metadata: {
        instituicaoId: input.instituicaoId,
        processoId: explicitProcessoId,
        atoId: explicitAtoId,
        eventoId: explicitEventoId,
        tipoDocumentoCodigo: tipoDoc.codigo,
        input: zipFile ? "zip" : "files",
        count: results.length,
        skipped: skipped.length,
      },
    }),
  );

  const successMessage =
    `Upload em lote: ${results.length} criado(s)` +
    (skipped.length ? `, ${skipped.length} pulado(s)` : "") +
    (autoLinked ? `, ${autoLinked} vinculado(s) automaticamente ao processo` : "") +
    ".";

  return {
    ok: true,
    instituicaoId: input.instituicaoId,
    successMessage,
  };
}

export function parseDocumentoLoteUploadFiles(formData: FormData): DocumentoLoteUploadFiles {
  const zip = formData.get("zip");
  const zipFile = isUploadableFile(zip) ? zip : null;
  const files = formData
    .getAll("arquivos")
    .filter((f) => isUploadableFile(f)) as File[];

  return { zipFile, files };
}
