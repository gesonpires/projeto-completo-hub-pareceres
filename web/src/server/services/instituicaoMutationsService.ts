import { prisma } from "@/server/db";
import { auditLog } from "@/server/audit";
import { normalizeMunicipio, normalizeName, normalizeUf } from "@/server/normalize";
import type { MutationActor, InstituicaoMutationResult } from "./instituicaoMutationsTypes";
import type { z } from "zod";
import {
  CreateInstituicaoSchema,
  CreateAtoSchema,
  CreateDocumentoSchema,
  CreateEventoSchema,
  CreateProcessoSchema,
  CreateTramitacaoSchema,
  DeleteEntitySchema,
  DeleteTramitacaoSchema,
  UpdateAtoSchema,
  UpdateDocumentoSchema,
  UpdateEventoSchema,
  UpdateInstituicaoMantenedoraSchema,
  UpdateProcessoSchema,
  UpdateTramitacaoSchema,
} from "./instituicaoMutationsSchemas";
import {
  isUploadableFile,
  persistDocumentoArquivo,
  validateUploadSize,
} from "./instituicaoMutationsDocumentStorage";
import { validateOptionalCnpj } from "./mutationCnpjValidation";

export type { InstituicaoMutationResult } from "./instituicaoMutationsTypes";
export {
  CreateInstituicaoSchema,
  CreateAtoSchema,
  CreateDocumentoSchema,
  CreateEventoSchema,
  CreateProcessoSchema,
  CreateTramitacaoSchema,
  DeleteEntitySchema,
  DeleteTramitacaoSchema,
  UpdateAtoSchema,
  UpdateDocumentoSchema,
  UpdateEventoSchema,
  UpdateInstituicaoMantenedoraSchema,
  UpdateProcessoSchema,
  UpdateTramitacaoSchema,
} from "./instituicaoMutationsSchemas";
export { firstZodIssueMessage, validateOptionalInstituicaoCnpj } from "./instituicaoMutationsValidation";
export { validateOptionalCnpj } from "./mutationCnpjValidation";

export async function createInstituicao(
  actor: MutationActor,
  input: z.infer<typeof CreateInstituicaoSchema>,
): Promise<InstituicaoMutationResult> {
  const cnpjResult = validateOptionalCnpj(input.cnpj);
  if (!cnpjResult.ok) return cnpjResult;

  const mantenedoraId = input.mantenedoraId ?? null;
  if (mantenedoraId) {
    const exists = await prisma.mantenedora.findFirst({
      where: { id: mantenedoraId, deletedAt: null },
      select: { id: true },
    });
    if (!exists) {
      return { ok: false, error: "Mantenedora inválida (não encontrada)." };
    }
  }

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.instituicao.create({
      data: {
        nome: input.nome.trim(),
        nomeNormalizado: normalizeName(input.nome),
        cnpj: cnpjResult.cnpj,
        municipio: input.municipio ? normalizeMunicipio(input.municipio) : null,
        uf: input.uf ? normalizeUf(input.uf) || null : null,
        mantenedoraId,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      },
    });

    await auditLog(
      {
        entidade: "instituicoes",
        entidadeId: row.id,
        acao: "CREATE",
        actorUserId: actor.userId,
        depois: row,
      },
      tx,
    );

    return row;
  });

  return { ok: true, instituicaoId: created.id };
}

async function resolveDocumentoVinculos(
  instituicaoId: string,
  input: {
    processoId?: string | null;
    atoId?: string | null;
    eventoId?: string | null;
  },
): Promise<
  | { ok: true; processoId: string | null; atoId: string | null; eventoId: string | null }
  | { ok: false; error: string }
