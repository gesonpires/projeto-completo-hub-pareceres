"use server";

import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import {
  UpdateMantenedoraSchema,
  updateMantenedora,
} from "@/server/services/mantenedoraMutationsService";

function backTo(id: string, message: string): never {
  redirect(`/mantenedoras/${id}?error=${encodeURIComponent(message)}`);
}

export async function updateMantenedoraAction(formData: FormData) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");

  const id = String(formData.get("id") ?? "");
  if (!hasPermission(session.perfil, "maintainers:write")) {
    return backTo(id, "Sem permissão.");
  }

  const parsed = UpdateMantenedoraSchema.safeParse({
    id: formData.get("id"),
    razaoSocial: formData.get("razaoSocial"),
    nomeFantasia: formData.get("nomeFantasia") || undefined,
    cnpj: formData.get("cnpj") || undefined,
  });
  if (!parsed.success) return backTo(id, "Dados inválidos.");

  const result = await updateMantenedora({ userId: session.id }, parsed.data);
  if (!result.ok) return backTo(parsed.data.id, result.error);

  redirect(
    `/mantenedoras/${result.mantenedoraId}${result.redirectSuffix ?? ""}`,
  );
}
