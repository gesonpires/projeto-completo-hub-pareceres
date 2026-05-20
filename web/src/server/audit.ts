import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db";

export type AuditLogParams = {
  entidade: string;
  entidadeId: string;
  acao: "CREATE" | "UPDATE" | "DELETE" | "RESTORE";
  actorUserId: string;
  antes?: unknown;
  depois?: unknown;
  metadata?: unknown;
};

export async function auditLog(
  params: AuditLogParams,
  tx?: Prisma.TransactionClient,
) {
  const db = tx ?? prisma;
  await db.logAuditoria.create({
    data: {
      entidade: params.entidade,
      entidadeId: params.entidadeId,
      acao: params.acao,
      actorUserId: params.actorUserId,
      antes: params.antes as never,
      depois: params.depois as never,
      metadata: params.metadata as never,
    },
  });
}

export type AuditEventParams = {
  entidade: string;
  entidadeId: string;
  evento: string;
  actorUserId: string;
  metadata?: unknown;
};

export async function auditEvent(
  params: AuditEventParams,
  tx?: Prisma.TransactionClient,
) {
  const db = tx ?? prisma;
  await db.logAuditoria.create({
    data: {
      entidade: params.entidade,
      entidadeId: params.entidadeId,
      acao: "UPDATE",
      actorUserId: params.actorUserId,
      metadata: { evento: params.evento, ...(params.metadata as object) } as never,
    },
  });
}

