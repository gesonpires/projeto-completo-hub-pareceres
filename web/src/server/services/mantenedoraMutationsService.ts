import { prisma } from "@/server/db";
import { auditLog } from "@/server/audit";
import { normalizeName } from "@/server/normalize";
import type { z } from "zod";
import type { MantenedoraMutationResult, MutationActor } from "./mantenedoraMutationsTypes";
import {
  CreateMantenedoraSchema,
  UpdateMantenedoraSchema,
} from "./mantenedoraMutationsSchemas";
import { validateOptionalCnpj } from "./mutationCnpjValidation";

export type { MantenedoraMutationResult } from "./mantenedoraMutationsTypes";
export { CreateMantenedoraSchema, UpdateMantenedoraSchema } from "./mantenedoraMutationsSchemas";

export async function createMantenedora(
  actor: MutationActor,
  input: z.infer<typeof CreateMantenedoraSchema>,
): Promise<MantenedoraMutationResult> {
  const cnpjResult = validateOptionalCnpj(input.cnpj);
  if (!cnpjResult.ok) return cnpjResult;

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.mantenedora.create({
      data: {
        razaoSocial: input.razaoSocial.trim(),
        nomeFantasia: input.nomeFantasia?.trim() || null,
        cnpj: cnpjResult.cnpj,
        nomeNormalizado: normalizeName(input.razaoSocial),
        createdBy: actor.userId,
        updatedBy: actor.userId,
      },
    });

    await auditLog(
      {
        entidade: "mantenedoras",
        entidadeId: row.id,
        acao: "CREATE",
        actorUserId: actor.userId,
        depois: row,
      },
      tx,
    );

    return row;
  });

  return { ok: true, mantenedoraId: created.id };
}

export async function updateMantenedora(
  actor: MutationActor,
  input: z.infer<typeof UpdateMantenedoraSchema>,
): Promise<MantenedoraMutationResult> {
  const cnpjResult = validateOptionalCnpj(input.cnpj);
  if (!cnpjResult.ok) return cnpjResult;

  const current = await prisma.mantenedora.findFirst({
    where: { id: input.id, deletedAt: null },
  });
  if (!current) {
    return { ok: false, error: "Registro não encontrado." };
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.mantenedora.update({
      where: { id: current.id },
      data: {
        razaoSocial: input.razaoSocial.trim(),
        nomeFantasia: input.nomeFantasia?.trim() || null,
        cnpj: cnpjResult.cnpj,
        nomeNormalizado: normalizeName(input.razaoSocial),
        updatedBy: actor.userId,
      },
    });

    await auditLog(
      {
        entidade: "mantenedoras",
        entidadeId: updated.id,
        acao: "UPDATE",
        actorUserId: actor.userId,
        antes: current,
        depois: updated,
      },
      tx,
    );
  });

  return { ok: true, mantenedoraId: current.id, redirectSuffix: "?ok=1" };
}
