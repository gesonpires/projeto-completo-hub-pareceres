import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { AppHeader } from "@/components/AppHeader";
import { withPrismaRetry } from "@/server/dbRetry";
import { ErrorAlert } from "@/components/ErrorAlert";
import type { Prisma } from "@/generated/prisma/client";
import { formatCnpj } from "@/server/normalize";
import { getSessionFromCookies } from "@/server/auth";
import { canReadImports, canReconcileImports } from "@/server/permissions";
import { redirect } from "next/navigation";

function formatDateTime(d: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

export default async function ImportacaoDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ row?: string }>;
}) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!canReadImports(session.perfil)) redirect("/");

  const { id } = await params;
  const row = (await searchParams)?.row;
  type LoteWithRelations = Prisma.ImportacaoLoteGetPayload<{
    include: { fonteDados: true; criador: { include: { perfil: true } } };
  }>;

  let lote: LoteWithRelations | null = null;
  let dbError: string | null = null;

  try {
    lote = await withPrismaRetry(() =>
      prisma.importacaoLote.findUnique({
        where: { id },
        include: { fonteDados: true, criador: { include: { perfil: true } } },
      }),
    );
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

  const errors = (lote.relatorioErros as unknown as Array<{
    rowNumber: number;
    message: string;
  }>)?.slice?.(0, 200) ?? [];
  const impacto = (lote as unknown as { relatorioImpacto?: unknown })?.relatorioImpacto as
    | {
        instituicoes?: { created?: number; updated?: number };
        processos?: { created?: number; updated?: number };
        atos?: { created?: number; updated?: number };
        eventos?: { created?: number; updated?: number };
        documentos?: { created?: number; updated?: number };
      }
    | undefined;

  const returnToImportacao = (() => {
    const p = new URLSearchParams();
    if (row) p.set("row", String(row));
    const qs = p.toString();
    return qs ? `/importacoes/${id}?${qs}` : `/importacoes/${id}`;
  })();

  const [instituicoes, processos, atos, eventos, documentos] = await (async () => {
    try {
      const [inst, procs, a, e, d] = await withPrismaRetry(() =>
        Promise.all([
          prisma.instituicao.findMany({
            where: { importacaoLoteId: id, deletedAt: null },
            orderBy: [{ updatedAt: "desc" }],
            take: 50,
            select: {
              id: true,
              nome: true,
              cnpj: true,
              municipio: true,
              uf: true,
              sourceRef: true,
              updatedAt: true,
            },
          }),
          prisma.processo.findMany({
            where: { importacaoLoteId: id, deletedAt: null },
            orderBy: [{ updatedAt: "desc" }],
            take: 50,
            select: {
              id: true,
              numero: true,
              ano: true,
              status: true,
              assunto: true,
              sourceRef: true,
              updatedAt: true,
              instituicao: { select: { id: true, nome: true } },
            },
          }),
          prisma.atoAutorizativo.findMany({
            where: { importacaoLoteId: id, deletedAt: null },
            orderBy: [{ updatedAt: "desc" }],
            take: 50,
            select: {
              id: true,
              tipo: true,
              numero: true,
              dataAto: true,
              sourceRef: true,
              updatedAt: true,
              instituicao: { select: { id: true, nome: true } },
            },
          }),
          prisma.eventoRegulatorio.findMany({
            where: { importacaoLoteId: id, deletedAt: null },
            orderBy: [{ updatedAt: "desc" }],
            take: 50,
            select: {
              id: true,
              tipo: true,
              dataEvento: true,
              descricao: true,
              sourceRef: true,
              updatedAt: true,
              instituicao: { select: { id: true, nome: true } },
            },
          }),
          prisma.documento.findMany({
            where: { importacaoLoteId: id, deletedAt: null },
            orderBy: [{ updatedAt: "desc" }],
            take: 50,
            select: {
              id: true,
              titulo: true,
              dataDocumento: true,
              tipoDocumento: { select: { codigo: true } },
              sourceRef: true,
              updatedAt: true,
              instituicao: { select: { id: true, nome: true } },
            },
          }),
        ]),
      );
      return [inst, procs, a, e, d] as const;
    } catch {
      return [[], [], [], [], []] as const;
    }
  })();

  const rowNumber = row ? Number.parseInt(row, 10) : NaN;
  const sourceRef = Number.isFinite(rowNumber) ? `row:${rowNumber}` : "";
  const rowMatches = sourceRef
    ? await (async () => {
        try {
          const [inst, procs, atos, eventos, docs] = await withPrismaRetry(() =>
            Promise.all([
              prisma.instituicao.findMany({
                where: { importacaoLoteId: id, sourceRef, deletedAt: null },
                take: 20,
                select: { id: true, nome: true },
              }),
              prisma.processo.findMany({
                where: { importacaoLoteId: id, sourceRef, deletedAt: null },
                take: 20,
                select: { id: true, numero: true, ano: true, instituicao: { select: { id: true, nome: true } } },
              }),
              prisma.atoAutorizativo.findMany({
                where: { importacaoLoteId: id, sourceRef, deletedAt: null },
                take: 20,
                select: { id: true, tipo: true, numero: true, instituicaoId: true },
              }),
              prisma.eventoRegulatorio.findMany({
                where: { importacaoLoteId: id, sourceRef, deletedAt: null },
                take: 20,
                select: { id: true, tipo: true, instituicaoId: true },
              }),
              prisma.documento.findMany({
                where: { importacaoLoteId: id, sourceRef, deletedAt: null },
                take: 20,
                select: { id: true, titulo: true, instituicaoId: true },
              }),
            ]),
          );
          return { inst, procs, atos, eventos, docs };
        } catch {
          return null;
        }
      })()
    : null;

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <AppHeader />
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Lote</h1>
          <p className="mt-1 text-sm text-zinc-700">
            {lote.arquivoNome} • {lote.fonteDados.nome}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canReconcileImports(session.perfil) ? (
            <Link
              href={`/importacoes/${lote.id}/ajustes`}
              className="rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800"
            >
              Ajustes pós‑import
            </Link>
          ) : null}
          <Link
            href="/importacoes"
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Voltar
          </Link>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="text-sm font-semibold">Ir para linha do CSV (sourceRef)</div>
        <form className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="text-xs font-medium text-zinc-800" htmlFor="row">
              Linha (ex.: 2 = primeira linha após header)
            </label>
            <input
              id="row"
              name="row"
              defaultValue={row ?? ""}
              className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
              inputMode="numeric"
              placeholder="Ex.: 12"
            />
          </div>
          <button className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800">
            Buscar
          </button>
          {row ? (
            <Link
              href={`/importacoes/${lote.id}`}
              className="h-10 rounded-md border border-zinc-200 bg-white px-4 text-center text-sm font-medium leading-10 text-zinc-800 hover:bg-zinc-50"
            >
              Limpar
            </Link>
          ) : null}
        </form>

        {rowMatches ? (
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 p-3">
              <div className="text-xs font-semibold text-zinc-800">Instituições</div>
              <ul className="mt-2 space-y-1 text-xs text-zinc-700">
                {rowMatches.inst.map((i) => (
                  <li key={i.id}>
                    <Link
                      href={`/instituicoes/${i.id}?returnTo=${encodeURIComponent(returnToImportacao)}`}
                      className="underline underline-offset-2 hover:text-zinc-900"
                    >
                      {i.nome}
                    </Link>
                  </li>
                ))}
                {rowMatches.inst.length === 0 ? <li className="text-zinc-600">Nenhuma.</li> : null}
              </ul>
            </div>
            <div className="rounded-xl border border-zinc-200 p-3">
              <div className="text-xs font-semibold text-zinc-800">Processos</div>
              <ul className="mt-2 space-y-1 text-xs text-zinc-700">
                {rowMatches.procs.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/instituicoes/${p.instituicao.id}?returnTo=${encodeURIComponent(returnToImportacao)}`}
                      className="underline underline-offset-2 hover:text-zinc-900"
                    >
                      {p.instituicao.nome}
                    </Link>{" "}
                    — {p.numero ?? "(sem número)"}{p.ano ? `/${p.ano}` : ""}
                  </li>
                ))}
                {rowMatches.procs.length === 0 ? <li className="text-zinc-600">Nenhum.</li> : null}
              </ul>
            </div>
            <div className="rounded-xl border border-zinc-200 p-3">
              <div className="text-xs font-semibold text-zinc-800">Outros</div>
              <div className="mt-2 text-xs text-zinc-700">
                Atos: <span className="font-medium">{rowMatches.atos.length}</span> • Eventos:{" "}
                <span className="font-medium">{rowMatches.eventos.length}</span> • Documentos:{" "}
                <span className="font-medium">{rowMatches.docs.length}</span>
              </div>
              <div className="mt-2 text-[11px] text-zinc-600">
                Dica: acesse a instituição para ver os itens na linha do tempo.
              </div>
            </div>
          </div>
        ) : row ? (
          <div className="mt-3 text-xs text-zinc-600">Nenhum registro encontrado para {sourceRef}.</div>
        ) : null}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 lg:col-span-1">
          <div className="text-sm font-semibold">Resumo</div>
          <div className="mt-3 space-y-2 text-sm text-zinc-700">
            <div>
              <span className="font-medium">Status</span>: {lote.status}
            </div>
            <div>
              <span className="font-medium">Lidas</span>: {lote.contagemLidas}
            </div>
            <div>
              <span className="font-medium">Importadas</span>:{" "}
              {lote.contagemImportadas}
            </div>
            <div>
              <span className="font-medium">Rejeitadas</span>:{" "}
              {lote.contagemRejeitadas}
            </div>
            {lote.arquivoTipo || lote.arquivoMeta ? (
              <div className="pt-2 text-xs text-zinc-700">
                <div className="font-semibold">Arquivo</div>
                <div className="mt-1 text-zinc-600">
                  Tipo: <span className="font-medium">{String(lote.arquivoTipo ?? "—")}</span>
                </div>
                {lote.arquivoMeta ? (
                  <div className="mt-1 text-zinc-600">
                    Meta:{" "}
                    <span className="font-medium">
                      {(() => {
                        const meta = lote.arquivoMeta as unknown;
                        if (!meta || typeof meta !== "object") return "—";
                        const m = meta as Record<string, unknown>;
                        if (m.kind === "xlsx") return `aba ${String(m.sheetName ?? "—")}`;
                        if (m.kind === "csv") return `delimiter ${String(m.delimiter ?? "—")}`;
                        return "—";
                      })()}
                    </span>
                    {(() => {
                      const meta = lote.arquivoMeta as unknown;
                      if (!meta || typeof meta !== "object") return null;
                      const m = meta as Record<string, unknown>;
                      const missing = m.missingColumns;
                      if (!Array.isArray(missing) || missing.length === 0) return null;
                      const cols = missing.filter((x) => typeof x === "string") as string[];
                      if (cols.length === 0) return null;
                      return (
                        <div className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-900">
                          Colunas faltando: {cols.join(", ")}
                        </div>
                      );
                    })()}
                  </div>
                ) : null}
              </div>
            ) : null}
            {impacto ? (
              <div className="pt-2 text-xs text-zinc-700">
                <div className="font-semibold">Impacto</div>
                <div className="mt-1 text-zinc-600">
                  Instituições: +{impacto.instituicoes?.created ?? 0} criadas •{" "}
                  {impacto.instituicoes?.updated ?? 0} atualizadas
                </div>
                <div className="text-zinc-600">
                  Processos: +{impacto.processos?.created ?? 0} criados •{" "}
                  {impacto.processos?.updated ?? 0} atualizados
                </div>
                <div className="text-zinc-600">
                  Atos: +{impacto.atos?.created ?? 0} criados •{" "}
                  {impacto.atos?.updated ?? 0} atualizados
                </div>
                <div className="text-zinc-600">
                  Eventos: +{impacto.eventos?.created ?? 0} criados •{" "}
                  {impacto.eventos?.updated ?? 0} atualizados
                </div>
                <div className="text-zinc-600">
                  Documentos: +{impacto.documentos?.created ?? 0} criados •{" "}
                  {impacto.documentos?.updated ?? 0} atualizados
                </div>
              </div>
            ) : null}
            <div className="pt-2">
              <a
                href={`/api/importacoes/${lote.id}/erros.csv`}
                className="inline-flex h-9 w-full items-center justify-center rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
              >
                Exportar erros CSV
              </a>
            </div>
            <div className="grid grid-cols-1 gap-2 pt-2">
              <a
                href={`/api/importacoes/${lote.id}/instituicoes.csv`}
                className="inline-flex h-9 w-full items-center justify-center rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
              >
                Exportar instituições CSV
              </a>
              <a
                href={`/api/importacoes/${lote.id}/processos.csv`}
                className="inline-flex h-9 w-full items-center justify-center rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
              >
                Exportar processos CSV
              </a>
              <a
                href={`/api/importacoes/${lote.id}/atos.csv`}
                className="inline-flex h-9 w-full items-center justify-center rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
              >
                Exportar atos CSV
              </a>
              <a
                href={`/api/importacoes/${lote.id}/eventos.csv`}
                className="inline-flex h-9 w-full items-center justify-center rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
              >
                Exportar eventos CSV
              </a>
              <a
                href={`/api/importacoes/${lote.id}/documentos.csv`}
                className="inline-flex h-9 w-full items-center justify-center rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
              >
                Exportar documentos CSV
              </a>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 lg:col-span-2">
          <div className="text-sm font-semibold">Erros / pendências (até 200)</div>
          <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200">
            <div className="border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
              {errors.length} item(ns)
            </div>
            <ul className="divide-y divide-zinc-200">
              {errors.map((e, idx) => (
                <li key={`${e.rowNumber}-${idx}`} className="px-3 py-2">
                  <div className="text-xs text-zinc-700">
                    <span className="font-medium">Linha {e.rowNumber}</span>:{" "}
                    {e.message}
                  </div>
                </li>
              ))}
              {errors.length === 0 ? (
                <li className="px-3 py-8 text-center text-sm text-zinc-700">
                  Nenhum erro registrado.
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="text-sm font-semibold">
            Instituições afetadas (até 50)
          </div>
          <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200">
            <ul className="divide-y divide-zinc-200">
              {instituicoes.map((i) => (
                <li key={i.id} className="px-3 py-2">
                  <Link
                    href={`/instituicoes/${i.id}?returnTo=${encodeURIComponent(returnToImportacao)}`}
                    className="text-sm font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-950"
                  >
                    {i.nome}
                  </Link>
                  <div className="mt-0.5 text-[11px] text-zinc-600">
                    {i.cnpj ? `CNPJ ${formatCnpj(i.cnpj)}` : "CNPJ não informado"}
                    {" • "}
                    {i.municipio ? i.municipio : "Município não informado"}
                    {i.uf ? `/${i.uf}` : ""}
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-600">
                    {i.sourceRef ? `Ref: ${i.sourceRef}` : "Ref: —"}
                    {" • "}
                    Atualizado em {formatDateTime(i.updatedAt)}
                  </div>
                </li>
              ))}
              {instituicoes.length === 0 ? (
                <li className="px-3 py-8 text-center text-sm text-zinc-700">
                  Nenhuma instituição vinculada a este lote.
                </li>
              ) : null}
            </ul>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="text-sm font-semibold">Processos afetados (até 50)</div>
          <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200">
            <ul className="divide-y divide-zinc-200">
              {processos.map((p) => (
                <li key={p.id} className="px-3 py-2">
                  <div className="text-sm font-medium text-zinc-900">
                    Processo {p.numero ?? "(sem número)"}
                    {p.ano ? `/${p.ano}` : ""} • {p.status}
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-600">
                    Instituição:{" "}
                    <Link
                      href={`/instituicoes/${p.instituicao.id}?returnTo=${encodeURIComponent(returnToImportacao)}`}
                      className="underline underline-offset-2 hover:text-zinc-900"
                    >
                      {p.instituicao.nome}
                    </Link>
                  </div>
                  {p.assunto ? (
                    <div className="mt-0.5 text-[11px] text-zinc-700">
                      {p.assunto}
                    </div>
                  ) : null}
                  <div className="mt-0.5 text-[11px] text-zinc-600">
                    {p.sourceRef ? `Ref: ${p.sourceRef}` : "Ref: —"}
                    {" • "}
                    Atualizado em {formatDateTime(p.updatedAt)}
                  </div>
                </li>
              ))}
              {processos.length === 0 ? (
                <li className="px-3 py-8 text-center text-sm text-zinc-700">
                  Nenhum processo vinculado a este lote.
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="text-sm font-semibold">Atos afetados (até 50)</div>
          <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200">
            <ul className="divide-y divide-zinc-200">
              {atos.map((a) => (
                <li key={a.id} className="px-3 py-2">
                  <div className="text-sm font-medium text-zinc-900">
                    {a.tipo}{a.numero ? ` ${a.numero}` : ""} •{" "}
                    {new Intl.DateTimeFormat("pt-BR").format(a.dataAto)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-600">
                    Instituição:{" "}
                    {a.instituicao ? (
                      <Link
                        href={`/instituicoes/${a.instituicao.id}?returnTo=${encodeURIComponent(returnToImportacao)}`}
                        className="underline underline-offset-2 hover:text-zinc-900"
                      >
                        {a.instituicao.nome}
                      </Link>
                    ) : (
                      <span className="text-zinc-700">Instituição removida</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-600">
                    {a.sourceRef ? `Ref: ${a.sourceRef}` : "Ref: —"}
                    {" • "}
                    Atualizado em {formatDateTime(a.updatedAt)}
                  </div>
                </li>
              ))}
              {atos.length === 0 ? (
                <li className="px-3 py-8 text-center text-sm text-zinc-700">
                  Nenhum ato vinculado a este lote.
                </li>
              ) : null}
            </ul>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="text-sm font-semibold">Eventos afetados (até 50)</div>
          <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200">
            <ul className="divide-y divide-zinc-200">
              {eventos.map((e) => (
                <li key={e.id} className="px-3 py-2">
                  <div className="text-sm font-medium text-zinc-900">
                    {e.tipo} • {new Intl.DateTimeFormat("pt-BR").format(e.dataEvento)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-700">{e.descricao}</div>
                  <div className="mt-0.5 text-[11px] text-zinc-600">
                    Instituição:{" "}
                    {e.instituicao ? (
                      <Link
                        href={`/instituicoes/${e.instituicao.id}?returnTo=${encodeURIComponent(returnToImportacao)}`}
                        className="underline underline-offset-2 hover:text-zinc-900"
                      >
                        {e.instituicao.nome}
                      </Link>
                    ) : (
                      <span className="text-zinc-700">Instituição removida</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-600">
                    {e.sourceRef ? `Ref: ${e.sourceRef}` : "Ref: —"}
                    {" • "}
                    Atualizado em {formatDateTime(e.updatedAt)}
                  </div>
                </li>
              ))}
              {eventos.length === 0 ? (
                <li className="px-3 py-8 text-center text-sm text-zinc-700">
                  Nenhum evento vinculado a este lote.
                </li>
              ) : null}
            </ul>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="text-sm font-semibold">Documentos afetados (até 50)</div>
          <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200">
            <ul className="divide-y divide-zinc-200">
              {documentos.map((d) => (
                <li key={d.id} className="px-3 py-2">
                  <div className="text-sm font-medium text-zinc-900">
                    {d.tipoDocumento.codigo}: {d.titulo}
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-600">
                    {d.dataDocumento ? new Intl.DateTimeFormat("pt-BR").format(d.dataDocumento) : "Sem data"}
                    {" • "}
                    Instituição:{" "}
                    {d.instituicao ? (
                      <Link
                        href={`/instituicoes/${d.instituicao.id}?returnTo=${encodeURIComponent(returnToImportacao)}`}
                        className="underline underline-offset-2 hover:text-zinc-900"
                      >
                        {d.instituicao.nome}
                      </Link>
                    ) : (
                      <span className="text-zinc-700">Instituição removida</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-600">
                    {d.sourceRef ? `Ref: ${d.sourceRef}` : "Ref: —"}
                    {" • "}
                    Atualizado em {formatDateTime(d.updatedAt)}
                  </div>
                </li>
              ))}
              {documentos.length === 0 ? (
                <li className="px-3 py-8 text-center text-sm text-zinc-700">
                  Nenhum documento vinculado a este lote.
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

