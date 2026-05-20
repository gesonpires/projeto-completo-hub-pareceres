import { z } from "zod";

export const DocumentoLoteUploadSchema = z.object({
  instituicaoId: z.string().uuid(),
  processoId: z.string().uuid().optional(),
  atoId: z.string().uuid().optional(),
  eventoId: z.string().uuid().optional(),
  tipoDocumentoCodigo: z.enum(["OFICIO", "PARECER", "RESOLUCAO", "OUTRO"]),
  dataDocumento: z.string().optional(),
});
