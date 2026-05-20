"use server";

import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import {
  CreateMantenedoraSchema,
  createMantenedora,
} from "@/server/services/mantenedoraMutationsService";

export async function createMantenedoraAction(formData: FormData) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!hasPermission(session.perfil, "maintainers:write")) {
    redirect(
      "/mantenedoras/nova?error=" +
        encodeURIComponent("Sem permissão para criar mantenedora."),
    );
  }

  const parsed = CreateMantenedoraSchema.safeParse({
    razaoSocial: formData.get("razaoSocial"),
    nomeFantasia: formData.get("nomeFantasia") || undefined,
    cnpj: formData.get("cnpj") || undefined,
  });
  if (!parsed.success) {
    redirect("/mantenedoras/nova?error=" + encodeURIComponent("Dados inválidos."));
  }

  const result = await createMantenedora({ userId: session.id }, parsed.data);
  if (!result.ok) {
    redirect("/mantenedoras/nova?error=" + encodeURIComponent(result.error));
  }

  redirect(`/mantenedoras/${result.mantenedoraId}`);
}