> {
  const linkCount =
    Number(Boolean(input.processoId)) +
    Number(Boolean(input.atoId)) +
    Number(Boolean(input.eventoId));
  if (linkCount > 1) {
    return {
      ok: false,
      error: "Escolha apenas um vínculo: processo OU ato OU evento.",
    };
  }

  let processoId: string | null = input.processoId ?? null;
  const atoId: string | null = input.atoId ?? null;
  const eventoId: string | null = input.eventoId ?? null;

  if (processoId) {
    const exists = await prisma.processo.findFirst({
      where: { id: processoId, instituicaoId, deletedAt: null },
      select: { id: true },
    });
    if (!exists) return { ok: false, error: "Processo inválido (não encontrado)." };
  }
  if (atoId) {
    const ato = await prisma.atoAutorizativo.findFirst({
      where: { id: atoId, instituicaoId, deletedAt: null },
      select: { id: true, processoId: true },
    });
    if (!ato) return { ok: false, error: "Ato inválido (não encontrado)." };
    if (ato.processoId) {
      if (processoId && processoId !== ato.processoId) {
        return { ok: false, error: "Vínculo inválido: ato pertence a outro processo." };
      }
      processoId = ato.processoId;
    }
  }
  if (eventoId) {
    const evt = await prisma.eventoRegulatorio.findFirst({
      where: { id: eventoId, instituicaoId, deletedAt: null },
      select: { id: true, processoId: true },
    });
    if (!evt) return { ok: false, error: "Evento inválido (não encontrado)." };
    if (evt.processoId) {
      if (processoId && processoId !== evt.processoId) {
        return { ok: false, error: "Vínculo inválido: evento pertence a outro processo." };
      }
      processoId = evt.processoId;
    }
  }

  return { ok: true, processoId, atoId, eventoId };
}

export async function updateInstituicaoMantenedora(
  actor: MutationActor,
  input: z.infer<typeof UpdateInstituicaoMantenedoraSchema>,
): Promise<InstituicaoMutationResult> {
  const current = await prisma.instituicao.findFirst({
    where: { id: input.instituicaoId, deletedAt: null },
    select: { id: true, mantenedoraId: true, updatedBy: true, updatedAt: true },
  });
  if (!current) {
    return { ok: false, error: "Instituição não encontrada." };
  }

  const nextMantenedoraId = input.mantenedoraId ?? null;
  if (nextMantenedoraId) {
    const exists = await prisma.mantenedora.findFirst({
      where: { id: nextMantenedoraId, deletedAt: null },
      select: { id: true },
    });
    if (!exists) {
      return { ok: false, error: "Mantenedora inválida (não encontrada)." };
    }
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.instituicao.update({
      where: { id: current.id },
      data: {
        mantenedoraId: nextMantenedoraId,
        updatedBy: actor.userId,
      },
    });

    await auditLog(
      {
        entidade: "instituicoes",
        entidadeId: updated.id,
        acao: "UPDATE",
        actorUserId: actor.userId,
        antes: current,
        depois: updated,
        metadata: { field: "mantenedoraId" },
      },
      tx,
    );
  });

  return { ok: true, instituicaoId: input.instituicaoId };
}

export async function createTramitacao(
  actor: MutationActor,
  input: z.infer<typeof CreateTramitacaoSchema>,
): Promise<InstituicaoMutationResult> {
  const proc = await prisma.processo.findFirst({
    where: {
      id: input.processoId,
      instituicaoId: input.instituicaoId,
      deletedAt: null,
    },
  });
  if (!proc) {
    return { ok: false, error: "Processo inválido (não encontrado)." };
  }

  await prisma.$transaction(async (tx) => {
    const created = await tx.tramitacao.create({
      data: {
        processoId: proc.id,
        dataMovimento: new Date(input.dataMovimento),
        status: input.status ?? "ENCAMINHADO",
        deSetor: input.deSetor?.trim() || null,
        paraSetor: input.paraSetor?.trim() || null,
        observacao: input.observacao?.trim() || null,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      },
    });

    await auditLog(
      {
        entidade: "tramitacoes",
        entidadeId: created.id,
        acao: "CREATE",
        actorUserId: actor.userId,
        depois: created,
        metadata: { instituicaoId: input.instituicaoId, processoId: proc.id },
      },
      tx,
    );
  });

  return { ok: true, instituicaoId: input.instituicaoId };
}

export async function updateTramitacao(
  actor: MutationActor,
  input: z.infer<typeof UpdateTramitacaoSchema>,
): Promise<InstituicaoMutationResult> {
  const current = await prisma.tramitacao.findFirst({
    where: { id: input.id, deletedAt: null, processoId: input.processoId },
    include: { processo: { select: { instituicaoId: true } } },
  });
  if (!current || current.processo.instituicaoId !== input.instituicaoId) {
    return { ok: false, error: "Registro não encontrado." };
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.tramitacao.update({
      where: { id: current.id },
      data: {
        dataMovimento: new Date(input.dataMovimento),
        status: input.status ?? current.status,
        deSetor: input.deSetor?.trim() || null,
        paraSetor: input.paraSetor?.trim() || null,
        observacao: input.observacao?.trim() || null,
        updatedBy: actor.userId,
      },
    });

    await auditLog(
      {
        entidade: "tramitacoes",
        entidadeId: updated.id,
        acao: "UPDATE",
        actorUserId: actor.userId,
        antes: current,
        depois: updated,
        metadata: { instituicaoId: input.instituicaoId, processoId: input.processoId },
      },
      tx,
    );
  });

  return { ok: true, instituicaoId: input.instituicaoId };
}

