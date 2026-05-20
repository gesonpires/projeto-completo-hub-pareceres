import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { withPrismaRetry } from "@/server/dbRetry";
import { ErrorAlert } from "@/components/ErrorAlert";
import { formatCnpj } from "@/server/normalize";
import { getSessionFromCookies } from "@/server/auth";
import { canGenerateReports, hasPermission } from "@/server/permissions";
import { auditEvent } from "@/server/audit";
import { normalizeReportFrom } from "@/server/reports/reportAudit";
import { loadInstitutionalReport } from "@/server/read-models/institutionalReport";

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("pt-BR").format(d);
}

export default async function RelatorioInstituicaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ from?: string; returnTo?: string }>;
}) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!hasPermission(session.perfil, "institutions:read")) redirect("/");
  if (!canGenerateReports(session.perfil)) redirect("/instituicoes");

  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const fromValue = normalizeReportFrom((sp.from ?? "").trim().slice(0, 32));
  const returnToRaw = (sp.returnTo ?? "").trim();
  const voltarHref =
    returnToRaw && returnToRaw.startsWith("/") ? returnToRaw : `/instituicoes/${id}`;

  const loaded = await loadInstitutionalReport(id);

  if (loaded.status === "db_error") {
    return (
      <div className="flex flex-1 flex-col bg-zinc-50">
        <AppHeader />
        <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
          <ErrorAlert
            message="Banco indisponível no momento. Tente novamente em instantes."
            dismissHref="/instituicoes"
          />
        </div>
      </div>
    );
  }

  if (loaded.status === "not_found") {
    return notFound();
  }

  const { instituicao, timeline, provenance, counts } = loaded.report;
  const provText = provenance.text;
  const provLoteId = provenance.loteId;

  await withPrismaRetry(() =>
    auditEvent({
      entidade: "instituicoes",
      entidadeId: instituicao.id,
      evento: "VISUALIZAR_RELATORIO_HTML",
      actorUserId: session.id,
      metadata: {
        from: fromValue,
        counts,
      },
    }),
  );

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 print:bg-white">
      <div className="print:hidden">
        <AppHeader />
      </div>

      <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        <div className="flex items-start justify-between gap-4 print:hidden">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              Relatório institucional
            </h1>
            <p className="mt-1 text-sm text-zinc-700">{instituicao.nome}</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              className="rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800"
              href={`/api/instituicoes/${instituicao.id}/relatorio.pdf?from=${encodeURIComponent(fromValue)}&dl=1`}
            >
              Exportar PDF
            </a>
            <Link
              href={voltarHref}
              className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Voltar
            </Link>
          </div>
        </div>

        <article className="mt-6 rounded-2xl border border-zinc-200 bg-white p-8 print:mt-0 print:border-0 print:p-0">
          <header className="border-b border-zinc-200 pb-4">
            <div className="text-sm font-semibold">CEE‑SC</div>
            <div className="mt-2 text-xl font-semibold tracking-tight">
              {instituicao.nome}
            </div>
            <div className="mt-1 text-sm text-zinc-700">
              {instituicao.cnpj ? `CNPJ ${formatCnpj(instituicao.cnpj)}` : "CNPJ não informado"}
              {" • "}
              {instituicao.municipio ? instituicao.municipio : "Município não informado"}
              {instituicao.uf ? `/${instituicao.uf}` : ""}
            </div>
            <div className="mt-2 text-xs text-zinc-600">
              Gerado em {formatDate(new Date())}
            </div>
            {provText ? (
              <div className="mt-2 text-xs text-zinc-600">
                {provLoteId ? (
                  <Link
                    href={`/importacoes/${provLoteId}`}
                    className="underline underline-offset-2 hover:text-zinc-900"
                  >
                    {provText}
                  </Link>
                ) : (
                  provText
                )}
              </div>
            ) : null}
          </header>

          <section className="mt-6">
            <h2 className="text-sm font-semibold">Resumo</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-zinc-50 p-3">
                <dt className="text-xs text-zinc-600">Processos</dt>
                <dd className="mt-1 font-semibold">{counts.processos}</dd>
              </div>
              <div className="rounded-lg bg-zinc-50 p-3">
                <dt className="text-xs text-zinc-600">Atos</dt>
                <dd className="mt-1 font-semibold">{counts.atos}</dd>
              </div>
              <div className="rounded-lg bg-zinc-50 p-3">
                <dt className="text-xs text-zinc-600">Eventos</dt>
                <dd className="mt-1 font-semibold">{counts.eventos}</dd>
              </div>
              <div className="rounded-lg bg-zinc-50 p-3">
                <dt className="text-xs text-zinc-600">Documentos</dt>
                <dd className="mt-1 font-semibold">{counts.documentos}</dd>
              </div>
            </dl>
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-semibold">Histórico (linha do tempo)</h2>
            <div className="mt-3 space-y-2">
              {timeline.map((t) => (
                <div key={`${t.kind}-${t.id}`} className="rounded-lg border border-zinc-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium">{t.title}</div>
                    <div className="text-xs text-zinc-600">{formatDate(t.date)}</div>
                  </div>
                  {t.subtitle ? (
                    <div className="mt-1 text-xs text-zinc-700">{t.subtitle}</div>
                  ) : null}
                </div>
              ))}

              {timeline.length === 0 ? (
                <div className="rounded-lg bg-zinc-50 p-4 text-sm text-zinc-700">
                  Nenhum item no histórico.
                </div>
              ) : null}
            </div>
          </section>
        </article>
      </div>
    </div>
  );
}
