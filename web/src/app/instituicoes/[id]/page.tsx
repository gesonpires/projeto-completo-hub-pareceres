import Link from "next/link";
import { notFound } from "next/navigation";
import { formatCnpj } from "@/server/normalize";
import {
  createAtoAction,
  createDocumentoAction,
  createEventoAction,
  createProcessoAction,
  createTramitacaoAction,
  updateInstituicaoMantenedoraAction,
  deleteAtoAction,
  deleteDocumentoAction,
  deleteEventoAction,
  deleteProcessoAction,
  deleteTramitacaoAction,
  restoreAtoAction,
  restoreDocumentoAction,
  restoreEventoAction,
  restoreProcessoAction,
  restoreTramitacaoAction,
  updateAtoAction,
  updateDocumentoAction,
  updateEventoAction,
  updateProcessoAction,
  updateTramitacaoAction,
} from "./actions";
import { getSessionFromCookies } from "@/server/auth";
import { hasPermission } from "@/server/permissions";
import { AppHeader } from "@/components/AppHeader";
import { DocumentoEditForm } from "./DocumentoEditForm";
import { ErrorAlert } from "@/components/ErrorAlert";
import { SuccessAlert } from "@/components/SuccessAlert";
import {
  buildInstitutionDetailDismissHref,
  buildInstitutionDetailReturnTo,
  INSTITUTION_DETAIL_TIMELINE_DISPLAY_LIMIT,
  loadInstitutionDetail,
  type InstitutionDetailTimelineItem,
} from "@/server/read-models/institutionDetail";
import { SmartDateInput } from "@/components/SmartDateInput";
import { AtoNumeroInput } from "@/components/AtoNumeroInput";
import { ProcessoNumeroAnoFields } from "@/components/ProcessoNumeroAnoFields";
import { AnchorHighlight } from "@/components/AnchorHighlight";
import { redirect } from "next/navigation";

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("pt-BR").format(d);
}

