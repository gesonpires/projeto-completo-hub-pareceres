"use server";

import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import type { InstituicaoMutationResult } from "@/server/services/instituicaoMutationsService";
import {
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
  createAto,
  createDocumento,
  createEvento,
  createProcesso,
  createTramitacao,
  deleteAto,
  deleteDocumento,
  deleteEvento,
  deleteProcesso,
  deleteTramitacao,
  firstZodIssueMessage,
  restoreAto,
  restoreDocumento,
  restoreEvento,
  restoreProcesso,
  restoreTramitacao,
  updateAto,
  updateDocumento,
  updateEvento,
  updateInstituicaoMantenedora,
  updateProcesso,
  updateTramitacao,
} from "@/server/services/instituicaoMutationsService";

function backToInstituicao(instituicaoId: string, message: string) {
  redirect(
    `/instituicoes/${instituicaoId}?error=${encodeURIComponent(message)}`,
  );
}

function finishMutation(result: InstituicaoMutationResult, instituicaoId: string) {
  if (!result.ok) {
    return backToInstituicao(instituicaoId, result.error);
  }
  redirect(
    `/instituicoes/${result.instituicaoId}${result.redirectSuffix ?? ""}`,
  );
}

async function requireSession() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  return session;
}

export async function updateInstituicaoMantenedoraAction(formData: FormData) {
  const session = await requireSession();
  const instituicaoId = String(formData.get("instituicaoId") ?? "");
  if (!hasPermission(session.perfil, "institutions:write")) {
    return backToInstituicao(instituicaoId, "Sem permissão.");
  }

  const parsed = UpdateInstituicaoMantenedoraSchema.safeParse({
    instituicaoId: formData.get("instituicaoId"),
    mantenedoraId: formData.get("mantenedoraId") || undefined,
  });
  if (!parsed.success) {
    return backToInstituicao(instituicaoId, firstZodIssueMessage(parsed.error));
  }

  const result = await updateInstituicaoMantenedora(
    { userId: session.id },
    parsed.data,
  );
  finishMutation(result, instituicaoId);
}

export async function createTramitacaoAction(formData: FormData) {
  const session = await requireSession();
  const instituicaoId = String(formData.get("instituicaoId") ?? "");
  if (!hasPermission(session.perfil, "regulatory:write")) {
    return backToInstituicao(instituicaoId, "Sem permissão.");
  }

  const parsed = CreateTramitacaoSchema.safeParse({
    instituicaoId: formData.get("instituicaoId"),
    processoId: formData.get("processoId"),
    dataMovimento: formData.get("dataMovimento"),
    status: (formData.get("status") || undefined) as unknown,
    deSetor: formData.get("deSetor") || undefined,
    paraSetor: formData.get("paraSetor") || undefined,
    observacao: formData.get("observacao") || undefined,
  });
  if (!parsed.success) {
    return backToInstituicao(instituicaoId, firstZodIssueMessage(parsed.error));
  }

  finishMutation(
    await createTramitacao({ userId: session.id }, parsed.data),
    instituicaoId,
  );
}

export async function updateTramitacaoAction(formData: FormData) {
  const session = await requireSession();
  const instituicaoId = String(formData.get("instituicaoId") ?? "");
  if (!hasPermission(session.perfil, "regulatory:write")) {
    return backToInstituicao(instituicaoId, "Sem permissão.");
  }

  const parsed = UpdateTramitacaoSchema.safeParse({
    instituicaoId: formData.get("instituicaoId"),
    id: formData.get("id"),
    processoId: formData.get("processoId"),
    dataMovimento: formData.get("dataMovimento"),
    status: (formData.get("status") || undefined) as unknown,
    deSetor: formData.get("deSetor") || undefined,
    paraSetor: formData.get("paraSetor") || undefined,
    observacao: formData.get("observacao") || undefined,
  });
  if (!parsed.success) {
    return backToInstituicao(instituicaoId, firstZodIssueMessage(parsed.error));
  }

  finishMutation(
    await updateTramitacao({ userId: session.id }, parsed.data),
    instituicaoId,
  );
}

export async function deleteTramitacaoAction(formData: FormData) {
  const session = await requireSession();
  const instituicaoId = String(formData.get("instituicaoId") ?? "");
  if (!hasPermission(session.perfil, "regulatory:write")) {
    return backToInstituicao(instituicaoId, "Sem permissão.");
  }

  const parsed = DeleteTramitacaoSchema.safeParse({
    instituicaoId: formData.get("instituicaoId"),
    id: formData.get("id"),
    processoId: formData.get("processoId"),
    confirm: formData.get("confirm") || undefined,
  });
  if (!parsed.success) {
    return backToInstituicao(instituicaoId, "Dados inválidos.");
  }

  finishMutation(
    await deleteTramitacao({ userId: session.id }, parsed.data),
    instituicaoId,
  );
}

