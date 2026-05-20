import { expect } from "vitest";
import { prisma } from "@/server/db";

export type ImportAuditMetadata = {
  source?: string;
  loteId?: string;
  rowNumber?: number;
  reconciliadoPara?: string;
  fonte?: string;
  arquivoNome?: string;
  result?: {
    imported?: number;
    rejected?: number;
    errorsCount?: number;
    impacto?: Record<string, unknown>;
  };
};

export async function findImportacaoLoteAuditLogs(loteId: string) {
  return prisma.logAuditoria.findMany({
    where: { entidade: "importacoes", entidadeId: loteId },
    orderBy: { timestamp: "asc" },
  });
}

export async function findEntidadeImportAuditLogs(
  entidade: string,
  entidadeId: string,
) {
  return prisma.logAuditoria.findMany({
    where: { entidade, entidadeId },
    orderBy: { timestamp: "asc" },
  });
}

export function metadataOf(log: { metadata: unknown }): ImportAuditMetadata {
  return (log.metadata ?? {}) as ImportAuditMetadata;
}

/** CREATE + UPDATE do lote com resultado agregado no fechamento. */
export async function assertImportacaoLoteAuditTrail(
  loteId: string,
  actorUserId: string,
  result: { imported: number; rejected: number; errorsCount: number },
) {
  const logs = await findImportacaoLoteAuditLogs(loteId);
  expect(logs).toHaveLength(2);
  expect(logs[0]).toMatchObject({
    acao: "CREATE",
    actorUserId,
    entidade: "importacoes",
    entidadeId: loteId,
  });
  expect(metadataOf(logs[0]).arquivoNome).toBeTruthy();

  expect(logs[1]).toMatchObject({
    acao: "UPDATE",
    actorUserId,
    entidade: "importacoes",
    entidadeId: loteId,
  });
  expect(metadataOf(logs[1]).source).toBe("import");
  expect(metadataOf(logs[1]).result).toMatchObject({
    imported: result.imported,
    rejected: result.rejected,
    errorsCount: result.errorsCount,
  });
}

/** Log de mutação de entidade filha ou instituição na importação. */
export async function assertEntidadeImportAudit(
  entidade: string,
  entidadeId: string,
  loteId: string,
  expected: {
    acao: "CREATE" | "UPDATE";
    rowNumber: number;
    actorUserId: string;
    reconciliadoPara?: string;
  },
) {
  const logs = await findEntidadeImportAuditLogs(entidade, entidadeId);
  const match = logs.find((log) => {
    const m = metadataOf(log);
    return (
      log.acao === expected.acao &&
      m.source === "import" &&
      m.loteId === loteId &&
      m.rowNumber === expected.rowNumber
    );
  });
  expect(match).toBeDefined();
  expect(match!.actorUserId).toBe(expected.actorUserId);
  const meta = metadataOf(match!);
  if (expected.reconciliadoPara !== undefined) {
    expect(meta.reconciliadoPara).toBe(expected.reconciliadoPara);
  } else {
    expect(meta.reconciliadoPara).toBeUndefined();
  }
}
