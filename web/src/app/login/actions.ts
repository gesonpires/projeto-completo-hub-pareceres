"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/server/db";
import { createSessionCookie, clearSessionCookie } from "@/server/auth";
import { redirect } from "next/navigation";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  next: z.string().optional(),
});

export async function loginAction(formData: FormData) {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    redirect("/login?error=" + encodeURIComponent("Credenciais inválidas."));
  }

  const { email, password, next } = parsed.data;

  const user = await prisma.usuario.findUnique({
    where: { email },
    include: { perfil: true },
  });

  if (!user || !user.ativo) {
    redirect("/login?error=" + encodeURIComponent("Usuário ou senha inválidos."));
  }

  const passwordHash = (user as unknown as { passwordHash?: string }).passwordHash;
  if (!passwordHash) {
    redirect("/login?error=" + encodeURIComponent("Usuário sem senha configurada."));
  }

  const ok = await bcrypt.compare(password, passwordHash);
  if (!ok) {
    redirect("/login?error=" + encodeURIComponent("Usuário ou senha inválidos."));
  }

  await createSessionCookie({
    id: user.id,
    email: user.email,
    nome: user.nome,
    perfil: user.perfil.nome,
  });

  redirect(next?.startsWith("/") ? next : "/");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}

