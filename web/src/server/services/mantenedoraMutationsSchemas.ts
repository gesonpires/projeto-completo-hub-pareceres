import { z } from "zod";

export const CreateMantenedoraSchema = z.object({
  razaoSocial: z.string().min(3),
  nomeFantasia: z.string().optional(),
  cnpj: z.string().optional(),
});

export const UpdateMantenedoraSchema = z.object({
  id: z.string().uuid(),
  razaoSocial: z.string().min(3),
  nomeFantasia: z.string().optional(),
  cnpj: z.string().optional(),
});
