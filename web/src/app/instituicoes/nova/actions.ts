"use server";

import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import {
  CreateInstituicaoSchema,
  createInstituicao,
} from "@/server/services/instituicaoMutationsService";

export async function createInstituicaoAction(formData: FormData) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!hasPermission(session.perfil, "institutions:write")) {
    redirect("/instituicoes/nova?error=" + encodeURIComponent("Sem permissão para criar."));
  }

  const parsed = CreateInstituicaoSchema.safeParse({
    nome: formData.get("nome"),
    cnpj: formData.get("cnpj") || undefined,
    municipio: formData.get("municipio") || undefined,
    uf: formData.get("uf") || undefined,
    mantenedoraId: formData.get("mantenedoraId") || undefined,
  });

  if (!parsed.success) {
    redirect("/instituicoes/nova?error=" + encodeURIComponent("Dados inválidos."));
  }

  const result = await createInstituicao({ userId: session.id }, parsed.data);
  if (!result.ok) {
    redirect("/instituicoes/nova?error=" + encodeURIComponent(result.error));
  }

  redirect(`/instituicoes/${result.instituicaoId}`);
}