export async function deleteTramitacao(
  actor: MutationActor,
  input: z.infer<typeof DeleteTramitacaoSchema>,
): Promise<InstituicaoMutationResult> {
  if (input.confirm !== "1") {
    return { ok: false, error: "Marque “Confirmar” para remover." };
  }

  const current = await prisma.tramitacao.findFirst({
    where: { id: input.id, processoId: input.processoId, deletedAt: null },
    include: { processo: { select: { instituicaoId: true } } },
  });
  if (!current || current.processo.instituicaoId !== input.instituicaoId) {
    return { ok: false, error: "Registro não encontrado." };
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.tramitacao.update({
      where: { id: current.id },
      data: { deletedAt: new Date(), updatedBy: actor.userId },
    });

    await auditLog(
      {
        entidade: "tramitacoes",
        entidadeId: updated.id,
        acao: "DELETE",
        actorUserId: actor.userId,
        antes: current,
        depois: updated,
        metadata: { instituicaoId: input.instituicaoId, processoId: input.processoId },
      },
      tx,
    );
  });

  return { ok: true, instituicaoId: input.instituicaoId };
}

export async function restoreTramitacao(
  actor: MutationActor,
  input: Pick<z.infer<typeof DeleteTramitacaoSchema>, "instituicaoId" | "id" | "processoId">,
): Promise<InstituicaoMutationResult> {
  const current = await prisma.tramitacao.findFirst({
    where: { id: input.id, processoId: input.processoId },
    include: { processo: { select: { instituicaoId: true } } },
  });
  if (!current || !current.deletedAt || current.processo.instituicaoId !== input.instituicaoId) {
    return { ok: false, error: "Registro não encontrado." };
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.tramitacao.update({
      where: { id: current.id },
      data: { deletedAt: null, updatedBy: actor.userId },
    });

    await auditLog(
      {
        entidade: "tramitacoes",
        entidadeId: updated.id,
        acao: "RESTORE",
        actorUserId: actor.userId,
        antes: current,
        depois: updated,
        metadata: { instituicaoId: input.instituicaoId, processoId: input.processoId },
      },
      tx,
    );
  });

  return { ok: true, instituicaoId: input.instituicaoId, redirectSuffix: "?showDeleted=1" };
}

export async function createProcesso(
  actor: MutationActor,
  input: z.infer<typeof CreateProcessoSchema>,
): Promise<InstituicaoMutationResult> {
  await prisma.$transaction(async (tx) => {
    const created = await tx.processo.create({
      data: {
        instituicaoId: input.instituicaoId,
        numero: input.numero?.trim() || null,
        ano: input.ano ?? null,
        status: input.status ?? "ABERTO",
        assunto: input.assunto?.trim() || null,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      },
    });

    await auditLog(
      {
        entidade: "processos",
        entidadeId: created.id,
        acao: "CREATE",
        actorUserId: actor.userId,
        depois: created,
      },
      tx,
    );
  });

  return { ok: true, instituicaoId: input.instituicaoId };
}

export async function createAto(
  actor: MutationActor,
  input: z.infer<typeof CreateAtoSchema>,
): Promise<InstituicaoMutationResult> {
  await prisma.$transaction(async (tx) => {
    const created = await tx.atoAutorizativo.create({
      data: {
        instituicaoId: input.instituicaoId,
        tipo: input.tipo,
        numero: input.numero?.trim() || null,
        dataAto: new Date(input.dataAto),
        ementa: input.ementa?.trim() || null,
        descricao: input.descricao?.trim() || null,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      },
    });

    await auditLog(
      {
        entidade: "atos_autorizativos",
        entidadeId: created.id,
        acao: "CREATE",
        actorUserId: actor.userId,
        depois: created,
      },
      tx,
    );
  });

  return { ok: true, instituicaoId: input.instituicaoId };
}

