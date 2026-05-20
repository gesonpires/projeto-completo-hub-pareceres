import { z } from "zod";

export const ImportacaoCsvRunFormSchema = z.object({
  arquivoNome: z.string().min(1),
  csvText: z.string().min(1),
  reconciliacoesJson: z.string().optional(),
  sourceInfoJson: z.string().optional(),
});

export type ImportacaoCsvRunFormInput = z.infer<typeof ImportacaoCsvRunFormSchema>;
