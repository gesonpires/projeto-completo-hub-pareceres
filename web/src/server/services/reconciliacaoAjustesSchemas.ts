import { z } from "zod";

export const UpdateInstituicoesBatchSchema = z.object({
  loteId: z.string().uuid(),
  ids: z.string().min(2),
  municipio: z.string().optional(),
  uf: z.string().optional(),
});

export const UpdateProcessosBatchSchema = z.object({
  loteId: z.string().uuid(),
  ids: z.string().min(2),
  status: z.enum(["ABERTO", "EM_TRAMITACAO", "CONCLUIDO", "ARQUIVADO"]).optional(),
  assunto: z.string().optional(),
});

export const MergeInstituicaoSchema = z.object({
  loteId: z.string().uuid(),
  fromInstituicaoId: z.string().uuid(),
  toInstituicaoId: z.string().uuid(),
  confirm: z.string().optional(),
});

export const MergeProcessoSchema = z.object({
  loteId: z.string().uuid(),
  fromProcessoId: z.string().uuid(),
  toProcessoId: z.string().uuid(),
  confirm: z.string().optional(),
});