export async function createEvento(
  actor: MutationActor,
  input: z.infer<typeof CreateEventoSchema>,
): Promise<InstituicaoMutationResult> {
  await prisma.$transaction(async (tx) => {
    const created = await tx.eventoRegulatorio.create({
      data: {
        instituicaoId: input.instituicaoId,
        tipo: input.tipo,
        dataEvento: new Date(input.dataEvento),
        descricao: input.descricao.trim(),
        createdBy: actor.userId,
        updatedBy: actor.userId,
      },
    });

    await auditLog(
      {
        entidade: "eventos_regulatorios",
        entidadeId: created.id,
        acao: "CREATE",
        actorUserId: actor.userId,
        depois: created,
      },
      tx,
    );
  });

  return { ok: true, instituicaoId: input.instituicaoId };
}

export async function createDocumento(
  actor: MutationActor,
  input: z.infer<typeof CreateDocumentoSchema>,
  file: unknown,
): Promise<InstituicaoMutationResult> {
  const vinculos = await resolveDocumentoVinculos(input.instituicaoId, input);
  if (!vinculos.ok) return { ok: false, error: vinculos.error };

  const tipoDocumento = await prisma.tipoDocumento.findUnique({
    where: { codigo: input.tipoDocumentoCodigo },
  });
  if (!tipoDocumento) {
    return { ok: false, error: "Tipo de documento inválido." };
  }

  const uploadedFile = isUploadableFile(file) ? file : null;
  if (uploadedFile) {
    const sizeError = validateUploadSize(uploadedFile);
    if (sizeError) return { ok: false, error: sizeError };
  }

  const created = await prisma.documento.create({
    data: {
      instituicaoId: input.instituicaoId,
      processoId: vinculos.processoId,
      atoId: vinculos.atoId,
      eventoId: vinculos.eventoId,
      tipoDocumentoId: tipoDocumento.id,
      titulo: input.titulo.trim(),
      dataDocumento: input.dataDocumento ? new Date(input.dataDocumento) : null,
      createdBy: actor.userId,
      updatedBy: actor.userId,
    },
  });

  if (uploadedFile && uploadedFile.size > 0) {
    const stored = await persistDocumentoArquivo({
      instituicaoId: input.instituicaoId,
      documentoId: created.id,
      file: uploadedFile,
    });

    await prisma.$transaction(async (tx) => {
      const updated = await tx.documento.update({
        where: { id: created.id },
        data: {
          arquivoNome: stored.arquivoNome,
          arquivoMime: stored.arquivoMime,
          arquivoTamanho: stored.arquivoTamanho,
          storagePath: stored.relativePath,
          updatedBy: actor.userId,
        },
      });

      await auditLog(
        {
          entidade: "documentos",
          entidadeId: created.id,
          acao: "UPDATE",
          actorUserId: actor.userId,
          antes: created,
          depois: updated,
          metadata: { reason: "upload_arquivo" },
        },
        tx,
      );
    });
  }

  await auditLog({
    entidade: "documentos",
    entidadeId: created.id,
    acao: "CREATE",
    actorUserId: actor.userId,
    depois: created,
  });

  return { ok: true, instituicaoId: input.instituicaoId };
}

export async function deleteProcesso(
  actor: MutationActor,
  input: z.infer<typeof DeleteEntitySchema>,
): Promise<InstituicaoMutationResult> {
  if (input.confirm !== "1") {
    return { ok: false, error: "Marque “Confirmar” para remover." };
  }

  const current = await prisma.processo.findFirst({
    where: { id: input.id, instituicaoId: input.instituicaoId, deletedAt: null },
  });
  if (!current) return { ok: false, error: "Registro não encontrado." };

  await prisma.$transaction(async (tx) => {
    const updated = await tx.processo.update({
      where: { id: current.id },
      data: { deletedAt: new Date(), updatedBy: actor.userId },
    });

    await auditLog(
      {
        entidade: "processos",
        entidadeId: updated.id,
        acao: "DELETE",
        actorUserId: actor.userId,
        antes: current,
        depois: updated,
      },
      tx,
    );
  });

  return { ok: true, instituicaoId: input.instituicaoId };
}