export async function restoreTramitacaoAction(formData: FormData) {
  const session = await requireSession();
  const instituicaoId = String(formData.get("instituicaoId") ?? "");
  if (!hasPermission(session.perfil, "regulatory:write")) {
    return backToInstituicao(instituicaoId, "Sem permissão.");
  }

  const parsed = DeleteTramitacaoSchema.safeParse({
    instituicaoId: formData.get("instituicaoId"),
    id: formData.get("id"),
    processoId: formData.get("processoId"),
  });
  if (!parsed.success) {
    return backToInstituicao(instituicaoId, "Dados inválidos.");
  }

  finishMutation(
    await restoreTramitacao(
      { userId: session.id },
      {
        instituicaoId: parsed.data.instituicaoId,
        id: parsed.data.id,
        processoId: parsed.data.processoId,
      },
    ),
    instituicaoId,
  );
}

export async function createProcessoAction(formData: FormData) {
  const session = await requireSession();
  const instituicaoId = String(formData.get("instituicaoId") ?? "");
  if (!hasPermission(session.perfil, "processes:write")) {
    return backToInstituicao(instituicaoId, "Sem permissão.");
  }

  const parsed = CreateProcessoSchema.safeParse({
    instituicaoId: formData.get("instituicaoId"),
    numero: formData.get("numero") || undefined,
    ano: formData.get("ano") || undefined,
    status: (formData.get("status") || undefined) as unknown,
    assunto: formData.get("assunto") || undefined,
  });
  if (!parsed.success) {
    return backToInstituicao(instituicaoId, firstZodIssueMessage(parsed.error));
  }

  finishMutation(
    await createProcesso({ userId: session.id }, parsed.data),
    instituicaoId,
  );
}

export async function createAtoAction(formData: FormData) {
  const session = await requireSession();
  const instituicaoId = String(formData.get("instituicaoId") ?? "");
  if (!hasPermission(session.perfil, "regulatory:write")) {
    return backToInstituicao(instituicaoId, "Sem permissão.");
  }

  const parsed = CreateAtoSchema.safeParse({
    instituicaoId: formData.get("instituicaoId"),
    tipo: formData.get("tipo"),
    numero: formData.get("numero") || undefined,
    dataAto: formData.get("dataAto"),
    ementa: formData.get("ementa") || undefined,
    descricao: formData.get("descricao") || undefined,
  });
  if (!parsed.success) {
    return backToInstituicao(instituicaoId, firstZodIssueMessage(parsed.error));
  }

  finishMutation(await createAto({ userId: session.id }, parsed.data), instituicaoId);
}

export async function createEventoAction(formData: FormData) {
  const session = await requireSession();
  const instituicaoId = String(formData.get("instituicaoId") ?? "");
  if (!hasPermission(session.perfil, "regulatory:write")) {
    return backToInstituicao(instituicaoId, "Sem permissão.");
  }

  const parsed = CreateEventoSchema.safeParse({
    instituicaoId: formData.get("instituicaoId"),
    tipo: formData.get("tipo"),
    dataEvento: formData.get("dataEvento"),
    descricao: formData.get("descricao"),
  });
  if (!parsed.success) {
    return backToInstituicao(instituicaoId, firstZodIssueMessage(parsed.error));
  }

  finishMutation(
    await createEvento({ userId: session.id }, parsed.data),
    instituicaoId,
  );
}

export async function createDocumentoAction(formData: FormData) {
  const session = await requireSession();
  const instituicaoId = String(formData.get("instituicaoId") ?? "");
  if (!hasPermission(session.perfil, "documents:write")) {
    return backToInstituicao(instituicaoId, "Sem permissão.");
  }

  const parsed = CreateDocumentoSchema.safeParse({
    instituicaoId: formData.get("instituicaoId"),
    tipoDocumentoCodigo: formData.get("tipoDocumentoCodigo"),
    titulo: formData.get("titulo"),
    dataDocumento: (formData.get("dataDocumento") || undefined) as unknown,
    processoId: (formData.get("processoId") || undefined) as unknown,
    atoId: (formData.get("atoId") || undefined) as unknown,
    eventoId: (formData.get("eventoId") || undefined) as unknown,
  });
  if (!parsed.success) {
    return backToInstituicao(instituicaoId, firstZodIssueMessage(parsed.error));
  }

  finishMutation(
    await createDocumento(
      { userId: session.id },
      parsed.data,
      formData.get("arquivo"),
    ),
    instituicaoId,
  );
}

