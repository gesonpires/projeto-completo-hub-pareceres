import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const perfis = ["ADMIN", "OPERADOR_DADOS", "ANALISTA", "LEITOR"] as const;

  for (const nome of perfis) {
    await prisma.perfil.upsert({
      where: { nome },
      create: { nome },
      update: {},
    });
  }

  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@cee-sc.local";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "admin123";
  const passwordHash = await bcrypt.hash(password, 12);

  const adminPerfil = await prisma.perfil.findUniqueOrThrow({
    where: { nome: "ADMIN" },
  });

  await prisma.usuario.upsert({
    where: { email },
    create: {
      email,
      nome: "Admin",
      ativo: true,
      passwordHash,
      perfilId: adminPerfil.id,
    },
    update: {
      ativo: true,
      passwordHash,
      perfilId: adminPerfil.id,
    },
  });

  // Tipos de documento mínimos
  const tipos = [
    { codigo: "OFICIO", nome: "Ofício" },
    { codigo: "PARECER", nome: "Parecer" },
    { codigo: "RESOLUCAO", nome: "Resolução" },
    { codigo: "OUTRO", nome: "Outro" },
  ] as const;

  for (const t of tipos) {
    await prisma.tipoDocumento.upsert({
      where: { codigo: t.codigo },
      create: t,
      update: { nome: t.nome },
    });
  }

  console.log(`Seed concluído. Admin: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

