"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Instituicao = {
  id: string;
  nome: string;
  cnpj: string | null;
  municipio: string | null;
  uf: string | null;
};

async function fetchInstituicoes(q: string): Promise<Instituicao[]> {
  const res = await fetch(`/api/relatorios/instituicoes?q=${encodeURIComponent(q)}`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { rows: Instituicao[] };
  return data.rows ?? [];
}

export function InstituicaoReportPicker() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Instituicao[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Instituicao | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const qq = q.trim();
      setPicked(null);
      if (qq.length < 3) {
        setRows([]);
        return;
      }
      setLoading(true);
      const r = await fetchInstituicoes(qq);
      if (!cancelled) setRows(r);
      if (!cancelled) setLoading(false);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [q]);

  const downloadHref = useMemo(() => {
    if (!picked) return "";
    return `/api/instituicoes/${picked.id}/relatorio.pdf?from=hub&dl=1`;
  }, [picked]);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="text-sm font-semibold">Relatório institucional (PDF)</div>
      <div className="mt-1 text-xs text-zinc-600">
        Pesquise a instituição e baixe o PDF. A geração é registrada em auditoria.
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-6">
        <div className="sm:col-span-4">
          <label className="text-[11px] font-medium text-zinc-700" htmlFor="qInstReport">
            Buscar instituição
          </label>
          <input
            id="qInstReport"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Digite nome (min. 3) ou CNPJ"
            className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-xs text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-[11px] font-medium text-zinc-700" htmlFor="instPicked">
            Selecionar
          </label>
          <select
            id="instPicked"
            className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-xs text-zinc-900 outline-none focus:border-zinc-400"
            value={picked?.id ?? ""}
            onChange={(e) => setPicked(rows.find((r) => r.id === e.target.value) ?? null)}
            disabled={loading || rows.length === 0}
          >
            <option value="" disabled>
              {loading ? "Carregando…" : "Selecione…"}
            </option>
            {rows.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome}
                {r.uf ? `/${r.uf}` : ""}
                {r.cnpj ? ` • ${r.cnpj}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {picked ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
          <div className="min-w-0">
            <div className="truncate text-xs font-medium text-zinc-900">{picked.nome}</div>
            <div className="mt-0.5 text-[11px] text-zinc-600">
              {picked.municipio ?? "Município não informado"}
              {picked.uf ? `/${picked.uf}` : ""}
              {" • "}
              {picked.cnpj ? `CNPJ ${picked.cnpj}` : "CNPJ —"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/instituicoes/${picked.id}`}
              className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Abrir ficha
            </Link>
            <Link
              href={downloadHref}
              className="rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800"
            >
              Baixar PDF
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