export async function deleteProcessoAction(formData: FormData) {
  const session = await requireSession();
  const instituicaoId = String(formData.get("instituicaoId") ?? "");
  if (!hasPermission(session.perfil, "processes:write")) {
    return backToInstituicao(instituicaoId, "Sem permissão.");
  }

  const parsed = DeleteEntitySchema.safeParse({
    instituicaoId: formData.get("instituicaoId"),
    id: formData.get("id"),
    confirm: formData.get("confirm") || undefined,
  });
  if (!parsed.success) {
    return backToInstituicao(instituicaoId, "Dados inválidos.");
  }

  finishMutation(
    await deleteProcesso({ userId: session.id }, parsed.data),
    instituicaoId,
  );
}

export async function deleteAtoAction(formData: FormData) {
  const session = await requireSession();
  const instituicaoId = String(formData.get("instituicaoId") ?? "");
  if (!hasPermission(session.perfil, "regulatory:write")) {
    return backToInstituicao(instituicaoId, "Sem permissão.");
  }

  const parsed = DeleteEntitySchema.safeParse({
    instituicaoId: formData.get("instituicaoId"),
    id: formData.get("id"),
    confirm: formData.get("confirm") || undefined,
  });
  if (!parsed.success) {
    return backToInstituicao(instituicaoId, "Dados inválidos.");
  }

  finishMutation(await deleteAto({ userId: session.id }, parsed.data), instituicaoId);
}

export async function deleteEventoAction(formData: FormData) {
  const session = await requireSession();
  const instituicaoId = String(formData.get("instituicaoId") ?? "");
  if (!hasPermission(session.perfil, "regulatory:write")) {
    return backToInstituicao(instituicaoId, "Sem permissão.");
  }

  const parsed = DeleteEntitySchema.safeParse({
    instituicaoId: formData.get("instituicaoId"),
    id: formData.get("id"),
    confirm: formData.get("confirm") || undefined,
  });
  if (!parsed.success) {
    return backToInstituicao(instituicaoId, "Dados inválidos.");
  }

  finishMutation(
    await deleteEvento({ userId: session.id }, parsed.data),
    instituicaoId,
  );
}

export async function deleteDocumentoAction(formData: FormData) {
  const session = await requireSession();
  const instituicaoId = String(formData.get("instituicaoId") ?? "");
  if (!hasPermission(session.perfil, "documents:write")) {
    return backToInstituicao(instituicaoId, "Sem permissão.");
  }

  const parsed = DeleteEntitySchema.safeParse({
    instituicaoId: formData.get("instituicaoId"),
    id: formData.get("id"),
    confirm: formData.get("confirm") || undefined,
  });
  if (!parsed.success) {
    return backToInstituicao(instituicaoId, "Dados inválidos.");
  }

  finishMutation(
    await deleteDocumento({ userId: session.id }, parsed.data),
    instituicaoId,
  );
}

export async function restoreProcessoAction(formData: FormData) {
  const session = await requireSession();
  const instituicaoId = String(formData.get("instituicaoId") ?? "");
  if (!hasPermission(session.perfil, "processes:write")) {
    return backToInstituicao(instituicaoId, "Sem permissão.");
  }

  const parsed = DeleteEntitySchema.safeParse({
    instituicaoId: formData.get("instituicaoId"),
    id: formData.get("id"),
  });
  if (!parsed.success) {
    return backToInstituicao(instituicaoId, "Dados inválidos.");
  }

  finishMutation(
    await restoreProcesso({ userId: session.id }, parsed.data),
    instituicaoId,
  );
}

export async function restoreAtoAction(formData: FormData) {
  const session = await requireSession();
  const instituicaoId = String(formData.get("instituicaoId") ?? "");
  if (!hasPermission(session.perfil, "regulatory:write")) {
    return backToInstituicao(instituicaoId, "Sem permissão.");
  }

  const parsed = DeleteEntitySchema.safeParse({
    instituicaoId: formData.get("instituicaoId"),
    id: formData.get("id"),
  });
  if (!parsed.success) {
    return backToInstituicao(instituicaoId, "Dados inválidos.");
  }

  finishMutation(await restoreAto({ userId: session.id }, parsed.data), instituicaoId);
}

export async function restoreEventoAction(formData: FormData) {
  const session = await requireSession();
  const instituicaoId = String(formData.get("instituicaoId") ?? "");
  if (!hasPermission(session.perfil, "regulatory:write")) {
    return backToInstituicao(instituicaoId, "Sem permissão.");
  }

  const parsed = DeleteEntitySchema.safeParse({
    instituicaoId: formData.get("instituicaoId"),
    id: formData.get("id"),
  });
  if (!parsed.success) {
    return backToInstituicao(instituicaoId, "Dados inválidos.");
  }

  finishMutation(
    await restoreEvento({ userId: session.id }, parsed.data),
    instituicaoId,
  );
}

