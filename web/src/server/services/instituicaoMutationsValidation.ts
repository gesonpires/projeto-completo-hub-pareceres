import type { z } from "zod";

export {
  validateOptionalCnpj,
  validateOptionalCnpj as validateOptionalInstituicaoCnpj,
} from "./mutationCnpjValidation";

export function firstZodIssueMessage(err: z.ZodError) {
  const issue = err.issues[0];
  if (!issue) return "Dados inválidos.";
  const field = issue.path?.length ? String(issue.path[0]) : "";
  const fieldLabel =
    field === "dataAto"
      ? "Data do ato"
      : field === "dataEvento"
        ? "Data do evento"
        : field === "dataMovimento"
          ? "Data do movimento"
          : field === "descricao"
            ? "Descrição"
            : field === "titulo"
              ? "Título"
              : field === "processoId"
                ? "Processo"
                : field === "tipoDocumentoCodigo"
                  ? "Tipo do documento"
                  : "";

  if (issue.code === "invalid_type" && issue.message.toLowerCase().includes("required")) {
    return fieldLabel ? `${fieldLabel} é obrigatório.` : "Campo obrigatório.";
  }
  if (issue.code === "too_small" && fieldLabel) {
    return `${fieldLabel} está muito curto.`;
  }
  return fieldLabel ? `${fieldLabel} inválido.` : "Dados inválidos.";
}
