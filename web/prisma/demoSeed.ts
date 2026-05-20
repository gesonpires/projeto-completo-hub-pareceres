import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function main() {
  const admin = await prisma.usuario.findFirst({
    where: { email: process.env.SEED_ADMIN_EMAIL ?? "admin@cee-sc.local" },
    select: { id: true },
  });
  if (!admin) {
    throw new Error("Admin não encontrado. Rode `npm run seed` primeiro.");
  }

  const tipoOutro = await prisma.tipoDocumento.findUniqueOrThrow({
    where: { codigo: "OUTRO" },
    select: { id: true, codigo: true },
  });

  const inst = await prisma.instituicao.upsert({
    where: { cnpj: "23525623452353" },
    create: {
      nome: "ASSESSORITEC",
      nomeNormalizado: "ASSESSORITEC",
      cnpj: "23525623452353",
      municipio: "Florianópolis",
      uf: "SC",
      createdBy: admin.id,
      updatedBy: admin.id,
    },
    update: {
      deletedAt: null,
      updatedBy: admin.id,
    },
  });

  await prisma.processo.create({
    data: {
      instituicaoId: inst.id,
      numero: "123",
      ano: new Date().getFullYear(),
      status: "EM_TRAMITACAO",
      assunto: "Credenciamento e autorização de funcionamento (demo)",
      createdBy: admin.id,
      updatedBy: admin.id,
    },
  });

  await prisma.atoAutorizativo.create({
    data: {
      instituicaoId: inst.id,
      tipo: "PARECER",
      numero: "045/2026",
      dataAto: daysAgo(10),
      ementa: "Aprova em caráter demonstrativo (demo).",
      descricao: "Item de demonstração para validar relatório e auditoria.",
      createdBy: admin.id,
      updatedBy: admin.id,
    },
  });

  await prisma.eventoRegulatorio.create({
    data: {
      instituicaoId: inst.id,
      tipo: "PROTOCOLO",
      dataEvento: daysAgo(30),
      descricao: "Protocolo recebido e distribuído para análise (demo).",
      createdBy: admin.id,
      updatedBy: admin.id,
    },
  });

  await prisma.documento.create({
    data: {
      instituicaoId: inst.id,
      tipoDocumentoId: tipoOutro.id,
      titulo: "Documento de demonstração (sem anexo)",
      dataDocumento: daysAgo(20),
      createdBy: admin.id,
      updatedBy: admin.id,
    },
  });

  console.log(`Demo seed concluído. Instituição: ${inst.nome} (${inst.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

