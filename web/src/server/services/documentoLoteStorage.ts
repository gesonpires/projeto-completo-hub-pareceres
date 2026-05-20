import path from "node:path";
import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

export async function persistDocumentoLoteBytes(params: {
  instituicaoId: string;
  documentoId: string;
  originalName: string;
  mime: string | null;
  bytes: Buffer;
}) {
  const ext = path.extname(params.originalName).slice(0, 12);
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
  await writeFile(path.join(absoluteDir, filename), params.bytes);

  return {
    relativePath,
    arquivoNome: params.originalName,
    arquivoMime: params.mime,
    arquivoTamanho: params.bytes.length,
  };
}
