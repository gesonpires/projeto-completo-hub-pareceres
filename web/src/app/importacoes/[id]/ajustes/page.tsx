import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { withPrismaRetry } from "@/server/dbRetry";
import { getSessionFromCookies } from "@/server/auth";
import { AppHeader } from "@/components/AppHeader";
import { ErrorAlert } from "@/components/ErrorAlert";
import { SuccessAlert } from "@/components/SuccessAlert";
import { AjustesLoteClient } from "./AjustesLoteClient";
import {
  mergeInstituicaoIntoAction,
  mergeProcessoIntoAction,
  updateInstituicoesBatchAction,
  updateProcessosBatchAction,
} from "./actions";
import { canReconcileImports } from "@/server/permissions";
import { normalizeName } from "@/server/normalize";
import { ManualReconcileInstituicao, ManualReconcileProcesso } from "./ManualReconcile";
import { SuggestedReconcileInstituicoes, SuggestedReconcileProcessos } from "./SuggestedReconcileCards";

export default async function AjustesLotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ ok?: string; error?: string }>;
}) {
  const session = await getSessionFromCookies();
  if (!session) {
    return (
      <div className="flex flex-1 flex-col bg-zinc-50">
        <AppHeader />
        <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
          <ErrorAlert message="Faça login para continuar." dismissHref="/login" />
        </div>
      </div>
    );
  }
  if (!canReconcileImports(session.perfil)) {
    return (
      <div className="flex flex-1 flex-col bg-zinc-50">
        <AppHeader />
        <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
          <ErrorAlert message="Sem permissão para ajustar lote." dismissHref="/importacoes" />
        </div>
      </div>
    );
  }

  const { id } = await params;
  const sp = (await searchParams) ?? {};

  let dbError: string | null = null;
  let lote: { id: string; arquivoNome: string } | null = null;
  let instituicoes: Array<{
    id: string;
    nome: string;
    cnpj: string | null;
    municipio: string | null;
    uf: string | null;
    sourceRef: string | null;
    nomeNorm: string;
    missingMunicipio: boolean;
    missingUf: boolean;
    dupCountNome: number;
    candidates: Array<{ id: string; nome: string; cnpj: string | null; municipio: string | null; uf: string | null }>;
  }> = [];
  let processos: Array<{
    id: string;
    numero: string | null;
    ano: number | null;
    status: string;
    assunto: string | null;
    instituicaoId: string;
    instituicaoNome: string;
    sourceRef: string | null;
    missingNumero: boolean;
    missingAno: boolean;
    dupCountKey: number;
    candidates: Array<{ id: string; numero: string | null; ano: number | null; status: string }>;
  }> = [];

  try {
    const [l, inst, procs] = await withPrismaRetry(() =>
      Promise.all([
        prisma.importacaoLote.findUnique({
          where: { id },
          select: { id: true, arquivoNome: true },
        }),
        prisma.instituicao.findMany({
          where: { importacaoLoteId: id, deletedAt: null },
          orderBy: [{ updatedAt: "desc" }],
          take: 200,
          select: { id: true, nome: true, cnpj: true, municipio: true, uf: true, sourceRef: true },
        }),
        prisma.processo.findMany({
          where: { importacaoLoteId: id, deletedAt: null },
          orderBy: [{ updatedAt: "desc" }],
          take: 200,
          select: {
            id: true,
            numero: true,
            ano: true,
            status: true,
            assunto: true,
            sourceRef: true,
            instituicaoId: true,
            instituicao: { select: { nome: true } },
          },
        }),
      ]),
    );
    lote = l;
    const instNorm = inst.map((i) => ({
      ...i,
      nomeNorm: normalizeName(i.nome),
      missingMunicipio: !i.municipio || i.municipio.trim().length === 0,
      missingUf: !i.uf || i.uf.trim().length === 0,
    }));
    const instCountByNorm = new Map<string, number>();
    for (const i of instNorm) instCountByNorm.set(i.nomeNorm, (instCountByNorm.get(i.nomeNorm) ?? 0) + 1);

    // Candidatos de merge (fora do lote)
    // Heurística: CNPJ exato; fallback: nome aproximado (termos do nomeNormalizado).
    const candByInstId = new Map<string, Array<{ id: string; nome: string; cnpj: string | null; municipio: string | null; uf: string | null }>>();
    for (const i of instNorm) {
      const terms = i.nomeNorm ? i.nomeNorm.split(" ").filter(Boolean).slice(0, 4) : [];
      const approxOr =
        terms.length >= 2
          ? [
              { AND: terms.slice(0, 3).map((t) => ({ nomeNormalizado: { contains: t } })) },
              { AND: terms.slice(0, 2).map((t) => ({ nomeNormalizado: { contains: t } })) },
            ]
          : terms.length === 1
            ? [{ nomeNormalizado: { contains: terms[0] } }]
            : [];
      const candidates = await withPrismaRetry(() =>
        prisma.instituicao.findMany({
          where: {
            deletedAt: null,
            id: { not: i.id },
            importacaoLoteId: null,
            ...(i.cnpj
              ? { cnpj: i.cnpj }
              : approxOr.length > 0
                ? { OR: approxOr as never }
                : i.nomeNorm
                  ? { nomeNormalizado: i.nomeNorm }
                  : {}),
          },
          take: 5,
          orderBy: [{ updatedAt: "desc" }],
          select: { id: true, nome: true, cnpj: true, municipio: true, uf: true },
        }),
      );
      candByInstId.set(i.id, candidates);
    }

    instituicoes = instNorm.map((i) => ({
      ...i,
      dupCountNome: instCountByNorm.get(i.nomeNorm) ?? 0,
      candidates: candByInstId.get(i.id) ?? [],
    }));
    const mappedProcs = procs.map((p) => ({
      id: p.id,
      numero: p.numero,
      ano: p.ano,
      status: p.status,
      assunto: p.assunto,
      sourceRef: p.sourceRef,
      instituicaoId: p.instituicaoId,
      instituicaoNome: p.instituicao.nome,
      missingNumero: !p.numero || p.numero.trim().length === 0,
      missingAno: p.ano === null,
      dupCountKey: 1,
      candidates: [] as Array<{ id: string; numero: string | null; ano: number | null; status: string }>,
    }));

    const procCountByKey = new Map<string, number>();
    for (const p of mappedProcs) {
      const key = `${p.instituicaoId}::${p.numero ?? ""}::${p.ano ?? ""}`;
      procCountByKey.set(key, (procCountByKey.get(key) ?? 0) + 1);
    }
    // Candidatos de merge (fora do lote)
    // Heurística: mesma instituição + número/ano; fallback: número (contains) e ano quando existir.
    const procWithCands = [];
    for (const p of mappedProcs) {
      let candidates: Array<{ id: string; numero: string | null; ano: number | null; status: string }> = [];
      if (p.numero && p.ano !== null) {
        candidates = await withPrismaRetry(() =>
          prisma.processo.findMany({
            where: {
              deletedAt: null,
              id: { not: p.id },
              importacaoLoteId: null,
              instituicaoId: p.instituicaoId,
              numero: p.numero,
              ano: p.ano,
            },
            take: 5,
            orderBy: [{ updatedAt: "desc" }],
            select: { id: true, numero: true, ano: true, status: true },
          }),
        );
      } else {
        const numero = p.numero;
        if (!numero) {
          procWithCands.push({ ...p, candidates });
          continue;
        }
        candidates = await withPrismaRetry(() =>
          prisma.processo.findMany({
            where: {
              deletedAt: null,
              id: { not: p.id },
              importacaoLoteId: null,
              instituicaoId: p.instituicaoId,
              numero: { contains: numero, mode: "insensitive" },
              ...(p.ano !== null ? { ano: p.ano } : {}),
            },
            take: 5,
            orderBy: [{ updatedAt: "desc" }],
            select: { id: true, numero: true, ano: true, status: true },
          }),
        );
      }
      procWithCands.push({ ...p, candidates });
    }

    processos = procWithCands.map((p) => ({
      ...p,
      dupCountKey: procCountByKey.get(`${p.instituicaoId}::${p.numero ?? ""}::${p.ano ?? ""}`) ?? 1,
    }));
  } catch {
    dbError = "Banco indisponível no momento. Tente novamente em instantes.";
  }

  if (!lote) {
    if (dbError) {
      return (
        <div className="flex flex-1 flex-col bg-zinc-50">
          <AppHeader />
          <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
            <ErrorAlert message={dbError} dismissHref="/importacoes" />
          </div>
        </div>
      );
    }
    return notFound();
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <AppHeader />
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Ajustes do lote</h1>
            <p className="mt-1 text-sm text-zinc-700">{lote.arquivoNome}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/importacoes/${lote.id}`}
              className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Voltar ao lote
            </Link>
          </div>
        </div>

        {sp.error ? (
          <ErrorAlert
            message={sp.error}
            dismissHref={`/importacoes/${lote.id}/ajustes`}
            className="mt-6"
          />
        ) : sp.ok ? (
          <SuccessAlert
            className="mt-6"
            message={sp.ok === "1" ? "Ajustes aplicados com sucesso." : sp.ok}
            dismissHref={`/importacoes/${lote.id}/ajustes`}
          />
        ) : null}

        <AjustesLoteClient
          loteId={lote.id}
          instituicoes={instituicoes}
          processos={processos}
          updateInstituicoesAction={updateInstituicoesBatchAction}
          updateProcessosAction={updateProcessosBatchAction}
        />

        <div className="mt-8 space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="text-sm font-semibold">Reconciliação • Instituições</div>
            <div className="mt-1 text-xs text-zinc-600">
              Vincule itens do lote a uma instituição já existente (por CNPJ/nome). A ação reatribui registros do lote e
              marca a instituição importada como removida.
            </div>

            <div className="mt-4 space-y-3">
              <ManualReconcileInstituicao
                loteId={lote.id}
                fromOptions={instituicoes.map((i) => ({
                  id: i.id,
                  label: `${i.nome}${i.cnpj ? ` • ${i.cnpj}` : ""}${i.sourceRef ? ` • Ref: ${i.sourceRef}` : ""}`,
                }))}
                mergeAction={mergeInstituicaoIntoAction}
              />

              {instituicoes
                .filter((i) => i.candidates.length > 0).length > 0 ? (
                <SuggestedReconcileInstituicoes
                  loteId={lote.id}
                  rows={instituicoes.filter((i) => i.candidates.length > 0).slice(0, 30)}
                  mergeAction={mergeInstituicaoIntoAction}
                />
              ) : null}

              {instituicoes.every((i) => i.candidates.length === 0) ? (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-8 text-center text-sm text-zinc-700">
                  Nenhuma sugestão automática de reconciliação encontrada.
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="text-sm font-semibold">Reconciliação • Processos</div>
            <div className="mt-1 text-xs text-zinc-600">
              Vincule itens do lote a um processo já existente (mesma instituição + número/ano). A ação reatribui registros
              do lote e marca o processo importado como removido.
            </div>

            <div className="mt-4 space-y-3">
              <ManualReconcileProcesso
                loteId={lote.id}
                fromOptions={processos.map((p) => ({
                  id: p.id,
                  instituicaoId: p.instituicaoId,
                  label: `Proc ${p.numero ?? "(sem número)"}${p.ano ? `/${p.ano}` : ""} • ${p.instituicaoNome}${
                    p.sourceRef ? ` • Ref: ${p.sourceRef}` : ""
                  }`,
                }))}
                mergeAction={mergeProcessoIntoAction}
              />

              {processos
                .filter((p) => p.candidates.length > 0).length > 0 ? (
                <SuggestedReconcileProcessos
                  loteId={lote.id}
                  rows={processos.filter((p) => p.candidates.length > 0).slice(0, 30)}
                  mergeAction={mergeProcessoIntoAction}
                />
              ) : null}

              {processos.every((p) => p.candidates.length === 0) ? (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-8 text-center text-sm text-zinc-700">
                  Nenhuma sugestão automática de reconciliação encontrada.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