export async function deleteAto(
  actor: MutationActor,
  input: z.infer<typeof DeleteEntitySchema>,
): Promise<InstituicaoMutationResult> {
  if (input.confirm !== "1") {
    return { ok: false, error: "Marque “Confirmar” para remover." };
  }

  const current = await prisma.atoAutorizativo.findFirst({
    where: { id: input.id, instituicaoId: input.instituicaoId, deletedAt: null },
  });
  if (!current) return { ok: false, error: "Registro não encontrado." };

  await prisma.$transaction(async (tx) => {
    const updated = await tx.atoAutorizativo.update({
      where: { id: current.id },
      data: { deletedAt: new Date(), updatedBy: actor.userId },
    });

    await auditLog(
      {
        entidade: "atos_autorizativos",
        entidadeId: updated.id,
        acao: "DELETE",
        actorUserId: actor.userId,
        antes: current,
        depois: updated,
      },
      tx,
    );
  });

  return { ok: true, instituicaoId: input.instituicaoId };
}

export async function deleteEvento(
  actor: MutationActor,
  input: z.infer<typeof DeleteEntitySchema>,
): Promise<InstituicaoMutationResult> {
  if (input.confirm !== "1") {
    return { ok: false, error: "Marque “Confirmar” para remover." };
  }

  const current = await prisma.eventoRegulatorio.findFirst({
    where: { id: input.id, instituicaoId: input.instituicaoId, deletedAt: null },
  });
  if (!current) return { ok: false, error: "Registro não encontrado." };

  await prisma.$transaction(async (tx) => {
    const updated = await tx.eventoRegulatorio.update({
      where: { id: current.id },
      data: { deletedAt: new Date(), updatedBy: actor.userId },
    });

    await auditLog(
      {
        entidade: "eventos_regulatorios",
        entidadeId: updated.id,
        acao: "DELETE",
        actorUserId: actor.userId,
        antes: current,
        depois: updated,
      },
      tx,
    );
  });

  return { ok: true, instituicaoId: input.instituicaoId };
}

export async function deleteDocumento(
  actor: MutationActor,
  input: z.infer<typeof DeleteEntitySchema>,
): Promise<InstituicaoMutationResult> {
  if (input.confirm !== "1") {
    return { ok: false, error: "Marque “Confirmar” para remover." };
  }

  const current = await prisma.documento.findFirst({
    where: { id: input.id, instituicaoId: input.instituicaoId, deletedAt: null },
  });
  if (!current) return { ok: false, error: "Registro não encontrado." };

  await prisma.$transaction(async (tx) => {
    const updated = await tx.documento.update({
      where: { id: current.id },
      data: { deletedAt: new Date(), updatedBy: actor.userId },
    });

    await auditLog(
      {
        entidade: "documentos",
        entidadeId: updated.id,
        acao: "DELETE",
        actorUserId: actor.userId,
        antes: current,
        depois: updated,
        metadata: { note: "arquivo permanece no storage (MVP)" },
      },
      tx,
    );
  });

  return { ok: true, instituicaoId: input.instituicaoId };
}

export async function restoreProcesso(
  actor: MutationActor,
  input: Pick<z.infer<typeof DeleteEntitySchema>, "instituicaoId" | "id">,
): Promise<InstituicaoMutationResult> {
  const current = await prisma.processo.findFirst({
    where: { id: input.id, instituicaoId: input.instituicaoId },
  });
  if (!current || !current.deletedAt) {
    return { ok: false, error: "Registro não encontrado." };
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.processo.update({
      where: { id: current.id },
      data: { deletedAt: null, updatedBy: actor.userId },
    });

    await auditLog(
      {
        entidade: "processos",
        entidadeId: updated.id,
        acao: "RESTORE",
        actorUserId: actor.userId,
        antes: current,
        depois: updated,
      },
      tx,
    );
  });

  return { ok: true, instituicaoId: input.instituicaoId, redirectSuffix: "?showDeleted=1" };
}

export async function restoreAto(
  actor: MutationActor,
  input: Pick<z.infer<typeof DeleteEntitySchema>, "instituicaoId" | "id">,
): Promise<InstituicaoMutationResult> {
  const current = await prisma.atoAutorizativo.findFirst({
    where: { id: input.id, instituicaoId: input.instituicaoId },
  });
  if (!current || !current.deletedAt) {
    return { ok: false, error: "Registro não encontrado." };
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.atoAutorizativo.update({
      where: { id: current.id },
      data: { deletedAt: null, updatedBy: actor.userId },
    });

    await auditLog(
      {
        entidade: "atos_autorizativos",
        entidadeId: updated.id,
        acao: "RESTORE",
        actorUserId: actor.userId,
        antes: current,
        depois: updated,
      },
      tx,
    );
  });

  return { ok: true, instituicaoId: input.instituicaoId, redirectSuffix: "?showDeleted=1" };
}

