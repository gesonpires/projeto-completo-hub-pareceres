import { z } from "zod";

export const CreateInstituicaoSchema = z.object({
  nome: z.string().min(3),
  cnpj: z.string().optional(),
  municipio: z.string().optional(),
  uf: z.string().optional(),
  mantenedoraId: z.string().uuid().optional(),
});

export const UpdateInstituicaoMantenedoraSchema = z.object({
  instituicaoId: z.string().uuid(),
  mantenedoraId: z.string().uuid().optional(),
});

export const CreateTramitacaoSchema = z.object({
  instituicaoId: z.string().uuid(),
  processoId: z.string().uuid(),
  dataMovimento: z.string().min(8),
  status: z.enum(["ENCAMINHADO", "RECEBIDO", "DEVOLVIDO", "OUTRO"]).optional(),
  deSetor: z.string().optional(),
  paraSetor: z.string().optional(),
  observacao: z.string().optional(),
});

export const UpdateTramitacaoSchema = z.object({
  instituicaoId: z.string().uuid(),
  id: z.string().uuid(),
  processoId: z.string().uuid(),
  dataMovimento: z.string().min(8),
  status: z.enum(["ENCAMINHADO", "RECEBIDO", "DEVOLVIDO", "OUTRO"]).optional(),
  deSetor: z.string().optional(),
  paraSetor: z.string().optional(),
  observacao: z.string().optional(),
});

export const DeleteTramitacaoSchema = z.object({
  instituicaoId: z.string().uuid(),
  id: z.string().uuid(),
  processoId: z.string().uuid(),
  confirm: z.string().optional(),
});

export const CreateProcessoSchema = z.object({
  instituicaoId: z.string().uuid(),
  numero: z.string().optional(),
  ano: z.coerce.number().int().min(1900).max(2100).optional(),
  status: z.enum(["ABERTO", "EM_TRAMITACAO", "CONCLUIDO", "ARQUIVADO"]).optional(),
  assunto: z.string().optional(),
});

export const CreateAtoSchema = z.object({
  instituicaoId: z.string().uuid(),
  tipo: z.enum(["PARECER", "RESOLUCAO", "PORTARIA", "OUTRO"]),
  numero: z.string().optional(),
  dataAto: z.string().min(8),
  ementa: z.string().optional(),
  descricao: z.string().optional(),
});

export const CreateEventoSchema = z.object({
  instituicaoId: z.string().uuid(),
  tipo: z.enum(["PROTOCOLO", "DILIGENCIA", "REUNIAO", "DECISAO", "OUTRO"]),
  dataEvento: z.string().min(8),
  descricao: z.string().min(3),
});

export const CreateDocumentoSchema = z.object({
  instituicaoId: z.string().uuid(),
  tipoDocumentoCodigo: z.enum(["OFICIO", "PARECER", "RESOLUCAO", "OUTRO"]),
  titulo: z.string().min(3),
  dataDocumento: z.string().optional(),
  processoId: z.string().uuid().optional(),
  atoId: z.string().uuid().optional(),
  eventoId: z.string().uuid().optional(),
});

export const DeleteEntitySchema = z.object({
  instituicaoId: z.string().uuid(),
  id: z.string().uuid(),
  confirm: z.string().optional(),
});

export const UpdateBaseSchema = z.object({
  instituicaoId: z.string().uuid(),
  id: z.string().uuid(),
});

export const UpdateProcessoSchema = UpdateBaseSchema.extend({
  numero: z.string().optional(),
  ano: z.coerce.number().int().min(1900).max(2100).optional(),
  status: z.enum(["ABERTO", "EM_TRAMITACAO", "CONCLUIDO", "ARQUIVADO"]).optional(),
  assunto: z.string().optional(),
});

export const UpdateAtoSchema = UpdateBaseSchema.extend({
  tipo: z.enum(["PARECER", "RESOLUCAO", "PORTARIA", "OUTRO"]),
  numero: z.string().optional(),
  dataAto: z.string().min(8),
  ementa: z.string().optional(),
  descricao: z.string().optional(),
});

export const UpdateEventoSchema = UpdateBaseSchema.extend({
  tipo: z.enum(["PROTOCOLO", "DILIGENCIA", "REUNIAO", "DECISAO", "OUTRO"]),
  dataEvento: z.string().min(8),
  descricao: z.string().min(3),
});

export const UpdateDocumentoSchema = UpdateBaseSchema.extend({
  tipoDocumentoCodigo: z.enum(["OFICIO", "PARECER", "RESOLUCAO", "OUTRO"]),
  titulo: z.string().min(3),
  dataDocumento: z.string().optional(),
  processoId: z.string().uuid().optional(),
  atoId: z.string().uuid().optional(),
  eventoId: z.string().uuid().optional(),
});
