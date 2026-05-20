"use server";

import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/server/auth";
import { canReconcileImports } from "@/server/permissions";
import type { ReconciliacaoAjusteResult } from "@/server/services/reconciliacaoAjustesService";
import {
  MergeInstituicaoSchema,
  MergeProcessoSchema,
  UpdateInstituicoesBatchSchema,
  UpdateProcessosBatchSchema,
  mergeInstituicaoInto,
  mergeProcessoInto,
  updateInstituicoesBatch,
  updateProcessosBatch,
} from "@/server/services/reconciliacaoAjustesService";

function redirectAjustesError(loteId: string, message: string): never {
  redirect(
    `/importacoes/${loteId}/ajustes?error=${encodeURIComponent(message)}`,
  );
}

function finishAjuste(result: ReconciliacaoAjusteResult, fallbackLoteId: string) {
  if (!result.ok) {
    redirectAjustesError(fallbackLoteId, result.error);
  }
  if (result.okMessage) {
    redirect(
      `/importacoes/${result.loteId}/ajustes?ok=${encodeURIComponent(result.okMessage)}`,
    );
  }
  redirect(`/importacoes/${result.loteId}/ajustes?ok=1`);
}

async function requireReconcileSession() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!canReconcileImports(session.perfil)) {
    redirect("/importacoes?error=" + encodeURIComponent("Sem permissão."));
  }
  return session;
}

export async function updateInstituicoesBatchAction(formData: FormData) {
  const session = await requireReconcileSession();
  const loteId = String(formData.get("loteId") ?? "");

  const parsed = UpdateInstituicoesBatchSchema.safeParse({
    loteId: formData.get("loteId"),
    ids: formData.get("ids"),
    municipio: (formData.get("municipio") || undefined) as unknown,
    uf: (formData.get("uf") || undefined) as unknown,
  });
  if (!parsed.success) {
    redirectAjustesError(loteId, "Dados inválidos.");
  }

  finishAjuste(
    await updateInstituicoesBatch({ userId: session.id }, parsed.data),
    parsed.data.loteId,
  );
}

export async function updateProcessosBatchAction(formData: FormData) {
  const session = await requireReconcileSession();
  const loteId = String(formData.get("loteId") ?? "");

  const parsed = UpdateProcessosBatchSchema.safeParse({
    loteId: formData.get("loteId"),
    ids: formData.get("ids"),
    status: (formData.get("status") || undefined) as unknown,
    assunto: (formData.get("assunto") || undefined) as unknown,
  });
  if (!parsed.success) {
    redirectAjustesError(loteId, "Dados inválidos.");
  }

  finishAjuste(
    await updateProcessosBatch({ userId: session.id }, parsed.data),
    parsed.data.loteId,
  );
}

export async function mergeInstituicaoIntoAction(formData: FormData) {
  const session = await requireReconcileSession();
  const loteId = String(formData.get("loteId") ?? "");

  const parsed = MergeInstituicaoSchema.safeParse({
    loteId: formData.get("loteId"),
    fromInstituicaoId: formData.get("fromInstituicaoId"),
    toInstituicaoId: formData.get("toInstituicaoId"),
    confirm: (formData.get("confirm") || undefined) as unknown,
  });
  if (!parsed.success) {
    redirectAjustesError(loteId, "Dados inválidos.");
  }

  finishAjuste(
    await mergeInstituicaoInto({ userId: session.id }, parsed.data),
    parsed.data.loteId,
  );
}

export async function mergeProcessoIntoAction(formData: FormData) {
  const session = await requireReconcileSession();
  const loteId = String(formData.get("loteId") ?? "");

  const parsed = MergeProcessoSchema.safeParse({
    loteId: formData.get("loteId"),
    fromProcessoId: formData.get("fromProcessoId"),
    toProcessoId: formData.get("toProcessoId"),
    confirm: (formData.get("confirm") || undefined) as unknown,
  });
  if (!parsed.success) {
    redirectAjustesError(loteId, "Dados inválidos.");
  }

  finishAjuste(
    await mergeProcessoInto({ userId: session.id }, parsed.data),
    parsed.data.loteId,
  );
}
