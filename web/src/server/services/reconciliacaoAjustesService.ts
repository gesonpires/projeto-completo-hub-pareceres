import type { z } from "zod";
import { prisma } from "@/server/db";
import { withPrismaRetry } from "@/server/dbRetry";
import { auditEvent } from "@/server/audit";
import { normalizeMunicipio, normalizeUf } from "@/server/normalize";
import {
  buildDocSourceRefIn,
  buildNumeroAnoOr,
  formatNumeroAnoSample,
} from "@/server/reconcile/collisionUtils";
import type { ReconciliacaoActor, ReconciliacaoAjusteResult } from "./reconciliacaoAjustesTypes";
import {
  MergeInstituicaoSchema,
  MergeProcessoSchema,
  UpdateInstituicoesBatchSchema,
  UpdateProcessosBatchSchema,
} from "./reconciliacaoAjustesSchemas";
import { parseBatchIdsJson } from "./reconciliacaoAjustesUtils";

export type { ReconciliacaoAjusteResult } from "./reconciliacaoAjustesTypes";
export {
  MergeInstituicaoSchema,
  MergeProcessoSchema,
  UpdateInstituicoesBatchSchema,
  UpdateProcessosBatchSchema,
} from "./reconciliacaoAjustesSchemas";

export async function updateInstituicoesBatch(
  actor: ReconciliacaoActor,
  input: z.infer<typeof UpdateInstituicoesBatchSchema>,
): Promise<ReconciliacaoAjusteResult> {
  const parsedIds = parseBatchIdsJson(
    input.ids,
    "Selecione ao menos 1 instituição.",
  );
  if (!parsedIds.ok) return { ok: false, error: parsedIds.error };

  const municipio =
    input.municipio && input.municipio.trim().length > 0
      ? normalizeMunicipio(input.municipio)
      : null;
  const uf =
    input.uf && input.uf.trim().length > 0 ? normalizeUf(input.uf) : "";
  const ufValue = uf ? uf : null;

  await withPrismaRetry(() =>
    prisma.$transaction(async (tx) => {
      await tx.instituicao.updateMany({
        where: {
          id: { in: parsedIds.ids },
          importacaoLoteId: input.loteId,
          deletedAt: null,
        },
        data: {
          ...(municipio !== null ? { municipio } : {}),
          ...(input.uf ? { uf: ufValue } : {}),
          updatedBy: actor.userId,
        },
      });

      await auditEvent(
        {
          entidade: "instituicoes",
          entidadeId: input.loteId,
          evento: "IMPORT_AJUSTE_BATCH",
          actorUserId: actor.userId,
          metadata: {
            loteId: input.loteId,
            tipo: "instituicoes",
            count: parsedIds.ids.length,
            changes: {
              ...(municipio !== null ? { municipio } : {}),
              ...(input.uf ? { uf: ufValue } : {}),
            },
            ids: parsedIds.ids,
          },
        },
        tx,
      );
    }),
  );

  return { ok: true, loteId: input.loteId };
}

export async function updateProcessosBatch(
  actor: ReconciliacaoActor,
  input: z.infer<typeof UpdateProcessosBatchSchema>,
): Promise<ReconciliacaoAjusteResult> {
  const parsedIds = parseBatchIdsJson(input.ids, "Selecione ao menos 1 processo.");
  if (!parsedIds.ok) return { ok: false, error: parsedIds.error };

  const assunto =
    input.assunto && input.assunto.trim().length > 0 ? input.assunto.trim() : null;

  await withPrismaRetry(() =>
    prisma.$transaction(async (tx) => {
      await tx.processo.updateMany({
        where: {
          id: { in: parsedIds.ids },
          importacaoLoteId: input.loteId,
          deletedAt: null,
        },
        data: {
          ...(input.status ? { status: input.status } : {}),
          ...(input.assunto ? { assunto } : {}),
          updatedBy: actor.userId,
        },
      });

      await auditEvent(
        {
          entidade: "processos",
          entidadeId: input.loteId,
          evento: "IMPORT_AJUSTE_BATCH",
          actorUserId: actor.userId,
          metadata: {
            loteId: input.loteId,
            tipo: "processos",
            count: parsedIds.ids.length,
            changes: {
              ...(input.status ? { status: input.status } : {}),
              ...(input.assunto ? { assunto } : {}),
            },
            ids: parsedIds.ids,
          },
        },
        tx,
      );
    }),
  );

  return { ok: true, loteId: input.loteId };
}

