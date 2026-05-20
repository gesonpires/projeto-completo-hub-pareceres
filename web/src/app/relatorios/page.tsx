import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getSessionFromCookies } from "@/server/auth";
import { canGenerateReports } from "@/server/permissions";
import { InstituicaoReportPicker } from "./InstituicaoReportPicker";
import Link from "next/link";
import { prisma } from "@/server/db";
import { withPrismaRetry } from "@/server/dbRetry";
import { formatCnpj } from "@/server/normalize";

export default async function RelatoriosPage() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (!canGenerateReports(session.perfil)) redirect("/");

  const recent = await withPrismaRetry(() =>
    prisma.logAuditoria.findMany({
      where: {
        entidade: "instituicoes",
        metadata: { path: ["evento"], equals: "GERAR_RELATORIO_PDF" } as never,
      },
      orderBy: [{ timestamp: "desc" }],
      take: 10,
      select: {
        id: true,
        entidadeId: true,
        timestamp: true,
        actor: { select: { nome: true, email: true } },
        metadata: true,
      },
    }),
  );
  const ids = Array.from(new Set(recent.map((r) => r.entidadeId)));
  const insts = ids.length
    ? await withPrismaRetry(() =>
        prisma.instituicao.findMany({
          where: { id: { in: ids }, deletedAt: null },
          select: { id: true, nome: true, cnpj: true, municipio: true, uf: true },
        }),
      )
    : [];
  const byId = new Map(insts.map((i) => [i.id, i] as const));

  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(d);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <AppHeader />
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Relatórios</h1>
          <p className="mt-1 text-sm text-zinc-700">
            Geração de relatórios e rastreio de downloads/gerações.
          </p>
        </div>

        <div className="mt-6 space-y-6">
          <InstituicaoReportPicker />
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="text-sm font-semibold">Últimas gerações</div>
            <div className="mt-1 text-xs text-zinc-600">Últimos 10 PDFs gerados.</div>

            <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200">
              <ul className="divide-y divide-zinc-200">
                {recent.map((r) => {
                  const meta = (r.metadata ?? {}) as { from?: string };
                  const inst = byId.get(r.entidadeId) ?? null;
                  return (
                    <li key={r.id} className="px-3 py-2 hover:bg-zinc-50">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-xs font-medium text-zinc-900">
                            <Link href={`/instituicoes/${r.entidadeId}`} className="hover:underline">
                              {inst ? inst.nome : `Instituição ${r.entidadeId}`}
                            </Link>
                          </div>
                          <div className="mt-0.5 text-[11px] text-zinc-600">
                            {fmt(r.timestamp)} • {r.actor.nome} ({r.actor.email})
                            {meta.from ? ` • origem: ${meta.from}` : ""}
                          </div>
                          {inst ? (
                            <div className="mt-0.5 text-[11px] text-zinc-600">
                              {inst.cnpj ? `CNPJ ${formatCnpj(inst.cnpj)}` : "CNPJ —"}
                              {" • "}
                              {inst.municipio ?? "Município não informado"}
                              {inst.uf ? `/${inst.uf}` : ""}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/api/instituicoes/${r.entidadeId}/relatorio.pdf?from=hub_recent&dl=1`}
                            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                          >
                            Baixar PDF
                          </Link>
                        </div>
                      </div>
                    </li>
                  );
                })}
                {recent.length === 0 ? (
                  <li className="px-3 py-8 text-center text-sm text-zinc-700">Nenhuma geração registrada.</li>
                ) : null}
              </ul>
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="text-sm font-semibold">Histórico</div>
            <div className="mt-1 text-xs text-zinc-600">
              Visualize gerações recentes de relatórios institucionais.
            </div>
            <div className="mt-3">
              <Link
                href="/relatorios/historico"
                className="inline-flex h-10 items-center rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
              >
                Abrir histórico
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

