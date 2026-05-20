"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { getSessionFromCookies } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { auditEvent, auditLog } from "@/server/audit";
import { Prisma } from "@/generated/prisma/client";

function requireUsersWrite() {
  return getSessionFromCookies().then((s) => {
    if (!s) redirect("/login");
    if (!hasPermission(s.perfil, "users:write")) {
      redirect(
        "/admin/usuarios?error=" + encodeURIComponent("Sem permissão para gerenciar usuários."),
      );
    }
    return s;
  });
}

const CreateUserSchema = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  perfilId: z.string().uuid(),
  password: z.string().min(6),
});

export async function createUserAction(formData: FormData) {
  const session = await requireUsersWrite();
  const parsed = CreateUserSchema.safeParse({
    nome: formData.get("nome"),
    email: formData.get("email"),
    perfilId: formData.get("perfilId"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    redirect("/admin/usuarios?error=" + encodeURIComponent("Dados inválidos."));
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  let created: { id: string; nome: string; email: string; ativo: boolean; perfilId: string } | null =
    null;
  try {
    created = await prisma.usuario.create({
      data: {
        nome: parsed.data.nome.trim(),
        email: parsed.data.email.trim().toLowerCase(),
        passwordHash,
        perfilId: parsed.data.perfilId,
        ativo: true,
      },
      select: { id: true, nome: true, email: true, ativo: true, perfilId: true },
    });
  } catch (e) {
    // Erro de unicidade (email duplicado)
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      redirect(
        "/admin/usuarios?error=" +
          encodeURIComponent("Já existe um usuário com este email."),
      );
    }
    const msg = e instanceof Error ? e.message : String(e);
    redirect("/admin/usuarios?error=" + encodeURIComponent(`Falha ao criar usuário: ${msg}`));
  }

  // A partir daqui não usamos try/catch: redirect() lança NEXT_REDIRECT por design.
  await auditLog({
    entidade: "usuarios",
    entidadeId: created.id,
    acao: "CREATE",
    actorUserId: session.id,
    depois: created,
  });

  redirect(
    "/admin/usuarios?ok=" +
      encodeURIComponent(`Usuário criado: ${created.nome} (${created.email}).`),
  );
}

const ToggleActiveSchema = z.object({
  userId: z.string().uuid(),
  ativo: z.enum(["0", "1"]),
  confirm: z.string().optional(),
});

export async function setUserActiveAction(formData: FormData) {
  const session = await requireUsersWrite();
  const parsed = ToggleActiveSchema.safeParse({
    userId: formData.get("userId"),
    ativo: formData.get("ativo"),
    confirm: formData.get("confirm") || undefined,
  });
  if (!parsed.success) redirect("/admin/usuarios?error=" + encodeURIComponent("Dados inválidos."));

  const current = await prisma.usuario.findFirst({
    where: { id: parsed.data.userId },
    select: { id: true, ativo: true, email: true, nome: true, perfilId: true, perfil: { select: { nome: true } } },
  });
  if (!current) redirect("/admin/usuarios?error=" + encodeURIComponent("Usuário não encontrado."));

  const nextAtivo = parsed.data.ativo === "1";
  if (!nextAtivo) {
    if (!parsed.data.confirm) {
      redirect("/admin/usuarios?error=" + encodeURIComponent("Confirmação obrigatória para desativar usuário."));
    }
    if (current.id === session.id) {
      redirect("/admin/usuarios?error=" + encodeURIComponent("Você não pode desativar seu próprio usuário."));
    }
    const currentIsAdmin = current.perfil?.nome === "ADMIN";
    if (currentIsAdmin) {
      const adminsAtivos = await prisma.usuario.count({
        where: { ativo: true, perfil: { nome: "ADMIN" } },
      });
      if (adminsAtivos <= 1) {
        redirect(
          "/admin/usuarios?error=" +
            encodeURIComponent("Não é permitido desativar o último ADMIN ativo."),
        );
      }
    }
  }
  const updated = await prisma.usuario.update({
    where: { id: current.id },
    data: { ativo: nextAtivo },
    select: { id: true, ativo: true, email: true, nome: true, perfilId: true },
  });

  await auditLog({
    entidade: "usuarios",
    entidadeId: updated.id,
    acao: "UPDATE",
    actorUserId: session.id,
    antes: current,
    depois: updated,
    metadata: { field: "ativo" },
  });

  redirect(
    "/admin/usuarios?ok=" +
      encodeURIComponent(
        `Usuário ${updated.email}: ${updated.ativo ? "ativado" : "desativado"}.`,
      ),
  );
}

const SetPerfilSchema = z.object({
  userId: z.string().uuid(),
  perfilId: z.string().uuid(),
  confirm: z.string().optional(),
});

export async function setUserPerfilAction(formData: FormData) {
  const session = await requireUsersWrite();
  const parsed = SetPerfilSchema.safeParse({
    userId: formData.get("userId"),
    perfilId: formData.get("perfilId"),
    confirm: formData.get("confirm") || undefined,
  });
  if (!parsed.success) redirect("/admin/usuarios?error=" + encodeURIComponent("Dados inválidos."));

  const current = await prisma.usuario.findFirst({
    where: { id: parsed.data.userId },
    select: { id: true, perfilId: true, email: true, nome: true, ativo: true, perfil: { select: { nome: true } } },
  });
  if (!current) redirect("/admin/usuarios?error=" + encodeURIComponent("Usuário não encontrado."));

  if (!parsed.data.confirm) {
    redirect("/admin/usuarios?error=" + encodeURIComponent("Confirmação obrigatória para alterar perfil."));
  }

  // Evita lockout acidental: trocar o próprio perfil exige atenção extra.
  if (current.id === session.id && current.perfilId !== parsed.data.perfilId) {
    redirect(
      "/admin/usuarios?error=" +
        encodeURIComponent("Por segurança, não é permitido alterar o seu próprio perfil."),
    );
  }

  // Evita ficar sem ADMIN ativo.
  const currentIsAdmin = current.perfil?.nome === "ADMIN";
  if (currentIsAdmin && current.perfilId !== parsed.data.perfilId) {
    const nextPerfil = await prisma.perfil.findFirst({
      where: { id: parsed.data.perfilId },
      select: { id: true, nome: true },
    });
    if (!nextPerfil) {
      redirect("/admin/usuarios?error=" + encodeURIComponent("Perfil inválido."));
    }
    if (nextPerfil.nome !== "ADMIN") {
      const adminsAtivos = await prisma.usuario.count({
        where: { ativo: true, perfil: { nome: "ADMIN" } },
      });
      if (adminsAtivos <= 1) {
        redirect(
          "/admin/usuarios?error=" +
            encodeURIComponent("Não é permitido remover o último ADMIN ativo."),
        );
      }
    }
  }

  const updated = await prisma.usuario.update({
    where: { id: current.id },
    data: { perfilId: parsed.data.perfilId },
    select: { id: true, perfilId: true, email: true, nome: true, ativo: true },
  });

  await auditLog({
    entidade: "usuarios",
    entidadeId: updated.id,
    acao: "UPDATE",
    actorUserId: session.id,
    antes: current,
    depois: updated,
    metadata: { field: "perfilId" },
  });

  redirect(
    "/admin/usuarios?ok=" +
      encodeURIComponent(`Perfil atualizado para ${updated.email}.`),
  );
}

const SetPasswordSchema = z.object({
  userId: z.string().uuid(),
  password: z.string().min(6),
  confirm: z.string().optional(),
});

export async function setUserPasswordAction(formData: FormData) {
  const session = await requireUsersWrite();
  const parsed = SetPasswordSchema.safeParse({
    userId: formData.get("userId"),
    password: formData.get("password"),
    confirm: formData.get("confirm") || undefined,
  });
  if (!parsed.success) redirect("/admin/usuarios?error=" + encodeURIComponent("Senha inválida."));
  if (!parsed.data.confirm) {
    redirect("/admin/usuarios?error=" + encodeURIComponent("Confirmação obrigatória para resetar senha."));
  }

  const current = await prisma.usuario.findFirst({
    where: { id: parsed.data.userId },
    select: { id: true, email: true, nome: true, ativo: true, perfilId: true, updatedAt: true },
  });
  if (!current) redirect("/admin/usuarios?error=" + encodeURIComponent("Usuário não encontrado."));

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.usuario.update({
    where: { id: current.id },
    data: { passwordHash },
    select: { id: true },
  });

  await auditEvent({
    entidade: "usuarios",
    entidadeId: current.id,
    evento: "RESET_PASSWORD",
    actorUserId: session.id,
    metadata: { targetEmail: current.email },
  });

  redirect(
    "/admin/usuarios?ok=" +
      encodeURIComponent(`Senha resetada para ${current.email}.`),
  );
}