export async function mergeInstituicaoInto(
  actor: ReconciliacaoActor,
  input: z.infer<typeof MergeInstituicaoSchema>,
): Promise<ReconciliacaoAjusteResult> {
  if (input.confirm !== "1") {
    return { ok: false, error: "Marque “Confirmar” para reconciliar." };
  }
  if (input.fromInstituicaoId === input.toInstituicaoId) {
    return { ok: false, error: "Origem e destino não podem ser iguais." };
  }

  const [from, to] = await withPrismaRetry(() =>
    Promise.all([
      prisma.instituicao.findFirst({
        where: {
          id: input.fromInstituicaoId,
          importacaoLoteId: input.loteId,
          deletedAt: null,
        },
      }),
      prisma.instituicao.findFirst({
        where: {
          id: input.toInstituicaoId,
          importacaoLoteId: null,
          deletedAt: null,
        },
      }),
    ]),
  );

  if (!from || !to) {
    return { ok: false, error: "Instituição origem/destino não encontrada." };
  }

  const procKeys = await withPrismaRetry(() =>
    prisma.processo.findMany({
      where: {
        importacaoLoteId: input.loteId,
        instituicaoId: from.id,
        deletedAt: null,
        numero: { not: null },
        ano: { not: null },
      },
      take: 500,
      select: { numero: true, ano: true },
      distinct: ["numero", "ano"],
    }),
  );

  if (procKeys.length > 0) {
    const orNumeroAno = buildNumeroAnoOr(procKeys, 150);
    if (orNumeroAno.length > 0) {
      const collisions = await withPrismaRetry(() =>
        prisma.processo.findMany({
          where: {
            instituicaoId: to.id,
            deletedAt: null,
            OR: orNumeroAno,
          },
          take: 10,
          select: { numero: true, ano: true },
        }),
      );
      if (collisions.length > 0) {
        const sample = formatNumeroAnoSample(collisions, 6);
        return {
          ok: false,
          error:
            `Reconciliação bloqueada: a instituição destino já possui processo(s) com o mesmo número/ano. ` +
            `Ex.: ${sample}. Ajuste/mescle processos antes de reconciliar a instituição.`,
        };
      }
    }
  }

  const moved = await withPrismaRetry(() =>
    prisma.$transaction(async (tx) => {
      const [procRes, atoRes, evtRes, docRes] = await Promise.all([
        tx.processo.updateMany({
          where: {
            importacaoLoteId: input.loteId,
            instituicaoId: from.id,
            deletedAt: null,
          },
          data: { instituicaoId: to.id, updatedBy: actor.userId },
        }),
        tx.atoAutorizativo.updateMany({
          where: {
            importacaoLoteId: input.loteId,
            instituicaoId: from.id,
            deletedAt: null,
          },
          data: { instituicaoId: to.id, updatedBy: actor.userId },
        }),
        tx.eventoRegulatorio.updateMany({
          where: {
            importacaoLoteId: input.loteId,
            instituicaoId: from.id,
            deletedAt: null,
          },
          data: { instituicaoId: to.id, updatedBy: actor.userId },
        }),
        tx.documento.updateMany({
          where: {
            importacaoLoteId: input.loteId,
            instituicaoId: from.id,
            deletedAt: null,
          },
          data: { instituicaoId: to.id, updatedBy: actor.userId },
        }),
      ]);

      await tx.instituicao.update({
        where: { id: from.id },
        data: { deletedAt: new Date(), updatedBy: actor.userId },
      });

      await auditEvent(
        {
          entidade: "instituicoes",
          entidadeId: input.loteId,
          evento: "IMPORT_RECONCILE_INSTITUICAO",
          actorUserId: actor.userId,
          metadata: {
            loteId: input.loteId,
            fromInstituicaoId: from.id,
            toInstituicaoId: to.id,
            moved: {
              processos: procRes.count,
              atos: atoRes.count,
              eventos: evtRes.count,
              documentos: docRes.count,
            },
          },
        },
        tx,
      );

      return {
        processos: procRes.count,
        atos: atoRes.count,
        eventos: evtRes.count,
        documentos: docRes.count,
      };
    }),
  );

  return {
    ok: true,
    loteId: input.loteId,
    okMessage:
      `Reconciliação (instituição) concluída. ` +
      `Processos: ${moved.processos}, Atos: ${moved.atos}, Eventos: ${moved.eventos}, Documentos: ${moved.documentos}.`,
  };
}

