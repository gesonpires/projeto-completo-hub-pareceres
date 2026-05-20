import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/server/db";

export type SessionUser = {
  id: string;
  email: string;
  nome: string;
  perfil: "ADMIN" | "OPERADOR_DADOS" | "ANALISTA" | "LEITOR";
};

const COOKIE_NAME = "hubpareceres_session";

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET não configurado");
  return new TextEncoder().encode(secret);
}

export async function createSessionCookie(user: SessionUser) {
  const token = await new SignJWT({
    sub: user.id,
    email: user.email,
    nome: user.nome,
    perfil: user.perfil,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecretKey());

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getSessionFromCookies(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    const sub = payload.sub;
    const email = payload.email;
    const nome = payload.nome;
    const perfil = payload.perfil;

    if (
      typeof sub !== "string" ||
      typeof email !== "string" ||
      typeof nome !== "string" ||
      (perfil !== "ADMIN" &&
        perfil !== "OPERADOR_DADOS" &&
        perfil !== "ANALISTA" &&
        perfil !== "LEITOR")
    ) {
      return null;
    }

    // Valida sessão contra o banco (evita cookie antigo após trocar DATABASE_URL).
    const user = await prisma.usuario.findUnique({
      where: { id: sub },
      select: { id: true, email: true, nome: true, ativo: true, perfil: { select: { nome: true } } },
    });

    if (!user || !user.ativo) {
      await clearSessionCookie();
      return null;
    }

    const perfilDb = user.perfil?.nome;
    if (
      perfilDb !== "ADMIN" &&
      perfilDb !== "OPERADOR_DADOS" &&
      perfilDb !== "ANALISTA" &&
      perfilDb !== "LEITOR"
    ) {
      await clearSessionCookie();
      return null;
    }

    // Usa dados do banco como fonte de verdade.
    return { id: user.id, email: user.email, nome: user.nome, perfil: perfilDb };
  } catch {
    return null;
  }
}