export async function restoreEvento(
  actor: MutationActor,
  input: Pick<z.infer<typeof DeleteEntitySchema>, "instituicaoId" | "id">,
): Promise<InstituicaoMutationResult> {
  const current = await prisma.eventoRegulatorio.findFirst({
    where: { id: input.id, instituicaoId: input.instituicaoId },
  });
  if (!current || !current.deletedAt) {
    return { ok: false, error: "Registro não encontrado." };
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.eventoRegulatorio.update({
      where: { id: current.id },
      data: { deletedAt: null, updatedBy: actor.userId },
    });

    await auditLog(
      {
        entidade: "eventos_regulatorios",
        entidadeId: updated.id,
        acao: "RESTORE",
        actorUserId: actor.userId,
        antes: current,
        depois: updated,
      },
      tx,
    );
  });

  return { ok: true, instituicaoId: input.instituicaoId, redirectSuffix: "?showDeleted=1" };
}

export async function restoreDocumento(
  actor: MutationActor,
  input: Pick<z.infer<typeof DeleteEntitySchema>, "instituicaoId" | "id">,
): Promise<InstituicaoMutationResult> {
  const current = await prisma.documento.findFirst({
    where: { id: input.id, instituicaoId: input.instituicaoId },
  });
  if (!current || !current.deletedAt) {
    return { ok: false, error: "Registro não encontrado." };
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.documento.update({
      where: { id: current.id },
      data: { deletedAt: null, updatedBy: actor.userId },
    });

    await auditLog(
      {
        entidade: "documentos",
        entidadeId: updated.id,
        acao: "RESTORE",
        actorUserId: actor.userId,
        antes: current,
        depois: updated,
      },
      tx,
    );
  });

  return { ok: true, instituicaoId: input.instituicaoId, redirectSuffix: "?showDeleted=1" };
}

export async function updateProcesso(
  actor: MutationActor,
  input: z.infer<typeof UpdateProcessoSchema>,
): Promise<InstituicaoMutationResult> {
  const current = await prisma.processo.findFirst({
    where: { id: input.id, instituicaoId: input.instituicaoId, deletedAt: null },
  });
  if (!current) return { ok: false, error: "Registro não encontrado." };

  await prisma.$transaction(async (tx) => {
    const updated = await tx.processo.update({
      where: { id: current.id },
      data: {
        numero: input.numero?.trim() || null,
        ano: input.ano ?? null,
        status: input.status ?? current.status,
        assunto: input.assunto?.trim() || null,
        updatedBy: actor.userId,
      },
    });

    await auditLog(
      {
        entidade: "processos",
        entidadeId: updated.id,
        acao: "UPDATE",
        actorUserId: actor.userId,
        antes: current,
        depois: updated,
      },
      tx,
    );
  });

  return { ok: true, instituicaoId: input.instituicaoId };
}

export async function updateAto(
  actor: MutationActor,
  input: z.infer<typeof UpdateAtoSchema>,
): Promise<InstituicaoMutationResult> {
  const current = await prisma.atoAutorizativo.findFirst({
    where: { id: input.id, instituicaoId: input.instituicaoId, deletedAt: null },
  });
  if (!current) return { ok: false, error: "Registro não encontrado." };

  await prisma.$transaction(async (tx) => {
    const updated = await tx.atoAutorizativo.update({
      where: { id: current.id },
      data: {
        tipo: input.tipo,
        numero: input.numero?.trim() || null,
        dataAto: new Date(input.dataAto),
        ementa: input.ementa?.trim() || null,
        descricao: input.descricao?.trim() || null,
        updatedBy: actor.userId,
      },
    });

    await auditLog(
      {
        entidade: "atos_autorizativos",
        entidadeId: updated.id,
        acao: "UPDATE",
        actorUserId: actor.userId,
        antes: current,
        depois: updated,
      },
      tx,
    );
  });

  return { ok: true, instituicaoId: input.instituicaoId };
}