export async function mergeProcessoInto(
  actor: ReconciliacaoActor,
  input: z.infer<typeof MergeProcessoSchema>,
): Promise<ReconciliacaoAjusteResult> {
  if (input.confirm !== "1") {
    return { ok: false, error: "Marque “Confirmar” para reconciliar." };
  }
  if (input.fromProcessoId === input.toProcessoId) {
    return { ok: false, error: "Origem e destino não podem ser iguais." };
  }

  const [from, to] = await withPrismaRetry(() =>
    Promise.all([
      prisma.processo.findFirst({
        where: {
          id: input.fromProcessoId,
          importacaoLoteId: input.loteId,
          deletedAt: null,
        },
      }),
      prisma.processo.findFirst({
        where: {
          id: input.toProcessoId,
          importacaoLoteId: null,
          deletedAt: null,
        },
      }),
    ]),
  );

  if (!from || !to) {
    return { ok: false, error: "Processo origem/destino não encontrado." };
  }

  const [docRefs, atoKeys, evtKeys] = await withPrismaRetry(() =>
    prisma.$transaction([
      prisma.documento.findMany({
        where: {
          importacaoLoteId: input.loteId,
          processoId: from.id,
          deletedAt: null,
          sourceRef: { not: null },
        },
        take: 500,
        select: { sourceRef: true },
        distinct: ["sourceRef"],
      }),
      prisma.atoAutorizativo.findMany({
        where: {
          importacaoLoteId: input.loteId,
          processoId: from.id,
          deletedAt: null,
        },
        take: 500,
        select: { tipo: true, dataAto: true, numero: true },
      }),
      prisma.eventoRegulatorio.findMany({
        where: {
          importacaoLoteId: input.loteId,
          processoId: from.id,
          deletedAt: null,
        },
        take: 500,
        select: { tipo: true, dataEvento: true, descricao: true },
      }),
    ]),
  );

  const refs = buildDocSourceRefIn(docRefs, 200);
  if (refs.length > 0) {
    const collisions = await withPrismaRetry(() =>
      prisma.documento.findMany({
        where: { processoId: to.id, deletedAt: null, sourceRef: { in: refs } },
        take: 10,
        select: { sourceRef: true },
      }),
    );
    if (collisions.length > 0) {
      const sample = collisions
        .map((c) => c.sourceRef ?? "")
        .filter(Boolean)
        .slice(0, 6)
        .join(", ");
      return {
        ok: false,
        error:
          `Reconciliação bloqueada: o processo destino já possui documento(s) com a mesma sourceRef. ` +
          `Ex.: ${sample}. Ajuste/mescle documentos antes de reconciliar o processo.`,
      };
    }
  }

  if (atoKeys.length > 0) {
    const ors = atoKeys.slice(0, 150).map((k) => ({
      tipo: k.tipo,
      dataAto: k.dataAto,
      ...(k.numero ? { numero: k.numero } : { numero: null }),
    }));
    const collisions = await withPrismaRetry(() =>
      prisma.atoAutorizativo.findMany({
        where: { processoId: to.id, deletedAt: null, OR: ors as never },
        take: 10,
        select: { tipo: true, numero: true, dataAto: true },
      }),
    );
    if (collisions.length > 0) {
      const sample = collisions
        .map(
          (c) =>
            `${String(c.tipo)}${c.numero ? ` ${c.numero}` : ""} (${c.dataAto.toISOString().slice(0, 10)})`,
        )
        .slice(0, 6)
        .join(", ");
      return {
        ok: false,
        error:
          `Reconciliação bloqueada: o processo destino já possui ato(s) com a mesma chave (tipo/data/número). ` +
          `Ex.: ${sample}. Ajuste/mescle atos antes de reconciliar o processo.`,
      };
    }
  }

  if (evtKeys.length > 0) {
    const ors = evtKeys.slice(0, 150).map((k) => ({
      tipo: k.tipo,
      dataEvento: k.dataEvento,
      descricao: k.descricao,
    }));
    const collisions = await withPrismaRetry(() =>
      prisma.eventoRegulatorio.findMany({
        where: { processoId: to.id, deletedAt: null, OR: ors as never },
        take: 10,
        select: { tipo: true, dataEvento: true, descricao: true },
      }),
    );
    if (collisions.length > 0) {
      const sample = collisions
        .map(
          (c) =>
            `${String(c.tipo)} (${c.dataEvento.toISOString().slice(0, 10)}) • ${c.descricao.slice(0, 40)}`,
        )
        .slice(0, 4)
        .join(" | ");
      return {
        ok: false,
        error:
          `Reconciliação bloqueada: o processo destino já possui evento(s) iguais (tipo/data/descrição). ` +
          `Ex.: ${sample}. Ajuste/mescle eventos antes de reconciliar o processo.`,
      };
    }
  }

  const moved = await withPrismaRetry(() =>
    prisma.$transaction(async (tx) => {
      const [tramRes, atoRes, evtRes, docRes] = await Promise.all([
        tx.tramitacao.updateMany({
          where: {
            importacaoLoteId: input.loteId,
            processoId: from.id,
            deletedAt: null,
          },
          data: { processoId: to.id, updatedBy: actor.userId },
        }),
        tx.atoAutorizativo.updateMany({
          where: {
            importacaoLoteId: input.loteId,
            processoId: from.id,
            deletedAt: null,
          },
          data: { processoId: to.id, updatedBy: actor.userId },
        }),
        tx.eventoRegulatorio.updateMany({
          where: {
            importacaoLoteId: input.loteId,
            processoId: from.id,
            deletedAt: null,
          },
          data: { processoId: to.id, updatedBy: actor.userId },
        }),
        tx.documento.updateMany({
          where: {
            importacaoLoteId: input.loteId,
            processoId: from.id,
            deletedAt: null,
          },
          data: { processoId: to.id, updatedBy: actor.userId },
        }),
      ]);

      await tx.processo.update({
        where: { id: from.id },
        data: { deletedAt: new Date(), updatedBy: actor.userId },
      });

      await auditEvent(
        {
          entidade: "processos",
          entidadeId: input.loteId,
          evento: "IMPORT_RECONCILE_PROCESSO",
          actorUserId: actor.userId,
          metadata: {
            loteId: input.loteId,
            fromProcessoId: from.id,
            toProcessoId: to.id,
            moved: {
              tramitacoes: tramRes.count,
              atos: atoRes.count,
              eventos: evtRes.count,
              documentos: docRes.count,
            },
          },
        },
        tx,
      );

      return {
        tramitacoes: tramRes.count,
        atos: atoRes.count,
        eventos: evtRes.count,
        documentos: docRes.count,
      };
    }),
  );

  return {
    ok: true,
    loteId: input.loteId,
    okMessage:
      `Reconciliação (processo) concluída. ` +
      `Tramitações: ${moved.tramitacoes}, Atos: ${moved.atos}, Eventos: ${moved.eventos}, Documentos: ${moved.documentos}.`,
  };
}
