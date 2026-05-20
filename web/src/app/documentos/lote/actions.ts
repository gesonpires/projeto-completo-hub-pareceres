"use server";

import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import type { DocumentoLoteResult } from "@/server/services/documentoLoteService";
import {
  DocumentoLoteUploadSchema,
  parseDocumentoLoteUploadFiles,
  uploadDocumentosEmLote,
} from "@/server/services/documentoLoteService";

function redirectLoteError(message: string): never {
  redirect("/documentos/lote?error=" + encodeURIComponent(message));
}

function finishLoteUpload(result: DocumentoLoteResult) {
  if (!result.ok) {
    redirectLoteError(result.error);
  }
  redirect(
    `/instituicoes/${result.instituicaoId}?success=${encodeURIComponent(result.successMessage)}`,
  );
}

export async function uploadDocumentosEmLoteAction(formData: FormData) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!hasPermission(session.perfil, "documents:write")) redirect("/");

  const parsed = DocumentoLoteUploadSchema.safeParse({
    instituicaoId: formData.get("instituicaoId"),
    processoId: (formData.get("processoId") || undefined) as unknown,
    atoId: (formData.get("atoId") || undefined) as unknown,
    eventoId: (formData.get("eventoId") || undefined) as unknown,
    tipoDocumentoCodigo: formData.get("tipoDocumentoCodigo"),
    dataDocumento: (formData.get("dataDocumento") || undefined) as unknown,
  });
  if (!parsed.success) {
    redirectLoteError("Dados inválidos para upload em lote.");
  }

  finishLoteUpload(
    await uploadDocumentosEmLote(
      { userId: session.id },
      parsed.data,
      parseDocumentoLoteUploadFiles(formData),
    ),
  );
}