export async function updateEvento(
  actor: MutationActor,
  input: z.infer<typeof UpdateEventoSchema>,
): Promise<InstituicaoMutationResult> {
  const current = await prisma.eventoRegulatorio.findFirst({
    where: { id: input.id, instituicaoId: input.instituicaoId, deletedAt: null },
  });
  if (!current) return { ok: false, error: "Registro não encontrado." };

  await prisma.$transaction(async (tx) => {
    const updated = await tx.eventoRegulatorio.update({
      where: { id: current.id },
      data: {
        tipo: input.tipo,
        dataEvento: new Date(input.dataEvento),
        descricao: input.descricao.trim(),
        updatedBy: actor.userId,
      },
    });

    await auditLog(
      {
        entidade: "eventos_regulatorios",
        entidadeId: updated.id,
        acao: "UPDATE",
        actorUserId: actor.userId,
        antes: current,
        depois: updated,
      },
      tx,
    );
  });

  return { ok: true, instituicaoId: input.instituicaoId };
}

export async function updateDocumento(
  actor: MutationActor,
  input: z.infer<typeof UpdateDocumentoSchema>,
  options: { file: unknown; removeFile: boolean },
): Promise<InstituicaoMutationResult> {
  const vinculos = await resolveDocumentoVinculos(input.instituicaoId, input);
  if (!vinculos.ok) return { ok: false, error: vinculos.error };

  const current = await prisma.documento.findFirst({
    where: { id: input.id, instituicaoId: input.instituicaoId, deletedAt: null },
  });
  if (!current) return { ok: false, error: "Registro não encontrado." };

  const tipo = await prisma.tipoDocumento.findUnique({
    where: { codigo: input.tipoDocumentoCodigo },
  });
  if (!tipo) return { ok: false, error: "Tipo de documento inválido." };

  const uploadedFile = isUploadableFile(options.file) ? options.file : null;
  if (uploadedFile && uploadedFile.size > 0) {
    const sizeError = validateUploadSize(uploadedFile);
    if (sizeError) return { ok: false, error: sizeError };
  }

  const updated = await prisma.documento.update({
    where: { id: current.id },
    data: {
      tipoDocumentoId: tipo.id,
      titulo: input.titulo.trim(),
      dataDocumento: input.dataDocumento ? new Date(input.dataDocumento) : null,
      processoId: vinculos.processoId,
      atoId: vinculos.atoId,
      eventoId: vinculos.eventoId,
      updatedBy: actor.userId,
    },
  });

  if (uploadedFile && uploadedFile.size > 0) {
    const stored = await persistDocumentoArquivo({
      instituicaoId: input.instituicaoId,
      documentoId: current.id,
      file: uploadedFile,
    });

    await prisma.$transaction(async (tx) => {
      const withFile = await tx.documento.update({
        where: { id: current.id },
        data: {
          arquivoNome: stored.arquivoNome,
          arquivoMime: stored.arquivoMime,
          arquivoTamanho: stored.arquivoTamanho,
          storagePath: stored.relativePath,
          updatedBy: actor.userId,
        },
      });

      await auditLog(
        {
          entidade: "documentos",
          entidadeId: withFile.id,
          acao: "UPDATE",
          actorUserId: actor.userId,
          antes: updated,
          depois: withFile,
          metadata: {
            reason: "reupload_arquivo",
            note: "arquivo antigo permanece no storage (MVP)",
          },
        },
        tx,
      );
    });

    return { ok: true, instituicaoId: input.instituicaoId };
  }

  if (options.removeFile) {
    await prisma.$transaction(async (tx) => {
      const cleared = await tx.documento.update({
        where: { id: current.id },
        data: {
          arquivoNome: null,
          arquivoMime: null,
          arquivoTamanho: null,
          storagePath: null,
          updatedBy: actor.userId,
        },
      });

      await auditLog(
        {
          entidade: "documentos",
          entidadeId: cleared.id,
          acao: "UPDATE",
          actorUserId: actor.userId,
          antes: updated,
          depois: cleared,
          metadata: {
            reason: "remover_arquivo",
            note: "arquivo antigo permanece no storage (MVP)",
          },
        },
        tx,
      );
    });

    return { ok: true, instituicaoId: input.instituicaoId };
  }

  await auditLog({
    entidade: "documentos",
    entidadeId: updated.id,
    acao: "UPDATE",
    actorUserId: actor.userId,
    antes: current,
    depois: updated,
  });

  return { ok: true, instituicaoId: input.instituicaoId };
}