export async function restoreDocumentoAction(formData: FormData) {
  const session = await requireSession();
  const instituicaoId = String(formData.get("instituicaoId") ?? "");
  if (!hasPermission(session.perfil, "documents:write")) {
    return backToInstituicao(instituicaoId, "Sem permissão.");
  }

  const parsed = DeleteEntitySchema.safeParse({
    instituicaoId: formData.get("instituicaoId"),
    id: formData.get("id"),
  });
  if (!parsed.success) {
    return backToInstituicao(instituicaoId, "Dados inválidos.");
  }

  finishMutation(
    await restoreDocumento({ userId: session.id }, parsed.data),
    instituicaoId,
  );
}

export async function updateProcessoAction(formData: FormData) {
  const session = await requireSession();
  const instituicaoId = String(formData.get("instituicaoId") ?? "");
  if (!hasPermission(session.perfil, "processes:write")) {
    return backToInstituicao(instituicaoId, "Sem permissão.");
  }

  const parsed = UpdateProcessoSchema.safeParse({
    instituicaoId: formData.get("instituicaoId"),
    id: formData.get("id"),
    numero: formData.get("numero") || undefined,
    ano: formData.get("ano") || undefined,
    status: (formData.get("status") || undefined) as unknown,
    assunto: formData.get("assunto") || undefined,
  });
  if (!parsed.success) {
    return backToInstituicao(instituicaoId, "Dados inválidos.");
  }

  finishMutation(
    await updateProcesso({ userId: session.id }, parsed.data),
    instituicaoId,
  );
}

export async function updateAtoAction(formData: FormData) {
  const session = await requireSession();
  const instituicaoId = String(formData.get("instituicaoId") ?? "");
  if (!hasPermission(session.perfil, "regulatory:write")) {
    return backToInstituicao(instituicaoId, "Sem permissão.");
  }

  const parsed = UpdateAtoSchema.safeParse({
    instituicaoId: formData.get("instituicaoId"),
    id: formData.get("id"),
    tipo: formData.get("tipo"),
    numero: formData.get("numero") || undefined,
    dataAto: formData.get("dataAto"),
    ementa: formData.get("ementa") || undefined,
    descricao: formData.get("descricao") || undefined,
  });
  if (!parsed.success) {
    return backToInstituicao(instituicaoId, "Dados inválidos.");
  }

  finishMutation(await updateAto({ userId: session.id }, parsed.data), instituicaoId);
}

export async function updateEventoAction(formData: FormData) {
  const session = await requireSession();
  const instituicaoId = String(formData.get("instituicaoId") ?? "");
  if (!hasPermission(session.perfil, "regulatory:write")) {
    return backToInstituicao(instituicaoId, "Sem permissão.");
  }

  const parsed = UpdateEventoSchema.safeParse({
    instituicaoId: formData.get("instituicaoId"),
    id: formData.get("id"),
    tipo: formData.get("tipo"),
    dataEvento: formData.get("dataEvento"),
    descricao: formData.get("descricao"),
  });
  if (!parsed.success) {
    return backToInstituicao(instituicaoId, "Dados inválidos.");
  }

  finishMutation(
    await updateEvento({ userId: session.id }, parsed.data),
    instituicaoId,
  );
}

export async function updateDocumentoAction(formData: FormData) {
  const session = await requireSession();
  const instituicaoId = String(formData.get("instituicaoId") ?? "");
  if (!hasPermission(session.perfil, "documents:write")) {
    return backToInstituicao(instituicaoId, "Sem permissão.");
  }

  const parsed = UpdateDocumentoSchema.safeParse({
    instituicaoId: formData.get("instituicaoId"),
    id: formData.get("id"),
    tipoDocumentoCodigo: formData.get("tipoDocumentoCodigo"),
    titulo: formData.get("titulo"),
    dataDocumento: (formData.get("dataDocumento") || undefined) as unknown,
    processoId: (formData.get("processoId") || undefined) as unknown,
    atoId: (formData.get("atoId") || undefined) as unknown,
    eventoId: (formData.get("eventoId") || undefined) as unknown,
  });
  if (!parsed.success) {
    return backToInstituicao(instituicaoId, "Dados inválidos.");
  }

  finishMutation(
    await updateDocumento(
      { userId: session.id },
      parsed.data,
      {
        file: formData.get("arquivo"),
        removeFile: formData.get("removerArquivo") === "1",
      },
    ),
    instituicaoId,
  );
}
