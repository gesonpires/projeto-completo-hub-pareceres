"use server";

import { getSessionFromCookies } from "@/server/auth";
import { redirect } from "next/navigation";
import {
  assertCsvReadyForImport,
  ImportacaoCsvRunFormSchema,
  parseImportSourceInfo,
  parseReconciliacoesJson,
  previewImportacaoCsvFromUpload,
  runImportacaoCsv,
} from "@/server/services/importacaoCsvService";
import { canImport } from "@/server/permissions";

export async function previewImportAction(formData: FormData) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!canImport(session.perfil)) {
    return { ok: false as const, message: "Sem permissão para importar." };
  }

  const sheetNameRaw = formData.get("sheetName");
  const sheetName =
    typeof sheetNameRaw === "string" && sheetNameRaw.trim()
      ? sheetNameRaw.trim()
      : undefined;

  const file = formData.get("arquivo");
  const uploadedFile =
    typeof File !== "undefined" && file instanceof File ? file : null;
  if (!uploadedFile) return { ok: false as const, message: "Arquivo inválido." };

  return previewImportacaoCsvFromUpload({ file: uploadedFile, sheetName });
}

function redirectImportError(message: string): never {
  redirect("/importacoes/nova?error=" + encodeURIComponent(message));
}

export async function runImportAction(formData: FormData) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!canImport(session.perfil)) {
    redirectImportError("Sem permissão para importar.");
  }

  const parsed = ImportacaoCsvRunFormSchema.safeParse({
    arquivoNome: formData.get("arquivoNome"),
    csvText: formData.get("csvText"),
    reconciliacoesJson: (formData.get("reconciliacoesJson") || undefined) as unknown,
    sourceInfoJson: (formData.get("sourceInfoJson") || undefined) as unknown,
  });
  if (!parsed.success) {
    redirectImportError("Dados inválidos para importação.");
  }

  const source = parseImportSourceInfo(parsed.data.sourceInfoJson);
  if (!source.ok) redirectImportError(source.message);

  const csvReady = assertCsvReadyForImport(parsed.data.csvText, source.value.arquivoMeta);
  if (!csvReady.ok) redirectImportError(csvReady.message);

  const reconc = parseReconciliacoesJson(parsed.data.reconciliacoesJson);
  if (!reconc.ok) redirectImportError(reconc.message);

  const result = await runImportacaoCsv({
    csvText: parsed.data.csvText,
    actorUserId: session.id,
    arquivoNome: parsed.data.arquivoNome,
    arquivoTipo: source.value.arquivoTipo,
    arquivoMeta: source.value.arquivoMeta,
    reconciliacoes: reconc.value.reconciliacoes,
  });

  redirect(`/importacoes/${result.loteId}`);
}
