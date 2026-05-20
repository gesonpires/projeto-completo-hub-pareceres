import path from "node:path";
import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

export const DOCUMENTO_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;

export function isUploadableFile(file: unknown): file is File {
  return typeof File !== "undefined" && file instanceof File;
}

export function validateUploadSize(file: File): string | null {
  if (file.size > DOCUMENTO_UPLOAD_MAX_BYTES) {
    return "Arquivo excede 25MB. Envie um arquivo menor (ou use upload em lote/ZIP).";
  }
  return null;
}

export async function persistDocumentoArquivo(params: {
  instituicaoId: string;
  documentoId: string;
  file: File;
}) {
  const ext = path.extname(params.file.name).slice(0, 12);
  const safeBase = crypto.randomUUID();
  const filename = `${safeBase}${ext || ""}`;
  const relativePath = path
    .join("storage", "documentos", params.instituicaoId, params.documentoId, filename)
    .replaceAll("\\", "/");

  const absoluteDir = path.join(
    process.cwd(),
    "storage",
    "documentos",
    params.instituicaoId,
    params.documentoId,
  );
  await mkdir(absoluteDir, { recursive: true });

  const bytes = Buffer.from(await params.file.arrayBuffer());
  const absoluteFile = path.join(absoluteDir, filename);
  await writeFile(absoluteFile, bytes);

  return {
    relativePath,
    arquivoNome: params.file.name,
    arquivoMime: params.file.type || null,
    arquivoTamanho: params.file.size,
  };
}