export default async function InstituicaoDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    showDeleted?: string;
    error?: string;
    success?: string;
    limit?: string;
    returnTo?: string;
  }>;
}) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const error = sp.error;
  const success = sp.success;
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!hasPermission(session.perfil, "institutions:read")) redirect("/");

  const allowWriteInstituicao = session
    ? hasPermission(session.perfil, "institutions:write")
    : false;
  const allowWriteProcessos = session
    ? hasPermission(session.perfil, "processes:write")
    : false;
  const allowWriteRegulatorio = session
    ? hasPermission(session.perfil, "regulatory:write")
    : false;
  const allowWriteDocumentos = session
    ? hasPermission(session.perfil, "documents:write")
    : false;
  const allowWriteMantenedoras = session
    ? hasPermission(session.perfil, "maintainers:write")
    : false;
  const allowAnyWrite =
    allowWriteInstituicao ||
    allowWriteProcessos ||
    allowWriteRegulatorio ||
    allowWriteDocumentos;

  const loaded = await loadInstitutionDetail(id, sp, {
    includeMantenedoraOptions: allowWriteInstituicao,
  });

  const dbError =
    loaded.status === "db_error"
      ? "Banco indisponível no momento. Tente novamente em instantes."
      : null;

  if (loaded.status === "not_found" && !dbError) {
    return notFound();
  }

  if (loaded.status === "db_error") {
    return (
      <div className="flex flex-1 flex-col bg-zinc-50">
        <AppHeader />
        <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
          <ErrorAlert
            message={
              dbError ??
              "Banco indisponível no momento. Tente novamente em instantes."
            }
            dismissHref="/instituicoes"
          />
        </div>
      </div>
    );
  }

  if (loaded.status !== "ok") {
    return notFound();
  }

  const {
    instituicao,
    timeline,
    lookups,
    institutionProvenance,
    mantenedoraOptions: mantenedoras,
    query: detailQuery,
  } = loaded;

  const showDeleted = detailQuery.showDeleted;
  const returnTo = detailQuery.returnTo;
  const detailReturnTo = buildInstitutionDetailReturnTo(id, detailQuery);
  const dismissHref = buildInstitutionDetailDismissHref(id, showDeleted);

  const { processoById, tramitacaoById, atoById, eventoById, documentoById } = lookups;

  const canMutateKind = (kind: InstitutionDetailTimelineItem["kind"]) => {
    if (kind === "processo") return allowWriteProcessos;
    if (kind === "tramitacao") return allowWriteRegulatorio;
    if (kind === "ato") return allowWriteRegulatorio;
    if (kind === "evento") return allowWriteRegulatorio;
    if (kind === "documento") return allowWriteDocumentos;
    return false;
  };

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <AppHeader />
      <AnchorHighlight />
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            {instituicao.nome}
          </h1>
          <p className="mt-1 text-sm text-zinc-700">
            {instituicao.cnpj ? `CNPJ ${formatCnpj(instituicao.cnpj)}` : "CNPJ não informado"}
            {" • "}
            {instituicao.municipio ? instituicao.municipio : "Município não informado"}
            {instituicao.uf ? `/${instituicao.uf}` : ""}
          </p>
          <div className="mt-1 text-xs text-zinc-600">
            Mantenedora:{" "}
            {instituicao.mantenedora ? (
              <Link
                href={`/mantenedoras/${instituicao.mantenedora.id}`}
                className="underline underline-offset-2 hover:text-zinc-900"
              >
                {instituicao.mantenedora.razaoSocial}
              </Link>
            ) : (
              <span className="text-zinc-600">(não informada)</span>
            )}
          </div>
        </div>
        <Link
          href={returnTo}
          className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
        >
          Voltar
        </Link>
        <Link
          href={`/instituicoes/${instituicao.id}/relatorio?returnTo=${encodeURIComponent(detailReturnTo)}`}
          className="rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800"
        >
          Relatório
        </Link>
      </div>

      {error ? (
        <ErrorAlert message={error} dismissHref={dismissHref} className="mt-6" />
      ) : null}
      {success ? (
        <SuccessAlert message={success} dismissHref={dismissHref} className="mt-4" />
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {allowAnyWrite ? (
            <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-3 text-xs">
              <div className="text-zinc-700">
                Itens removidos:{" "}
                <span className="font-medium">
                  {showDeleted ? "visíveis" : "ocultos"}
                </span>
              </div>
              <Link
                href={`/instituicoes/${instituicao.id}?showDeleted=${showDeleted ? "0" : "1"}`}
                className="rounded-md border border-zinc-200 bg-white px-3 py-2 font-medium text-zinc-800 hover:bg-zinc-50"
              >
                {showDeleted ? "Ocultar removidos" : "Mostrar removidos"}
              </Link>
            </div>
          ) : null}

          {allowWriteInstituicao ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-sm font-semibold">Dados canônicos</div>
              <form action={updateInstituicaoMantenedoraAction} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <input type="hidden" name="instituicaoId" value={instituicao.id} />
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-zinc-800" htmlFor="mantenedoraId">
                    Mantenedora
                  </label>
                  <select
                    id="mantenedoraId"
                    name="mantenedoraId"
                    defaultValue={instituicao.mantenedoraId ?? ""}
                    className="mt-1 h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                  >
                    <option value="">(sem mantenedora)</option>
                    {mantenedoras.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.razaoSocial}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-[11px] text-zinc-600">
                    Se não existir, cadastre em{" "}
                    {allowWriteMantenedoras ? (
                      <Link className="underline underline-offset-2" href="/mantenedoras/nova">
                        Mantenedoras
                      </Link>
                    ) : (
                      <span className="font-medium">Mantenedoras</span>
                    )}
                    .
                  </div>
                </div>
                <div className="flex items-end">
                  <button className="mt-5 h-9 w-full rounded-md bg-zinc-900 text-xs font-medium text-white hover:bg-zinc-800">
                    Salvar
                  </button>
                </div>
              </form>
            </div>
          ) : null}

          {allowAnyWrite ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-sm font-semibold">Adicionar ao histórico</div>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {allowWriteProcessos ? (
                <form action={createProcessoAction} className="space-y-2 rounded-xl border border-zinc-200 p-3">
                  <input type="hidden" name="instituicaoId" value={instituicao.id} />
                  <div className="text-xs font-semibold text-zinc-700">Processo</div>
                  <ProcessoNumeroAnoFields />
                  <input
                    name="assunto"
                    placeholder="Assunto (opcional)"
                    className="h-9 w-full rounded-md border border-zinc-200 px-2 text-sm text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
                  />
                  <select
                    name="status"
                    className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    defaultValue="ABERTO"
                  >
                    <option value="ABERTO">ABERTO</option>
                    <option value="EM_TRAMITACAO">EM_TRAMITACAO</option>
                    <option value="CONCLUIDO">CONCLUIDO</option>
                    <option value="ARQUIVADO">ARQUIVADO</option>
                  </select>
                  <button className="h-9 w-full rounded-md bg-zinc-900 text-xs font-medium text-white hover:bg-zinc-800">
                    Adicionar
                  </button>
                </form>
                ) : null}

                {allowWriteRegulatorio ? (
                <form action={createTramitacaoAction} className="space-y-2 rounded-xl border border-zinc-200 p-3">
                  <input type="hidden" name="instituicaoId" value={instituicao.id} />
                  <div className="text-xs font-semibold text-zinc-700">Tramitação</div>
                  <select
                    name="processoId"
                    className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    required
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Selecione o processo
                    </option>
                    {instituicao.processos
                      .filter((p) => !p.deletedAt)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.numero ?? "(sem número)"}{p.ano ? `/${p.ano}` : ""} • {p.status}
                        </option>
                      ))}
                  </select>
                  <SmartDateInput
                    name="dataMovimento"
                    required
                    className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                  />
                  <select
                    name="status"
                    className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    defaultValue="ENCAMINHADO"
                  >
                    <option value="ENCAMINHADO">ENCAMINHADO</option>
                    <option value="RECEBIDO">RECEBIDO</option>
                    <option value="DEVOLVIDO">DEVOLVIDO</option>
                    <option value="OUTRO">OUTRO</option>
                  </select>
                  <input
                    name="deSetor"
                    placeholder="De (setor) (opcional)"
                    className="h-9 w-full rounded-md border border-zinc-200 px-2 text-sm text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
                  />
                  <input
                    name="paraSetor"
                    placeholder="Para (setor) (opcional)"
                    className="h-9 w-full rounded-md border border-zinc-200 px-2 text-sm text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
                  />
                  <input
                    name="observacao"
                    placeholder="Observação (opcional)"
                    className="h-9 w-full rounded-md border border-zinc-200 px-2 text-sm text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
                  />
                  <button className="h-9 w-full rounded-md bg-zinc-900 text-xs font-medium text-white hover:bg-zinc-800">
                    Adicionar
                  </button>
                </form>
                ) : null}

                {allowWriteRegulatorio ? (
                <form action={createAtoAction} className="space-y-2 rounded-xl border border-zinc-200 p-3">
                  <input type="hidden" name="instituicaoId" value={instituicao.id} />
                  <div className="text-xs font-semibold text-zinc-700">Ato</div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      name="tipo"
                      className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                      defaultValue="PARECER"
                    >
                      <option value="PARECER">PARECER</option>
                      <option value="RESOLUCAO">RESOLUCAO</option>
                      <option value="PORTARIA">PORTARIA</option>
                      <option value="OUTRO">OUTRO</option>
                    </select>
                    <AtoNumeroInput
                      name="numero"
                      className="h-9 w-full rounded-md border border-zinc-200 px-2 text-sm text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
                    />
                  </div>
                  <SmartDateInput
                    name="dataAto"
                    required
                    className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                  />
                  <input
                    name="ementa"
                    placeholder="Ementa (opcional)"
                    className="h-9 w-full rounded-md border border-zinc-200 px-2 text-sm text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
                  />
                  <button className="h-9 w-full rounded-md bg-zinc-900 text-xs font-medium text-white hover:bg-zinc-800">
                    Adicionar
                  </button>
                </form>
                ) : null}

                {allowWriteRegulatorio ? (
                <form action={createEventoAction} className="space-y-2 rounded-xl border border-zinc-200 p-3">
                  <input type="hidden" name="instituicaoId" value={instituicao.id} />
                  <div className="text-xs font-semibold text-zinc-700">Evento</div>
                  <select
                    name="tipo"
                    className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    defaultValue="PROTOCOLO"
                  >
                    <option value="PROTOCOLO">PROTOCOLO</option>
                    <option value="DILIGENCIA">DILIGENCIA</option>
                    <option value="REUNIAO">REUNIAO</option>
                    <option value="DECISAO">DECISAO</option>
                    <option value="OUTRO">OUTRO</option>
                  </select>
                  <SmartDateInput
                    name="dataEvento"
                    required
                    className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                  />
                  <input
                    name="descricao"
                    placeholder="Descrição"
                    className="h-9 w-full rounded-md border border-zinc-200 px-2 text-sm text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
                    required
                  />
                  <button className="h-9 w-full rounded-md bg-zinc-900 text-xs font-medium text-white hover:bg-zinc-800">
                    Adicionar
                  </button>
                </form>
                ) : null}

                {allowWriteDocumentos ? (
                <form
                  action={createDocumentoAction}
                  className="space-y-2 rounded-xl border border-zinc-200 p-3"
                >
                  <input type="hidden" name="instituicaoId" value={instituicao.id} />
                  <div className="text-xs font-semibold text-zinc-700">
                    Documento (anexo)
                  </div>
                  <select
                    name="processoId"
                    className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    defaultValue=""
                    title="Opcional. Escolha apenas UM vínculo (processo OU ato OU evento)."
                  >
                    <option value="">(sem vínculo a processo)</option>
                    {instituicao.processos
                      .filter((p) => !p.deletedAt)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          Proc {p.numero ?? "(sem número)"}{p.ano ? `/${p.ano}` : ""} • {p.status}
                        </option>
                      ))}
                  </select>
                  <select
                    name="atoId"
                    className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    defaultValue=""
                    title="Opcional. Escolha apenas UM vínculo (processo OU ato OU evento)."
                  >
                    <option value="">(sem vínculo a ato)</option>
                    {instituicao.atos
                      .filter((a) => !a.deletedAt)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.tipo}{a.numero ? ` ${a.numero}` : ""} • {a.dataAto.toISOString().slice(0, 10)}
                        </option>
                      ))}
                  </select>
                  <select
                    name="eventoId"
                    className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    defaultValue=""
                    title="Opcional. Escolha apenas UM vínculo (processo OU ato OU evento)."
                  >
                    <option value="">(sem vínculo a evento)</option>
                    {instituicao.eventos
                      .filter((e) => !e.deletedAt)
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.tipo} • {e.dataEvento.toISOString().slice(0, 10)} • {e.descricao.slice(0, 28)}
                        </option>
                      ))}
                  </select>
                  <div className="text-[11px] text-zinc-600">
                    Dica: escolha no máximo um vínculo (processo <span className="font-medium">ou</span> ato <span className="font-medium">ou</span> evento).
                  </div>
                  <select
                    name="tipoDocumentoCodigo"
                    className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    defaultValue="OUTRO"
                  >
                    <option value="OFICIO">OFICIO</option>
                    <option value="PARECER">PARECER</option>
                    <option value="RESOLUCAO">RESOLUCAO</option>
                    <option value="OUTRO">OUTRO</option>
                  </select>
                  <SmartDateInput
                    name="dataDocumento"
                    className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                  />
                  <input
                    name="titulo"
                    placeholder="Título"
                    className="h-9 w-full rounded-md border border-zinc-200 px-2 text-sm text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
                    required
                  />
                  <input
                    name="arquivo"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,application/pdf,image/*"
                    className="block w-full text-xs text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-xs file:font-medium file:text-zinc-900 hover:file:bg-zinc-200"
                  />
                  <div className="text-[11px] text-zinc-600">
                    Limite recomendado: até 25MB por arquivo.
                  </div>
                  <button className="h-9 w-full rounded-md bg-zinc-900 text-xs font-medium text-white hover:bg-zinc-800">
                    Adicionar
                  </button>
                </form>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="text-sm font-semibold">Linha do tempo</div>
            <div className="mt-3 space-y-2">
              {timeline.slice(0, INSTITUTION_DETAIL_TIMELINE_DISPLAY_LIMIT).map((t, idx) => (
                <div
                  key={`${t.kind}-${idx}-${t.date.toISOString()}`}
                  id={`t-${t.kind}-${t.id}`}
                  className={`scroll-mt-24 rounded-lg border border-zinc-200 bg-white px-3 py-2 ${t.deletedAt ? "opacity-60" : ""}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium">{t.title}</div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-zinc-500">{formatDate(t.date)}</div>
                      {canMutateKind(t.kind) ? (
                        <form
                          action={
                            t.deletedAt
                              ? t.kind === "processo"
                                ? restoreProcessoAction
                                : t.kind === "tramitacao"
                                  ? restoreTramitacaoAction
                                : t.kind === "ato"
                                  ? restoreAtoAction
                                  : t.kind === "evento"
                                    ? restoreEventoAction
                                    : restoreDocumentoAction
                              : t.kind === "processo"
                                ? deleteProcessoAction
                                : t.kind === "tramitacao"
                                  ? deleteTramitacaoAction
                                : t.kind === "ato"
                                  ? deleteAtoAction
                                  : t.kind === "evento"
                                    ? deleteEventoAction
                                    : deleteDocumentoAction
                          }
                        >
                          <input type="hidden" name="instituicaoId" value={instituicao.id} />
                          <input type="hidden" name="id" value={t.id} />
                          {t.kind === "tramitacao" ? (
                            (() => {
                              const tr = tramitacaoById.get(t.id);
                              return tr ? (
                                <input
                                  type="hidden"
                                  name="processoId"
                                  value={tr.processoId}
                                />
                              ) : null;
                            })()
                          ) : null}
                          {!t.deletedAt ? (
                            <label className="mr-2 inline-flex items-center gap-1 text-[11px] text-zinc-700">
                              <input
                                name="confirm"
                                type="checkbox"
                                value="1"
                                className="h-3 w-3 rounded border-zinc-300"
                              />
                              Confirmar
                            </label>
                          ) : null}
                          <button
                            type="submit"
                            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-800 hover:bg-zinc-50"
                          >
                            {t.deletedAt ? "Restaurar" : "Remover"}
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                  {t.subtitle ? (
                    <div className="mt-1 text-xs text-zinc-700">
                      {t.href ? (
                        <a
                          className="underline underline-offset-2 hover:text-zinc-900"
                          href={t.href}
                        >
                          {t.subtitle}
                        </a>
                      ) : (
                        t.subtitle
                      )}
                    </div>
                  ) : null}

                  {t.proveniencia ? (
                    <div className="mt-1 text-[11px] text-zinc-600">
                      {t.importacaoLoteId ? (
                        <>
                          <Link
                            href={`/importacoes/${t.importacaoLoteId}`}
                            className="underline underline-offset-2 hover:text-zinc-900"
                          >
                            {t.proveniencia}
                          </Link>
                        </>
                      ) : (
                        t.proveniencia
                      )}
                    </div>
                  ) : null}

                  {canMutateKind(t.kind) && !t.deletedAt ? (
                    <details className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 p-2">
                      <summary className="cursor-pointer select-none text-xs font-medium text-zinc-800">
                        Editar
                      </summary>

                      {t.kind === "processo" ? (
                        (() => {
                          if (!allowWriteProcessos) return null;
                          const p = processoById.get(t.id);
                          if (!p) return null;
                          return (
                            <form action={updateProcessoAction} className="mt-3 grid grid-cols-1 gap-2">
                              <input type="hidden" name="instituicaoId" value={instituicao.id} />
                              <input type="hidden" name="id" value={p.id} />
                              <ProcessoNumeroAnoFields
                                defaultNumero={p.numero ?? ""}
                                defaultAno={p.ano ?? ""}
                              />
                              <input
                                name="assunto"
                                defaultValue={p.assunto ?? ""}
                                placeholder="Assunto"
                                className="h-9 w-full rounded-md border border-zinc-200 px-2 text-sm text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
                              />
                              <select
                                name="status"
                                defaultValue={p.status}
                                className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                              >
                                <option value="ABERTO">ABERTO</option>
                                <option value="EM_TRAMITACAO">EM_TRAMITACAO</option>
                                <option value="CONCLUIDO">CONCLUIDO</option>
                                <option value="ARQUIVADO">ARQUIVADO</option>
                              </select>
                              <button className="h-9 w-full rounded-md bg-zinc-900 text-xs font-medium text-white hover:bg-zinc-800">
                                Salvar
                              </button>
                            </form>
                          );
                        })()
                      ) : null}

                      {t.kind === "ato" ? (
                        (() => {
                          if (!allowWriteRegulatorio) return null;
                          const a = atoById.get(t.id);
                          if (!a) return null;
                          const d = a.dataAto.toISOString().slice(0, 10);
                          return (
                            <form action={updateAtoAction} className="mt-3 grid grid-cols-1 gap-2">
                              <input type="hidden" name="instituicaoId" value={instituicao.id} />
                              <input type="hidden" name="id" value={a.id} />
                              <div className="grid grid-cols-2 gap-2">
                                <select
                                  name="tipo"
                                  defaultValue={a.tipo}
                                  className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                                >
                                  <option value="PARECER">PARECER</option>
                                  <option value="RESOLUCAO">RESOLUCAO</option>
                                  <option value="PORTARIA">PORTARIA</option>
                                  <option value="OUTRO">OUTRO</option>
                                </select>
                                <AtoNumeroInput
                                  name="numero"
                                  defaultValue={a.numero ?? ""}
                                  className="h-9 w-full rounded-md border border-zinc-200 px-2 text-sm text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
                                />
                              </div>
                              <SmartDateInput
                                name="dataAto"
                                defaultValueIso={d}
                                required
                                className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                              />
                              <input
                                name="ementa"
                                defaultValue={a.ementa ?? ""}
                                placeholder="Ementa"
                                className="h-9 w-full rounded-md border border-zinc-200 px-2 text-sm text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
                              />
                              <input
                                name="descricao"
                                defaultValue={a.descricao ?? ""}
                                placeholder="Descrição"
                                className="h-9 w-full rounded-md border border-zinc-200 px-2 text-sm text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
                              />
                              <button className="h-9 w-full rounded-md bg-zinc-900 text-xs font-medium text-white hover:bg-zinc-800">
                                Salvar
                              </button>
                            </form>
                          );
                        })()
                      ) : null}

                      {t.kind === "evento" ? (
                        (() => {
                          if (!allowWriteRegulatorio) return null;
                          const e = eventoById.get(t.id);
                          if (!e) return null;
                          const d = e.dataEvento.toISOString().slice(0, 10);
                          return (
                            <form action={updateEventoAction} className="mt-3 grid grid-cols-1 gap-2">
                              <input type="hidden" name="instituicaoId" value={instituicao.id} />
                              <input type="hidden" name="id" value={e.id} />
                              <select
                                name="tipo"
                                defaultValue={e.tipo}
                                className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                              >
                                <option value="PROTOCOLO">PROTOCOLO</option>
                                <option value="DILIGENCIA">DILIGENCIA</option>
                                <option value="REUNIAO">REUNIAO</option>
                                <option value="DECISAO">DECISAO</option>
                                <option value="OUTRO">OUTRO</option>
                              </select>
                              <SmartDateInput
                                name="dataEvento"
                                defaultValueIso={d}
                                required
                                className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                              />
                              <input
                                name="descricao"
                                defaultValue={e.descricao}
                                placeholder="Descrição"
                                className="h-9 w-full rounded-md border border-zinc-200 px-2 text-sm text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
                                required
                              />
                              <button className="h-9 w-full rounded-md bg-zinc-900 text-xs font-medium text-white hover:bg-zinc-800">
                                Salvar
                              </button>
                            </form>
                          );
                        })()
                      ) : null}

                      {t.kind === "documento" ? (
                        (() => {
                          if (!allowWriteDocumentos) return null;
                          const d = documentoById.get(t.id);
                          if (!d) return null;
                          const dd = d.dataDocumento ? d.dataDocumento.toISOString().slice(0, 10) : "";
                          return (
                            <DocumentoEditForm
                              instituicaoId={instituicao.id}
                              documentoId={d.id}
                              tipoDocumentoCodigo={d.tipoDocumento.codigo}
                              dataDocumentoIso={dd}
                              titulo={d.titulo}
                              hasAnexo={Boolean(d.storagePath)}
                              action={updateDocumentoAction}
                            />
                          );
                        })()
                      ) : null}

                      {t.kind === "tramitacao" ? (
                        (() => {
                          if (!allowWriteRegulatorio) return null;
                          const tr = tramitacaoById.get(t.id);
                          if (!tr) return null;
                          const d = tr.dataMovimento.toISOString().slice(0, 10);
                          return (
                            <form action={updateTramitacaoAction} className="mt-3 grid grid-cols-1 gap-2">
                              <input type="hidden" name="instituicaoId" value={instituicao.id} />
                              <input type="hidden" name="id" value={tr.id} />
                              <input type="hidden" name="processoId" value={tr.processoId} />
                              <SmartDateInput
                                name="dataMovimento"
                                defaultValueIso={d}
                                required
                                className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                              />
                              <select
                                name="status"
                                defaultValue={tr.status ?? "OUTRO"}
                                className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                              >
                                <option value="ENCAMINHADO">ENCAMINHADO</option>
                                <option value="RECEBIDO">RECEBIDO</option>
                                <option value="DEVOLVIDO">DEVOLVIDO</option>
                                <option value="OUTRO">OUTRO</option>
                              </select>
                              <input
                                name="deSetor"
                                defaultValue={tr.deSetor ?? ""}
                                placeholder="De (setor)"
                                className="h-9 w-full rounded-md border border-zinc-200 px-2 text-sm text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
                              />
                              <input
                                name="paraSetor"
                                defaultValue={tr.paraSetor ?? ""}
                                placeholder="Para (setor)"
                                className="h-9 w-full rounded-md border border-zinc-200 px-2 text-sm text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
                              />
                              <input
                                name="observacao"
                                defaultValue={tr.observacao ?? ""}
                                placeholder="Observação"
                                className="h-9 w-full rounded-md border border-zinc-200 px-2 text-sm text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
                              />
                              <button className="h-9 w-full rounded-md bg-zinc-900 text-xs font-medium text-white hover:bg-zinc-800">
                                Salvar
                              </button>
                            </form>
                          );
                        })()
                      ) : null}
                    </details>
                  ) : null}
                </div>
              ))}
              {timeline.length === 0 ? (
                <div className="rounded-lg bg-zinc-50 p-4 text-sm text-zinc-600">
                  Ainda não há itens no histórico desta instituição.
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="text-sm font-semibold">Resumo</div>
            <div className="mt-3 space-y-2 text-sm text-zinc-700">
              <div>
                <span className="font-medium">Processos</span>:{" "}
                {instituicao.processos.length}
              </div>
              <div>
                <span className="font-medium">Atos</span>: {instituicao.atos.length}
              </div>
              <div>
                <span className="font-medium">Eventos</span>:{" "}
                {instituicao.eventos.length}
              </div>
              <div>
                <span className="font-medium">Documentos</span>:{" "}
                {instituicao.documentos.length}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="text-sm font-semibold">Proveniência (MVP)</div>
            <div className="mt-2 text-xs text-zinc-700">
              {institutionProvenance.text ? (
                <div>
                  {institutionProvenance.loteId ? (
                    <Link
                      href={`/importacoes/${institutionProvenance.loteId}`}
                      className="underline underline-offset-2 hover:text-zinc-900"
                    >
                      {institutionProvenance.text}
                    </Link>
                  ) : (
                    institutionProvenance.text
                  )}
                </div>
              ) : (
                <div className="text-zinc-600">Sem dados de importação.</div>
              )}
            </div>
          </div>
        </aside>
      </div>
      </div>
    </div>
  );
}

