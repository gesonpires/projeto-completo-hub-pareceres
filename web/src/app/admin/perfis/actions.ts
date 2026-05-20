"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { getSessionFromCookies } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { auditLog } from "@/server/audit";

async function requireProfilesWrite() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!hasPermission(session.perfil, "profiles:write")) {
    redirect(
      "/admin/perfis?error=" + encodeURIComponent("Sem permissão para editar perfis."),
    );
  }
  return session;
}

const UpdatePerfilSchema = z.object({
  id: z.string().uuid(),
  descricao: z.string().optional(),
});

export async function updatePerfilDescricaoAction(formData: FormData) {
  const session = await requireProfilesWrite();
  const parsed = UpdatePerfilSchema.safeParse({
    id: formData.get("id"),
    descricao: (formData.get("descricao") ?? undefined) as unknown,
  });
  if (!parsed.success) redirect("/admin/perfis?error=" + encodeURIComponent("Dados inválidos."));

  const current = await prisma.perfil.findFirst({
    where: { id: parsed.data.id },
    select: { id: true, nome: true, descricao: true },
  });
  if (!current) redirect("/admin/perfis?error=" + encodeURIComponent("Perfil não encontrado."));

  const descricao = parsed.data.descricao?.trim() || null;
  const updated = await prisma.perfil.update({
    where: { id: current.id },
    data: { descricao },
    select: { id: true, nome: true, descricao: true },
  });

  await auditLog({
    entidade: "perfis",
    entidadeId: updated.id,
    acao: "UPDATE",
    actorUserId: session.id,
    antes: current,
    depois: updated,
    metadata: { field: "descricao" },
  });

  redirect(
    "/admin/perfis?ok=" +
      encodeURIComponent(`Descrição atualizada para o perfil ${updated.nome}.`),
  );
}

